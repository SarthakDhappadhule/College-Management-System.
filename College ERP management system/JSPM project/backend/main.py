from datetime import date, datetime
from typing import List, Optional
from contextlib import asynccontextmanager
from sqlalchemy import func

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from database import create_db_and_tables, get_session
from admin_timetable import router as admin_router
from models import (
    Teacher,
    Student,
    Timetable,
    AttendanceLog,
    PhoneLoginRequest,
    MarkAttendanceRequest
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically creates PostgreSQL tables on startup
    create_db_and_tables()
    yield


app = FastAPI(title="Polytechnic Timetable & Attendance API", lifespan=lifespan)

# -------------------------------------------------------------
# CORS MIDDLEWARE (REQUIRED FOR FRONTEND INTEGRATION)
# -------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from local HTML, React, Flutter, etc.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Admin Operations Router
app.include_router(admin_router)


# -------------------------------------------------------------
# ROOT ROUTE
# -------------------------------------------------------------

@app.get("/")
def read_root():
    return {"status": "online", "message": "Attendance & Timetable API is operational!"}


# -------------------------------------------------------------
# TEACHER & AUTHENTICATION ENDPOINTS
# -------------------------------------------------------------

class TeacherRegisterSchema(BaseModel):
    name: str
    initials: str       # e.g., "SRS"
    phone_number: str   # e.g., "9876543210"
    department: str     # e.g., "Computer Engineering"
    email: Optional[str] = None


@app.post("/teachers/register-and-link")
def register_and_link_teacher(
    data: TeacherRegisterSchema, 
    session: Session = Depends(get_session)
):
    clean_initials = data.initials.strip().upper()
    
    # 1. Check if phone number is already registered
    existing_teacher = session.exec(
        select(Teacher).where(Teacher.phone_number == data.phone_number)
    ).first()

    if existing_teacher:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Teacher with phone number {data.phone_number} is already registered!"
        )

    # 2. Create new Teacher record
    new_teacher = Teacher(
        name=data.name,
        initials=clean_initials,
        email=data.email,
        phone_number=data.phone_number,
        department=data.department
    )
    session.add(new_teacher)
    session.commit()
    session.refresh(new_teacher)  # Fetch auto-generated teacher_id from DB

    # 3. Bulk-link existing timetable slots matching clean_initials
    timetable_slots = session.exec(
        select(Timetable).where(Timetable.teacher_initials == clean_initials)
    ).all()

    linked_count = 0
    for slot in timetable_slots:
        slot.teacher_id = new_teacher.teacher_id
        session.add(slot)
        linked_count += 1

    session.commit()

    return {
        "status": "success",
        "message": f"Teacher '{new_teacher.name}' registered successfully and linked to {linked_count} timetable slots!",
        "teacher": {
            "teacher_id": new_teacher.teacher_id,
            "name": new_teacher.name,
            "initials": clean_initials,
            "phone_number": new_teacher.phone_number,
            "linked_slots_count": linked_count
        }
    }


# 2. Phone Login / Authentication Check
@app.post("/login-phone")
def login_phone(
    request: PhoneLoginRequest, 
    session: Session = Depends(get_session)
):
    statement = select(Teacher).where(Teacher.phone_number == request.phone_number)
    teacher = session.exec(statement).first()

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phone number not registered in the system."
        )

    return {
        "status": "success",
        "data": {
            "teacher_id": teacher.teacher_id,
            "name": teacher.name,
            "phone_number": teacher.phone_number,
            "department": teacher.department
        }
    }


# -------------------------------------------------------------
# DASHBOARD & LIVE LECTURE DETECTION
# -------------------------------------------------------------

# 3. Direct Active Slot Lookup by Phone Number (App Startup Dashboard)
@app.get("/teachers/by-phone/{phone_number}/active-slot")
def get_active_slot_by_phone(
    phone_number: str, 
    session: Session = Depends(get_session),
    simulated_day: Optional[str] = None,
    simulated_time: Optional[str] = None
):
    # 1. Fetch teacher record
    teacher_stmt = select(Teacher).where(Teacher.phone_number == phone_number)
    teacher = session.exec(teacher_stmt).first()

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No teacher found with phone number: {phone_number}"
        )

    # 2. Determine Day and Time
    now = datetime.now()
    
    if simulated_day:
        current_day = simulated_day.strip().upper()[:3]
    else:
        current_day = now.strftime("%a").upper()  # MON, TUE, WED...
    
    if simulated_time:
        current_time = datetime.strptime(simulated_time.strip(), "%H:%M").time()
    else:
        current_time = now.time()

    # 3. Query active slot using teacher_id OR matching clean initials fallback
    statement = select(Timetable).where(
        (Timetable.teacher_id == teacher.teacher_id) | 
        (func.upper(func.trim(Timetable.teacher_initials)) == teacher.initials.upper()),
        func.upper(func.trim(Timetable.day_of_week)).like(f"{current_day}%"),
        Timetable.start_time <= current_time,
        Timetable.end_time >= current_time
    )
    
    active_slot = session.exec(statement).first()

    if not active_slot:
        return {
            "has_active_class": False,
            "current_date": now.date().isoformat(),
            "current_time": current_time.strftime("%H:%M:%S"),
            "teacher": {
                "teacher_id": teacher.teacher_id,
                "name": teacher.name
            },
            "message": f"No active lecture scheduled for {teacher.name} on {current_day} at {current_time.strftime('%H:%M')}."
        }

    # 4. Fetch enrolled students for active class
    student_statement = select(Student).where(Student.class_name == active_slot.class_name)
    students = session.exec(student_statement).all()

    return {
        "has_active_class": True,
        "current_date": now.date().isoformat(),
        "current_time": current_time.strftime("%H:%M:%S"),
        "teacher": {
            "teacher_id": teacher.teacher_id,
            "name": teacher.name
        },
        "slot_info": active_slot,
        "students": students
    }


# -------------------------------------------------------------
# DATA ENTRY & ATTENDANCE LOGGING
# -------------------------------------------------------------

# 4. Add Student (Admin/Setup)
@app.post("/students", response_model=Student)
def add_student(student: Student, session: Session = Depends(get_session)):
    session.add(student)
    session.commit()
    session.refresh(student)
    return student


# 5. Add Single Timetable Entry (Manual fallback)
@app.post("/timetables", response_model=Timetable)
def add_timetable(timetable: Timetable, session: Session = Depends(get_session)):
    session.add(timetable)
    session.commit()
    session.refresh(timetable)
    return timetable


# 6. Batch Attendance Submission (Upserts existing logs to prevent duplicates)
@app.post("/attendance/mark")
def mark_attendance(data: MarkAttendanceRequest, session: Session = Depends(get_session)):
    saved_records = []

    timetable = session.get(Timetable, data.timetable_id)
    if not timetable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Timetable {data.timetable_id} was not found."
        )

    if timetable.teacher_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Timetable slot is missing a linked teacher. Register/link the teacher before marking attendance."
        )

    for record in data.attendance_list:
        # Check if an entry already exists for this slot, date, and student
        existing_log = session.exec(
            select(AttendanceLog).where(
                AttendanceLog.timetable_id == data.timetable_id,
                AttendanceLog.attendance_date == data.date,
                AttendanceLog.student_id == record.student_id
            )
        ).first()

        if existing_log:
            # Update status if re-submitted
            existing_log.status = record.status
            session.add(existing_log)
            saved_records.append(existing_log)
        else:
            # Insert new record
            attendance_entry = AttendanceLog(
                timetable_id=data.timetable_id,
                student_id=record.student_id,
                teacher_id=timetable.teacher_id,
                attendance_date=data.date,
                status=record.status
            )
            session.add(attendance_entry)
            saved_records.append(attendance_entry)
    
    session.commit()
    return {
        "status": "success",
        "message": f"Successfully logged/updated attendance for {len(saved_records)} students.",
        "timetable_id": data.timetable_id,
        "date": data.date
    }
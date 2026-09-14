from datetime import date, time, datetime
from typing import Optional, List
from pydantic import BaseModel
from sqlmodel import Field, SQLModel

# -------------------------------------------------------------
# DATABASE TABLE SCHEMAS
# -------------------------------------------------------------

from typing import Optional
from sqlmodel import SQLModel, Field

class Teacher(SQLModel, table=True):
    __tablename__ = "teachers"

    teacher_id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    initials: str = Field(nullable=False, index=True) # Must be non-nullable
    email: Optional[str] = None
    phone_number: str = Field(unique=True, index=True)
    department: str

class Student(SQLModel, table=True):
    __tablename__ = "students"
    student_id: Optional[int] = Field(default=None, primary_key=True)
    enrollment_no: str = Field(unique=True, index=True)
    name: str
    department: str = Field(default="Computer Engineering")
    class_name: str
    assigned_batch: Optional[str] = "ALL"
    roll_no: int
    parent_whatsapp: Optional[str] = None


class Timetable(SQLModel, table=True):
    __tablename__ = "timetables"
    timetable_id: Optional[int] = Field(default=None, primary_key=True)
    department: str
    class_name: str
    day_of_week: str        # MON, TUE, WED, THU, FRI, SAT
    slot_number: int
    slot_type: str         # LECTURE, PRACTICAL, TUTORIAL
    subject_code: str      # e.g., CGR, DTE, OOP, DSU, DMS, EIC
    target_batch: str      # A, B, C, ALL
    start_time: time
    end_time: time
    room_no: Optional[str] = None
    teacher_initials: Optional[str] = None
    teacher_id: Optional[int] = Field(default=None, foreign_key="teachers.teacher_id")



class AttendanceLog(SQLModel, table=True):
    __tablename__ = "attendance_logs"

    log_id: Optional[int] = Field(default=None, primary_key=True)
    timetable_id: int = Field(foreign_key="timetables.timetable_id")
    student_id: int = Field(foreign_key="students.student_id")
    teacher_id: int = Field(foreign_key="teachers.teacher_id")
    attendance_date: date = Field(default_factory=date.today)
    status: str  # "PRESENT", "ABSENT", "LATE"
    marked_at: datetime = Field(default_factory=datetime.now)

# -------------------------------------------------------------
# REQUEST / RESPONSE PAYLOAD SCHEMAS
# -------------------------------------------------------------

class TeacherRegisterSchema(BaseModel):
    name: str
    initials: str          # e.g., "SRS"
    phone_number: str      # e.g., "9876543210"
    department: str        # e.g., "Computer Engineering"
    email: Optional[str] = None


class EmailLoginRequest(BaseModel):
    email: str


class PhoneLoginRequest(BaseModel):
    phone_number: str


class StudentAttendanceRecord(BaseModel):
    student_id: int
    status: str            # "PRESENT" or "ABSENT"


class MarkAttendanceRequest(BaseModel):
    timetable_id: int
    date: date
    attendance_list: List[StudentAttendanceRecord]
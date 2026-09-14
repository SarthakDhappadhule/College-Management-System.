import io
import re
from datetime import time
from typing import List, Dict
import pandas as pd
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status, Query
from sqlmodel import Session, select, func

from database import get_session
from models import Timetable, Teacher

router = APIRouter(prefix="/admin", tags=["Admin Operations"])


def parse_cell_text(cell_text: str) -> List[Dict[str, str]]:
    """Extracts lab batches or lectures from Excel cell strings."""
    if not isinstance(cell_text, str) or cell_text.strip() in ["-", "RECESS", ""]:
        return []

    entries = []
    lines = [line.strip() for line in cell_text.split('\n') if line.strip()]

    for line in lines:
        if "ZERO HOUR" in line or "RECESS" in line:
            continue

        # Lab Pattern: e.g. "DTE-A NW LAB(PB-201)SRS" or "DSU-A MP LAB(210)ASV"
        lab_match = re.search(r"([A-Z]+)-([A-C])\s+.*?\((.*?)\)\s*([A-Z/]+)", line)
        if lab_match:
            entries.append({
                "subject": lab_match.group(1),
                "batch": lab_match.group(2),
                "room": lab_match.group(3),
                "teacher": lab_match.group(4),
                "type": "PRACTICAL"
            })

    # Lecture / Tutorial Pattern: multi-line (e.g. "DMS (1)\nCL-204\nKMS")
    if not entries and len(lines) >= 3:
        subj_part, room_part, teacher_part = lines[0], lines[1], lines[2]
        slot_type = "TUTORIAL" if "TUT" in subj_part else "LECTURE"
        subj_match = re.match(r"([A-Z]+)", subj_part)
        subject_code = subj_match.group(1) if subj_match else subj_part

        entries.append({
            "subject": subject_code,
            "batch": "ALL",
            "room": room_part,
            "teacher": teacher_part,
            "type": slot_type
        })

    return entries


@router.post("/upload-timetable-excel")
async def upload_timetable_excel(
    file: UploadFile = File(...),
    department: str = Query("Computer Engineering"),
    clear_existing: bool = Query(True, description="Delete existing records for this class before uploading"),
    session: Session = Depends(get_session)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload an Excel (.xlsx or .xls) file."
        )

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents), sheet_name=0)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error reading Excel file: {str(e)}"
        )

    # Auto-extract Class Name from Row 1 Header (e.g., SY-CO-2)
    class_name = "SY-CO-2"
    row1_text = str(df.iloc[1, 0]) if len(df) > 1 else ""
    if "Year-Branch-Division:" in row1_text:
        class_name = row1_text.split("Year-Branch-Division:")[1].strip()

    # Academic Time Slots Mapping (Row 4 times)
    time_slots = {
        1: (time(8, 30), time(9, 30)),   # Lect 1
        2: (time(9, 30), time(10, 30)),  # Lect 2
        4: (time(11, 0), time(12, 0)),   # Lect 3
        5: (time(12, 0), time(13, 0)),   # Lect 4
        7: (time(13, 45), time(14, 45)), # Lect 5
        8: (time(14, 45), time(15, 45)), # Lect 6
        9: (time(15, 45), time(16, 20)), # Lect 7
    }

    # Delete old timetable entries for clean re-upload
    if clear_existing:
        existing_slots = session.exec(
            select(Timetable).where(Timetable.class_name == class_name)
        ).all()
        for slot in existing_slots:
            session.delete(slot)
        session.commit()

    db_entries_added = 0

    # Process Rows 5 through 10 (Days: MON to SAT)
    for row_idx in range(5, min(11, len(df))):
        day_name = str(df.iloc[row_idx, 0]).strip().upper()

        for col_idx, (start_t, end_t) in time_slots.items():
            if col_idx < df.shape[1]:
                cell_content = df.iloc[row_idx, col_idx]
                if pd.notna(cell_content):
                    entries = parse_cell_text(str(cell_content))

                    for entry in entries:
                        new_slot = Timetable(
                            department=department,
                            class_name=class_name,
                            day_of_week=day_name,
                            slot_number=col_idx,
                            slot_type=entry["type"],
                            subject_code=entry["subject"],
                            target_batch=entry["batch"],
                            start_time=start_t,
                            end_time=end_t,
                            room_no=entry["room"],
                            teacher_initials=entry["teacher"]
                        )
                        session.add(new_slot)
                        db_entries_added += 1

    session.commit()

    # Link imported timetable rows to already-registered faculty by initials.
    # This keeps Excel -> Timetable -> Teacher -> Attendance fully connected.
    teachers = session.exec(select(Teacher)).all()
    linked_count = 0
    for teacher in teachers:
        teacher_initials = (teacher.initials or "").strip().upper()
        if not teacher_initials:
            continue
        matching_slots = session.exec(
            select(Timetable).where(
                func.upper(func.trim(Timetable.teacher_initials)) == teacher_initials
            )
        ).all()
        for slot in matching_slots:
            if slot.teacher_id != teacher.teacher_id:
                slot.teacher_id = teacher.teacher_id
                session.add(slot)
                linked_count += 1
    session.commit()

    return {
        "status": "success",
        "message": f"Successfully converted Excel timetable to PostgreSQL for class {class_name}!",
        "class_name": class_name,
        "total_slots_stored": db_entries_added,
        "teacher_links_updated": linked_count
    }
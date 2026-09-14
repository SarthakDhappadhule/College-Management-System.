# database.py
from sqlmodel import SQLModel, create_engine, Session

# ⚠️ Update this with your actual PostgreSQL database credentials
DATABASE_URL = "postgresql://postgres:A1S2@localhost:5432/attendance_db"

engine = create_engine(DATABASE_URL, echo=True)


# 1. This is the missing function causing the ImportError!
def create_db_and_tables():
    """Creates the tables in PostgreSQL if they do not exist."""
    SQLModel.metadata.create_all(engine)


# 2. Dependency for FastAPI endpoints
def get_session():
    """FastAPI Dependency for database sessions."""
    with Session(engine) as session:
        yield session
        
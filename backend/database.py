import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

_url = os.getenv("DATABASE_URL", "")

# Render's Postgres connection strings use the legacy "postgres://" scheme
if _url.startswith("postgres://"):
    _url = _url.replace("postgres://", "postgresql://", 1)

if _url.startswith("postgresql://"):
    db_kind = "postgres"
    engine = create_engine(_url, pool_pre_ping=True)
else:
    db_kind = "sqlite"
    _path = os.getenv("SQLITE_PATH", "./data.sqlite")
    engine = create_engine(
        f"sqlite:///{_path}",
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_connection() -> bool:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return True

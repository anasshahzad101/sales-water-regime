"""WR Sales Hub — Flask configuration."""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-key-change-in-production")

    _db_url = os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'instance' / 'wr_sales_hub.db'}")
    # Render gives postgres:// — SQLAlchemy wants postgresql://
    if _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # 48-hour grace window for visit outcome enforcement
    OUTCOME_GRACE_HOURS = 48

    # Dormant account threshold (days without any touch)
    DORMANT_DAYS = 60

    # Stuck deal threshold (days in same stage)
    STUCK_STAGE_DAYS = 30

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.environ.get("FLASK_ENV") == "production"

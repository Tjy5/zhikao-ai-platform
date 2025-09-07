from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Prefer env-configured URL; fall back to local dev default.
DATABASE_URL = settings.DATABASE_URL or "postgresql://myuser:mypassword@localhost:5432/mydb"

# Enable pool_pre_ping to avoid stale connection warnings in dev.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# SQLAlchemy 2.0 style import to avoid MovedIn20 deprecation warnings.
Base = declarative_base()

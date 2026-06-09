from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

SQLITE_DATABASE_URL = "sqlite:///./dev.db"
configured_database_url = settings.DATABASE_URL.strip()
DATABASE_URL = (
    configured_database_url
    if configured_database_url.startswith("sqlite")
    else SQLITE_DATABASE_URL
)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# SQLAlchemy 2.0 style import to avoid MovedIn20 deprecation warnings.
Base = declarative_base()


# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

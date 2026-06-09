"""Pytest fixtures and configuration."""
import os

import pytest

os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "sqlite:///./test.db")

from app.core.config import settings
settings._env_cache["DATABASE_URL"] = os.environ["DATABASE_URL"]

from app.db.database import Base, engine
from app.services import ai_service


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Ensure all SQLAlchemy tables exist before running tests."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    # Optionally drop tables after tests
    # Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def reset_writing_llm_provider(monkeypatch):
    """Reset the writing LLM provider singleton and clear API key so tests never make real network calls."""
    monkeypatch.setitem(settings._env_cache, "OPENAI_API_KEY", "")
    monkeypatch.setattr(ai_service, "_writing_llm_provider", None)
    yield

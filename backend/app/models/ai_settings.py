from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class UserAIModelSettings(Base):
    __tablename__ = "user_ai_model_settings"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_ai_model_settings_user_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider_name = Column(String, nullable=False, default="openai-compatible")
    base_url = Column(String, nullable=False, default="https://api.openai.com/v1")
    model_name = Column(String, nullable=False, default="gpt-4o-mini")
    api_key_encrypted = Column(Text, nullable=True)
    api_key_hint = Column(String, nullable=True)
    json_fallback_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    last_test_status = Column(String, nullable=True)
    last_tested_at = Column(DateTime, nullable=True)
    last_failure_classification = Column(String, nullable=True)
    last_successful_mode = Column(String, nullable=True)

    user = relationship("User", back_populates="ai_model_settings")

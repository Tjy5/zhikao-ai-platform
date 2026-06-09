from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON as SA_JSON

from app.db.database import Base


class History(Base):
    __tablename__ = "history"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    kind = Column(String, nullable=False, index=True)
    task_type = Column(String, nullable=True)
    score = Column(Float, nullable=True)
    request_json = Column(SA_JSON(), nullable=False)
    response_json = Column(SA_JSON(), nullable=False)
    extra_json = Column(SA_JSON(), nullable=True)

    user = relationship("User", back_populates="history_items")

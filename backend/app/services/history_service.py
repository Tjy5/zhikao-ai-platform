#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import uuid
from typing import Any, Dict, List, Optional
from app.db.database import SessionLocal
from app.models.history import History


"""Database-backed history service (strict: no filesystem fallback)."""


def append_history(
    *,
    user_id: int,
    kind: str,
    request: Dict[str, Any],
    response: Dict[str, Any],
    extra: Optional[Dict[str, Any]] = None,
) -> str:
    """Append one history record. DB only; raises on failure.

    Record shape:
      { id, timestamp, type, request, response, extra }
    """
    record_id = str(uuid.uuid4())
    with SessionLocal() as db:
        row = History(
            id=record_id,
            user_id=user_id,
            kind=kind,
            task_type=(response.get("taskType") or request.get("task_type")),
            score=response.get("score"),
            request_json=request,
            response_json=response,
            extra_json=extra,
        )
        db.add(row)
        db.commit()
        return record_id



def list_history(*, user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
    """Return last N history entries owned by user (most recent first)."""
    limit = max(1, min(int(limit or 20), 200))
    with SessionLocal() as db:
        rows = (
            db.query(History)
            .filter(History.user_id == user_id)
            .order_by(History.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "timestamp": r.created_at.isoformat() if r.created_at else None,
                "type": r.kind,
                "taskType": (
                    r.task_type
                    or (
                        r.response_json.get("taskType")
                        if isinstance(r.response_json, dict)
                        else None
                    )
                ),
                "score": r.score,
                "content": (
                    r.response_json.get("content")
                    if isinstance(r.response_json, dict)
                    else None
                ),
                "contentFormat": (
                    r.response_json.get("contentFormat")
                    if isinstance(r.response_json, dict)
                    else None
                ),
            }
            for r in rows
        ]


def get_history_item(*, user_id: int, item_id: str) -> Optional[Dict[str, Any]]:
    with SessionLocal() as db:
        r = (
            db.query(History)
            .filter(History.id == item_id, History.user_id == user_id)
            .first()
        )
        if r:
            return {
                "id": r.id,
                "timestamp": r.created_at.isoformat() if r.created_at else None,
                "type": r.kind,
                "request": r.request_json,
                "response": r.response_json,
                "extra": r.extra_json,
            }
        return None


def clear_history(*, user_id: int) -> int:
    """Clear current user's history only."""
    with SessionLocal() as db:
        query = db.query(History).filter(History.user_id == user_id)
        count = query.count()
        query.delete(synchronize_session=False)
        db.commit()
        return int(count)

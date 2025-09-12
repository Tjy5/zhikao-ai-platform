#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import uuid
from typing import Any, Dict, List, Optional
from app.db.database import SessionLocal
from app.models.history import History


"""Database-backed history service (strict: no filesystem fallback)."""


def append_history(
    *,
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
            kind=kind,
            question_type=(response.get("questionType") or request.get("question_type")),
            score=response.get("score"),
            request_json=request,
            response_json=response,
            extra_json=extra,
        )
        db.add(row)
        db.commit()
        return record_id

    return record_id


def list_history(limit: int = 20) -> List[Dict[str, Any]]:
    """Return last N history entries (most recent first). DB only."""
    limit = max(1, min(int(limit or 20), 200))
    with SessionLocal() as db:
        rows = (
            db.query(History)
            .order_by(History.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "timestamp": r.created_at.isoformat() if r.created_at else None,
                "type": r.kind,
                "questionType": r.question_type,
                "score": r.score,
            }
            for r in rows
        ]


def get_history_item(item_id: str) -> Optional[Dict[str, Any]]:
    with SessionLocal() as db:
        r = db.query(History).filter(History.id == item_id).first()
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


def clear_history() -> int:
    """Clear history (DB only)."""
    with SessionLocal() as db:
        count = db.query(History).count()
        db.query(History).delete()
        db.commit()
        return int(count)

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.ai_settings import UserAIModelSettings


client = TestClient(app)


def _register_and_login() -> tuple[dict, str]:
    suffix = uuid.uuid4().hex[:10]
    password = "StrongPass123!"
    payload = {
        "username": f"status_{suffix}",
        "email": f"status_{suffix}@example.com",
        "password": password,
    }
    register = client.post("/api/v1/auth/register", json=payload)
    assert register.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": payload["username"],
            "password": password,
        },
    )
    assert login.status_code == 200
    return register.json(), login.json()["access_token"]


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _save_settings(token: str, api_key: str = "sk-status-secret-1234") -> None:
    response = client.put(
        "/api/v1/settings/writing-ai",
        headers=_auth_headers(token),
        json={
            "provider_name": "openai-compatible",
            "base_url": "https://provider.example.com/v1",
            "model_name": "status-model",
            "api_key": api_key,
            "json_fallback_enabled": True,
        },
    )
    assert response.status_code == 200


def test_ai_status_reports_unavailable_without_api_key():
    _, token = _register_and_login()

    response = client.get("/api/v1/writings/ai-status", headers=_auth_headers(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unavailable"
    assert payload["services"]["writing_feedback"] == "unavailable"
    assert payload["capability"]["configured"] is False


def test_ai_status_reports_unverified_when_api_key_is_saved():
    _, token = _register_and_login()
    _save_settings(token)

    response = client.get("/api/v1/writings/ai-status", headers=_auth_headers(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "active"
    assert payload["services"]["writing_feedback"] == "unverified"
    assert payload.get("capability", {}).get("configured") is True
    assert payload.get("capability", {}).get("last_successful_mode") is None
    assert payload.get("base_url") == "https://provider.example.com/v1"


def test_ai_status_reports_known_success_modes_per_user():
    user, token = _register_and_login()
    _save_settings(token)

    with SessionLocal() as db:
        row = (
            db.query(UserAIModelSettings)
            .filter(UserAIModelSettings.user_id == user["id"])
            .first()
        )
        assert row is not None
        row.last_successful_mode = "structured_output"
        row.last_failure_classification = None
        db.commit()

    response = client.get("/api/v1/writings/ai-status", headers=_auth_headers(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["services"]["writing_feedback"] == "available"
    assert payload["capability"]["last_successful_mode"] == "structured_output"

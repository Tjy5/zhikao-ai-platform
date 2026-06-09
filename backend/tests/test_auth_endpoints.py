from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.user import User


client = TestClient(app)


def _unique_payload(password: str = "StrongPass123!") -> dict[str, str]:
    suffix = uuid.uuid4().hex[:10]
    return {
        "username": f"user_{suffix}",
        "email": f"user_{suffix}@example.com",
        "password": password,
    }


def _register(payload: dict[str, str]) -> dict:
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    return response.json()


def test_register_success_stores_hashed_password_only():
    payload = _unique_payload()
    data = _register(payload)

    assert data["username"] == payload["username"]
    assert data["email"] == payload["email"]
    assert "password" not in data
    assert "hashed_password" not in data

    with SessionLocal() as db:
        user = db.query(User).filter(User.username == payload["username"]).first()
        assert user is not None
        assert user.hashed_password != payload["password"]
        assert user.is_active is True


def test_duplicate_registration_is_rejected():
    payload = _unique_payload()
    _register(payload)

    duplicate = client.post("/api/v1/auth/register", json=payload)

    assert duplicate.status_code == 409


def test_login_success_returns_bearer_token_and_me_resolves_user():
    payload = _unique_payload()
    created = _register(payload)

    login = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": payload["username"],
            "password": payload["password"],
        },
    )

    assert login.status_code == 200
    token_data = login.json()
    assert token_data["token_type"] == "bearer"
    assert token_data["access_token"]
    assert token_data["expires_in"] > 0

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token_data['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["id"] == created["id"]


def test_login_failure_uses_generic_rejection():
    payload = _unique_payload()
    _register(payload)

    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": payload["username"],
            "password": "wrong-password",
        },
    )

    assert response.status_code == 401
    assert "密码" in response.json()["detail"]


def test_current_user_rejects_missing_invalid_expired_and_inactive_credentials():
    missing = client.get("/api/v1/auth/me")
    assert missing.status_code == 401

    invalid = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert invalid.status_code == 401

    expired_token = create_access_token("999999", expires_delta=timedelta(seconds=-1))
    expired = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert expired.status_code == 401

    payload = _unique_payload()
    created = _register(payload)
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == created["id"]).first()
        assert user is not None
        user.is_active = False
        db.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": payload["username"],
            "password": payload["password"],
        },
    )
    assert login.status_code == 401

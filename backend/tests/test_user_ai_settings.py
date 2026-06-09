from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.ai_settings import UserAIModelSettings
from app.services.llm_provider import WritingLLMProvider, LLMAuthError, LLMTimeoutError
from app.services.user_ai_settings_service import decrypt_api_key


client = TestClient(app)


def _register_and_login() -> tuple[dict, str]:
    suffix = uuid.uuid4().hex[:10]
    password = "StrongPass123!"
    payload = {
        "username": f"settings_{suffix}",
        "email": f"settings_{suffix}@example.com",
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


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _settings_payload(api_key: str = "sk-user-secret-1234") -> dict:
    return {
        "provider_name": "openai-compatible",
        "base_url": "https://provider.example.com/v1",
        "model_name": "writing-model",
        "api_key": api_key,
        "json_fallback_enabled": True,
    }


def test_settings_get_before_configuration_is_redacted():
    _, token = _register_and_login()

    response = client.get("/api/v1/settings/writing-ai", headers=_auth(token))

    assert response.status_code == 200
    data = response.json()
    assert data["has_api_key"] is False
    assert data["api_key_hint"] is None
    assert "api_key" not in data
    assert "api_key_encrypted" not in data


def test_provider_test_without_key_returns_safe_status():
    _, token = _register_and_login()

    response = client.post("/api/v1/settings/writing-ai/test", headers=_auth(token))

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "unavailable"
    assert data["configured"] is False
    assert data["last_failure_classification"] == "unavailable"


def test_model_discovery_uses_saved_credentials_and_returns_models(monkeypatch):
    _, token = _register_and_login()
    secret = "sk-model-secret-7777"
    save = client.put(
        "/api/v1/settings/writing-ai",
        headers=_auth(token),
        json=_settings_payload(secret),
    )
    assert save.status_code == 200
    captured = {}

    async def fake_list_models(self):
        captured["api_key"] = self.api_key
        captured["base_url"] = self.base_url
        captured["model_name"] = self.model_name
        return [
            {
                "id": "writing-model-b",
                "created": 1686935002,
                "object": "model",
                "owned_by": "provider",
            },
            {
                "id": "writing-model-a",
                "created": 1686935001,
                "object": "model",
                "owned_by": "provider",
            },
        ]

    monkeypatch.setattr(WritingLLMProvider, "list_models", fake_list_models)

    response = client.post(
        "/api/v1/settings/writing-ai/models",
        headers=_auth(token),
        json={},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "succeeded"
    assert data["configured"] is True
    assert data["model_count"] == 2
    assert [model["id"] for model in data["models"]] == [
        "writing-model-a",
        "writing-model-b",
    ]
    assert captured == {
        "api_key": secret,
        "base_url": "https://provider.example.com/v1",
        "model_name": "writing-model",
    }
    assert secret not in response.text


def test_model_discovery_with_unsaved_overrides_does_not_persist(monkeypatch):
    user, token = _register_and_login()
    captured = {}

    async def fake_list_models(self):
        captured["api_key"] = self.api_key
        captured["base_url"] = self.base_url
        return [
            {
                "id": "unsaved-model",
                "created": 1686935003,
                "object": "model",
                "owned_by": "provider",
            }
        ]

    monkeypatch.setattr(WritingLLMProvider, "list_models", fake_list_models)

    response = client.post(
        "/api/v1/settings/writing-ai/models",
        headers=_auth(token),
        json={
            "base_url": "https://unsaved.example.com/v1/",
            "api_key": "sk-unsaved-secret-8888",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "succeeded"
    assert data["base_url"] == "https://unsaved.example.com/v1"
    assert data["models"][0]["id"] == "unsaved-model"
    assert captured == {
        "api_key": "sk-unsaved-secret-8888",
        "base_url": "https://unsaved.example.com/v1",
    }
    assert "sk-unsaved-secret-8888" not in response.text

    with SessionLocal() as db:
        row = (
            db.query(UserAIModelSettings)
            .filter(UserAIModelSettings.user_id == user["id"])
            .first()
        )
        assert row is None


def test_model_discovery_without_key_returns_safe_status():
    _, token = _register_and_login()

    response = client.post(
        "/api/v1/settings/writing-ai/models",
        headers=_auth(token),
        json={"base_url": "https://provider.example.com/v1"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "unavailable"
    assert data["configured"] is False
    assert data["models"] == []
    assert data["last_failure_classification"] == "unavailable"


@pytest.mark.parametrize(
    ("error_type", "classification"),
    [
        (LLMAuthError, "authentication"),
        (LLMTimeoutError, "timeout"),
    ],
)
def test_model_discovery_provider_failures_are_safe(
    monkeypatch,
    error_type,
    classification,
):
    _, token = _register_and_login()
    save = client.put(
        "/api/v1/settings/writing-ai",
        headers=_auth(token),
        json=_settings_payload("sk-failing-secret-9999"),
    )
    assert save.status_code == 200

    async def fake_list_models(self):
        raise error_type("provider failed")

    monkeypatch.setattr(WritingLLMProvider, "list_models", fake_list_models)

    response = client.post(
        "/api/v1/settings/writing-ai/models",
        headers=_auth(token),
        json={},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert data["configured"] is True
    assert data["models"] == []
    assert data["last_failure_classification"] == classification
    assert "sk-failing-secret-9999" not in response.text


def test_model_discovery_rejects_invalid_base_url():
    _, token = _register_and_login()

    response = client.post(
        "/api/v1/settings/writing-ai/models",
        headers=_auth(token),
        json={"base_url": "ftp://provider.example.com/v1", "api_key": "sk-test"},
    )

    assert response.status_code == 422
    assert "Provider base URL" in response.text


def test_settings_are_isolated_per_user_and_encrypted_at_rest():
    user_a, token_a = _register_and_login()
    _, token_b = _register_and_login()
    secret_a = "sk-user-a-secret-1111"
    secret_b = "sk-user-b-secret-2222"

    response_a = client.put(
        "/api/v1/settings/writing-ai",
        headers=_auth(token_a),
        json=_settings_payload(secret_a),
    )
    payload_b = _settings_payload(secret_b)
    payload_b.update(
        {"base_url": "https://other.example.com/v1", "model_name": "other-model"}
    )
    response_b = client.put(
        "/api/v1/settings/writing-ai",
        headers=_auth(token_b),
        json=payload_b,
    )

    assert response_a.status_code == 200
    assert response_b.status_code == 200
    data_a = client.get("/api/v1/settings/writing-ai", headers=_auth(token_a)).json()
    data_b = client.get("/api/v1/settings/writing-ai", headers=_auth(token_b)).json()
    assert data_a["base_url"] == "https://provider.example.com/v1"
    assert data_b["base_url"] == "https://other.example.com/v1"
    assert data_a["api_key_hint"] == "****1111"
    assert data_b["api_key_hint"] == "****2222"

    with SessionLocal() as db:
        row = (
            db.query(UserAIModelSettings)
            .filter(UserAIModelSettings.user_id == user_a["id"])
            .first()
        )
        assert row is not None
        assert row.api_key_encrypted != secret_a
        assert secret_a not in row.api_key_encrypted
        assert decrypt_api_key(row.api_key_encrypted) == secret_a


def test_settings_update_omitted_key_preserves_existing_secret():
    user, token = _register_and_login()
    original_secret = "sk-original-secret-3333"
    save = client.put(
        "/api/v1/settings/writing-ai",
        headers=_auth(token),
        json=_settings_payload(original_secret),
    )
    assert save.status_code == 200

    update = client.put(
        "/api/v1/settings/writing-ai",
        headers=_auth(token),
        json={
            "provider_name": "openai-compatible",
            "base_url": "https://provider.example.com/v2",
            "model_name": "updated-model",
            "json_fallback_enabled": False,
        },
    )

    assert update.status_code == 200
    data = update.json()
    assert data["base_url"] == "https://provider.example.com/v2"
    assert data["model_name"] == "updated-model"
    assert data["json_fallback_enabled"] is False
    assert data["has_api_key"] is True
    assert data["api_key_hint"] == "****3333"

    with SessionLocal() as db:
        row = (
            db.query(UserAIModelSettings)
            .filter(UserAIModelSettings.user_id == user["id"])
            .first()
        )
        assert row is not None
        assert decrypt_api_key(row.api_key_encrypted) == original_secret


def test_settings_update_replaces_existing_api_key():
    user, token = _register_and_login()
    first_secret = "sk-first-secret-4444"
    second_secret = "sk-second-secret-5555"
    first = client.put(
        "/api/v1/settings/writing-ai",
        headers=_auth(token),
        json=_settings_payload(first_secret),
    )
    assert first.status_code == 200
    with SessionLocal() as db:
        before = (
            db.query(UserAIModelSettings)
            .filter(UserAIModelSettings.user_id == user["id"])
            .first()
        )
        assert before is not None
        first_encrypted = before.api_key_encrypted

    second = client.put(
        "/api/v1/settings/writing-ai",
        headers=_auth(token),
        json=_settings_payload(second_secret),
    )

    assert second.status_code == 200
    assert second.json()["api_key_hint"] == "****5555"
    with SessionLocal() as db:
        after = (
            db.query(UserAIModelSettings)
            .filter(UserAIModelSettings.user_id == user["id"])
            .first()
        )
        assert after is not None
        assert after.api_key_encrypted != first_encrypted
        assert decrypt_api_key(after.api_key_encrypted) == second_secret


def test_settings_responses_and_logs_do_not_expose_plaintext_secret(caplog):
    _, token = _register_and_login()
    secret = "sk-never-log-secret-6666"

    response = client.put(
        "/api/v1/settings/writing-ai",
        headers=_auth(token),
        json=_settings_payload(secret),
    )
    read_back = client.get(
        "/api/v1/settings/writing-ai",
        headers=_auth(token),
    )

    assert response.status_code == 200
    assert read_back.status_code == 200
    assert secret not in response.text
    assert secret not in read_back.text
    assert secret not in caplog.text
    assert "api_key_encrypted" not in response.json()

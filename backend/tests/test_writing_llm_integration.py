"""Mocked-client integration tests for raw writing grading."""
from __future__ import annotations

import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.ai_settings import UserAIModelSettings
from app.schemas.writing import RawWritingFeedbackResult
from app.services.ai_service import grade_writing_with_ai
from app.services.llm_provider import (
    WritingLLMProvider,
    LLMMalformedOutputError,
    LLMUnavailableError,
)

client = TestClient(app)

SAMPLE_WRITING = (
    "随着时代的发展，创新成为推动社会进步的重要力量。"
    "我们要坚持以人民为中心的发展思想，不断推进改革创新。"
    "在当前形势下，加强党的建设，提高执政能力，是实现中华民族伟大复兴的关键。"
    "因此，我们必须坚定信心，勇于担当，为人民创造更加美好的生活。"
)

RAW_MARKDOWN = """# 写作反馈结果

## 任务类型判断
analysis。

## 综合评价
观点明确，结构完整，建议补充基层治理案例。
"""


def _register_and_login() -> tuple[dict, str]:
    suffix = uuid.uuid4().hex[:10]
    password = "StrongPass123!"
    payload = {
        "username": f"llm_{suffix}",
        "email": f"llm_{suffix}@example.com",
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


def _save_settings(
    token: str,
    *,
    base_url: str = "https://provider.example.com/v1",
    model_name: str = "writing-model",
    api_key: str = "sk-status-secret-1234",
) -> None:
    response = client.put(
        "/api/v1/settings/writing-ai",
        headers=_auth_headers(token),
        json={
            "provider_name": "openai-compatible",
            "base_url": base_url,
            "model_name": model_name,
            "api_key": api_key,
            "json_fallback_enabled": True,
        },
    )
    assert response.status_code == 200


def _set_status(
    user_id: int,
    *,
    successful_mode: str | None = None,
    failure_classification: str | None = None,
) -> None:
    with SessionLocal() as db:
        row = (
            db.query(UserAIModelSettings)
            .filter(UserAIModelSettings.user_id == user_id)
            .first()
        )
        assert row is not None
        row.last_successful_mode = successful_mode
        row.last_failure_classification = failure_classification
        db.commit()


def _mock_provider_with_raw_output(content: str = RAW_MARKDOWN) -> WritingLLMProvider:
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_message = MagicMock()
    mock_message.refusal = None
    mock_message.content = content
    mock_response.choices = [MagicMock(message=mock_message)]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    provider = WritingLLMProvider(api_key="fake-key", base_url="https://fake.api/v1")
    provider._client = mock_client
    return provider


@pytest.mark.asyncio
async def test_grade_writing_with_ai_uses_raw_llm_output_when_configured():
    provider = _mock_provider_with_raw_output()

    result = await grade_writing_with_ai(SAMPLE_WRITING, task_type="analysis", writing_llm_provider=provider)

    assert isinstance(result, RawWritingFeedbackResult)
    assert result.contentFormat == "markdown"
    assert "综合评价" in result.content
    assert provider._client.chat.completions.create.await_count == 1
    assert provider.get_status_info()["last_successful_mode"] == "raw_text"


@pytest.mark.asyncio
async def test_llm_provider_success_logs_raw_metadata_without_secrets(caplog):
    provider = _mock_provider_with_raw_output()
    caplog.set_level(logging.INFO, logger="app.services.llm_provider")

    result = await provider.grade_writing_raw(SAMPLE_WRITING, task_type="analysis")

    assert "综合评价" in result
    assert "LLM raw grading success" in caplog.text
    assert "acquisition_mode=raw_text" in caplog.text
    assert "content_length=" in caplog.text
    assert "fake-key" not in caplog.text
    assert SAMPLE_WRITING not in caplog.text


@pytest.mark.asyncio
async def test_llm_provider_empty_raw_output_is_classified():
    provider = _mock_provider_with_raw_output("   ")

    with pytest.raises(LLMMalformedOutputError) as exc_info:
        await provider.grade_writing_raw(SAMPLE_WRITING)

    assert exc_info.value.classification == "malformed_output"
    assert provider.get_status_info()["last_failure_classification"] == "malformed_output"


@pytest.mark.asyncio
async def test_grade_writing_with_ai_raises_when_api_key_missing():
    provider = WritingLLMProvider(api_key="")
    assert not provider.is_available()

    with pytest.raises(LLMUnavailableError) as exc_info:
        await grade_writing_with_ai(SAMPLE_WRITING, task_type="analysis", writing_llm_provider=provider)

    assert exc_info.value.classification == "unavailable"


def test_ai_status_requires_authentication():
    response = client.get("/api/v1/writings/ai-status")
    assert response.status_code == 401


def test_ai_status_configured_without_success():
    _, token = _register_and_login()
    _save_settings(token)
    response = client.get("/api/v1/writings/ai-status", headers=_auth_headers(token))
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    assert data["services"]["writing_feedback"] == "unverified"
    cap = data.get("capability", {})
    assert cap.get("configured") is True
    assert cap.get("last_successful_mode") is None


def test_ai_status_after_raw_success():
    user, token = _register_and_login()
    _save_settings(token)
    _set_status(user["id"], successful_mode="raw_text")
    response = client.get("/api/v1/writings/ai-status", headers=_auth_headers(token))
    assert response.status_code == 200
    data = response.json()
    assert data["services"]["writing_feedback"] == "available"
    assert data["capability"]["last_successful_mode"] == "raw_text"


def test_ai_status_after_failure():
    user, token = _register_and_login()
    _save_settings(token)
    _set_status(user["id"], failure_classification="malformed_output")
    response = client.get("/api/v1/writings/ai-status", headers=_auth_headers(token))
    assert response.status_code == 200
    data = response.json()
    assert data["services"]["writing_feedback"] == "error"
    assert data["capability"]["last_failure_classification"] == "malformed_output"


def test_two_users_grade_with_independent_provider_settings_and_metadata():
    user_a, token_a = _register_and_login()
    user_b, token_b = _register_and_login()
    _save_settings(
        token_a,
        base_url="https://provider-a.example.com/v1",
        model_name="model-a",
        api_key="sk-user-a-1111",
    )
    _save_settings(
        token_b,
        base_url="https://provider-b.example.com/v1",
        model_name="model-b",
        api_key="sk-user-b-2222",
    )

    def _build_provider(row):
        content = RAW_MARKDOWN.replace("analysis", row.model_name)
        provider = _mock_provider_with_raw_output(content)
        provider.model_name = row.model_name
        provider.base_url = row.base_url
        return provider

    def _grade(token: str):
        return client.post(
            "/api/v1/writings/grade",
            json={"content": SAMPLE_WRITING, "task_type": "analysis"},
            headers=_auth_headers(token),
        )

    with patch(
        "app.services.user_ai_settings_service.build_provider_from_settings",
        side_effect=_build_provider,
    ):
        with ThreadPoolExecutor(max_workers=2) as executor:
            response_a, response_b = list(executor.map(_grade, [token_a, token_b]))

    assert response_a.status_code == 200
    assert response_b.status_code == 200
    assert response_a.json()["contentFormat"] == "markdown"
    assert response_b.json()["contentFormat"] == "markdown"
    assert "model-a" in response_a.json()["content"]
    assert "model-b" in response_b.json()["content"]

    status_a = client.get("/api/v1/writings/ai-status", headers=_auth_headers(token_a))
    status_b = client.get("/api/v1/writings/ai-status", headers=_auth_headers(token_b))
    assert status_a.json()["model"] == "model-a"
    assert status_b.json()["model"] == "model-b"
    assert status_a.json()["capability"]["last_successful_mode"] == "raw_text"
    assert status_b.json()["capability"]["last_successful_mode"] == "raw_text"

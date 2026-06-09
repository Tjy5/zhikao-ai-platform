"""Regression coverage for raw writing grading endpoints."""
from __future__ import annotations

import json
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.llm_provider import WritingLLMProvider

client = TestClient(app)

SAMPLE_WRITING = {
    "content": (
        "随着时代的发展，创新成为推动社会进步的重要力量。"
        "我们要坚持以人民为中心的发展思想，不断推进改革创新。"
        "在当前形势下，加强党的建设，提高执政能力，是实现中华民族伟大复兴的关键。"
        "因此，我们必须坚定信心，勇于担当，为人民创造更加美好的生活。"
    ),
    "task_type": "analysis",
}

RAW_MARKDOWN = """# 写作反馈结果

## 任务类型判断
analysis。

## 综合评价
观点明确，结构完整，建议补充基层治理案例。
"""


def _auth_headers() -> dict[str, str]:
    suffix = uuid.uuid4().hex[:10]
    password = "StrongPass123!"
    payload = {
        "username": f"writing_{suffix}",
        "email": f"writing_{suffix}@example.com",
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
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _register_and_login() -> dict[str, str]:
    return _auth_headers()


def _mock_provider(content: str = RAW_MARKDOWN) -> MagicMock:
    provider = MagicMock()
    provider.grade_writing_raw = AsyncMock(return_value=content)
    provider.get_status_info.return_value = {"last_successful_mode": "raw_text"}
    return provider


def _collect_sse_events(response) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for line in response.iter_lines():
        if isinstance(line, bytes):
            line = line.decode("utf-8", errors="replace")
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


def _assert_raw_payload(data: dict[str, Any]) -> None:
    assert data["contentFormat"] == "markdown"
    assert "综合评价" in data["content"]
    assert "score" not in data
    assert "feedback" not in data
    assert "suggestions" not in data
    assert "scoreDetails" not in data
    assert "taskType" not in data
    assert "taskTypeSource" not in data


def test_grade_endpoint_response_shape():
    headers = _auth_headers()
    with patch(
        "app.api.endpoints.writing.resolve_user_writing_provider",
        return_value=(_mock_provider(), None),
    ):
        response = client.post("/api/v1/writings/grade", json=SAMPLE_WRITING, headers=headers)
    assert response.status_code == 200
    _assert_raw_payload(response.json())


def test_grade_endpoint_requires_authentication():
    response = client.post("/api/v1/writings/grade", json=SAMPLE_WRITING)
    assert response.status_code == 401


def test_grade_endpoint_persists_raw_history():
    headers = _auth_headers()

    with patch(
        "app.api.endpoints.writing.resolve_user_writing_provider",
        return_value=(_mock_provider(), None),
    ):
        response = client.post("/api/v1/writings/grade", json=SAMPLE_WRITING, headers=headers)
    assert response.status_code == 200

    history = client.get("/api/v1/writings/history", params={"limit": 1}, headers=headers)
    assert history.status_code == 200
    item = history.json()["items"][0]
    assert item["type"] == "grade"
    assert item["taskType"] == "analysis"
    assert item["contentFormat"] == "markdown"
    assert "综合评价" in item["content"]
    assert item["score"] is None

    detail = client.get(f"/api/v1/writings/history/{item['id']}", headers=headers)
    assert detail.status_code == 200
    _assert_raw_payload(detail.json()["response"])


def test_grade_progressive_endpoint_emits_single_final_raw_event():
    headers = _auth_headers()
    with patch(
        "app.api.endpoints.writing.resolve_user_writing_provider",
        return_value=(_mock_provider(), None),
    ):
        response = client.post(
            "/api/v1/writings/grade-progressive",
            json=SAMPLE_WRITING,
            headers=headers,
        )
    assert response.status_code == 200

    events = _collect_sse_events(response)
    assert len(events) == 1
    final_event = events[0]
    assert final_event["stage"] == 2
    assert final_event["progress"] == 100
    assert final_event["partial"] is False
    _assert_raw_payload(final_event)


def test_ai_status_requires_authentication():
    response = client.get("/api/v1/writings/ai-status")
    assert response.status_code == 401


def test_history_isolated_per_user():
    headers_a = _register_and_login()
    headers_b = _register_and_login()

    with patch(
        "app.api.endpoints.writing.resolve_user_writing_provider",
        return_value=(_mock_provider(), None),
    ):
        grade_a = client.post("/api/v1/writings/grade", json=SAMPLE_WRITING, headers=headers_a)
        grade_b = client.post("/api/v1/writings/grade", json=SAMPLE_WRITING, headers=headers_b)
    assert grade_a.status_code == 200
    assert grade_b.status_code == 200

    list_a = client.get("/api/v1/writings/history", headers=headers_a)
    list_b = client.get("/api/v1/writings/history", headers=headers_b)
    assert list_a.status_code == 200
    assert list_b.status_code == 200

    item_a = list_a.json()["items"][0]
    item_b = list_b.json()["items"][0]
    assert item_a["id"] != item_b["id"]

    cross_detail = client.get(
        f"/api/v1/writings/history/{item_b['id']}",
        headers=headers_a,
    )
    assert cross_detail.status_code == 404

    clear_a = client.delete("/api/v1/writings/history", headers=headers_a)
    assert clear_a.status_code == 200
    assert clear_a.json()["deleted"] >= 1

    after_b = client.get("/api/v1/writings/history", headers=headers_b)
    assert after_b.status_code == 200
    assert len(after_b.json()["items"]) >= 1


def test_grade_endpoint_missing_provider_settings_fails_closed():
    headers = _auth_headers()
    mock_provider = WritingLLMProvider(api_key="")

    with patch(
        "app.api.endpoints.writing.resolve_user_writing_provider",
        return_value=(mock_provider, None),
    ):
        response = client.post("/api/v1/writings/grade", json=SAMPLE_WRITING, headers=headers)

    assert response.status_code == 503
    data = response.json()
    assert data["detail"]["classification"] == "unavailable"
    assert "content" not in data

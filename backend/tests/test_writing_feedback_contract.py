"""Regression coverage for the raw AI-only writing grading service contract."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.writing import RawWritingFeedbackResult
from app.services.ai_service import grade_writing_with_ai
from app.services.llm_provider import (
    WritingLLMProvider,
    LLMMalformedOutputError,
    LLMUnavailableError,
)


SAMPLE_WRITING = """
随着时代的发展，创新成为推动社会进步的重要力量。
我们要坚持以人民为中心的发展思想，不断推进改革创新。
在当前形势下，加强党的建设，提高执政能力，是实现中华民族伟大复兴的关键。
因此，我们必须坚定信心，勇于担当，为人民创造更加美好的生活。
"""

RAW_MARKDOWN = """# 写作反馈结果

## 任务类型判断
analysis。

## 综合评价
文章立意明确，结构完整，但案例支撑仍可加强。
"""


def _mock_provider_with_raw_output(content: str = RAW_MARKDOWN) -> MagicMock:
    provider = MagicMock()
    provider.grade_writing_raw = AsyncMock(return_value=content)
    provider.get_status_info.return_value = {"last_successful_mode": "raw_text"}
    return provider


@pytest.mark.asyncio
async def test_grade_writing_returns_raw_active_schema_fields():
    provider = _mock_provider_with_raw_output()

    result = await grade_writing_with_ai(
        SAMPLE_WRITING,
        task_type="analysis",
        writing_llm_provider=provider,
    )

    assert isinstance(result, RawWritingFeedbackResult)
    assert result.contentFormat == "markdown"
    assert "综合评价" in result.content
    payload = result.model_dump()
    assert set(payload) == {"content", "contentFormat"}
    assert "score" not in payload
    assert "feedback" not in payload
    assert "suggestions" not in payload
    assert "scoreDetails" not in payload
    provider.grade_writing_raw.assert_awaited_once_with(SAMPLE_WRITING, "analysis")


@pytest.mark.asyncio
async def test_grade_writing_with_unavailable_provider_fails_closed():
    provider = WritingLLMProvider(api_key="")

    with pytest.raises(LLMUnavailableError) as exc_info:
        await grade_writing_with_ai(
            SAMPLE_WRITING,
            task_type="analysis",
            writing_llm_provider=provider,
        )

    assert exc_info.value.classification == "unavailable"


@pytest.mark.asyncio
async def test_grade_writing_empty_provider_output_fails_closed():
    provider = _mock_provider_with_raw_output()
    provider.grade_writing_raw = AsyncMock(
        side_effect=LLMMalformedOutputError("Raw grading returned empty content")
    )

    with pytest.raises(LLMMalformedOutputError) as exc_info:
        await grade_writing_with_ai(
            SAMPLE_WRITING,
            task_type="analysis",
            writing_llm_provider=provider,
        )

    assert exc_info.value.classification == "malformed_output"

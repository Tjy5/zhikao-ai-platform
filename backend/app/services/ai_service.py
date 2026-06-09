"""
AI服务模块 - 重构版本
统一入口，集成各个专业AI服务
"""

import logging
from typing import Optional

from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.ai_settings import UserAIModelSettings
from ..schemas.writing import RawWritingFeedbackResult
from .llm_provider import (
    WritingLLMProvider,
    LLMProviderError,
)
from .user_ai_settings_service import get_user_ai_settings

logger = logging.getLogger(__name__)

# Lazy-initialized provider instance
_writing_llm_provider: Optional[WritingLLMProvider] = None


def _get_writing_llm_provider() -> WritingLLMProvider:
    """获取或创建 WritingLLMProvider 实例（延迟初始化）"""
    global _writing_llm_provider
    if _writing_llm_provider is None:
        _writing_llm_provider = WritingLLMProvider()
    return _writing_llm_provider


# ===== 主要服务函数 =====

async def grade_writing_with_ai(
    writing_content: str,
    task_type: Optional[str] = None,
    writing_llm_provider: Optional[WritingLLMProvider] = None,
) -> RawWritingFeedbackResult:
    """
    AI写作评分 - 使用 LLM provider，失败时抛出分类错误

    Args:
        writing_content: 写作内容
        task_type: 任务类型（可选）

    Returns:
        原始 Markdown 评分结果
    """
    provider = writing_llm_provider or _get_writing_llm_provider()
    try:
        raw_content = await provider.grade_writing_raw(writing_content, task_type)
        acquisition_mode = provider.get_status_info().get("last_successful_mode", "unknown")
        logger.info(
            "LLM raw grading result used acquisition_mode=%s content_length=%d",
            acquisition_mode,
            len(raw_content),
        )
        return RawWritingFeedbackResult(content=raw_content, contentFormat="markdown")
    except LLMProviderError:
        raise
    except Exception as e:
        logger.error(f"LLM grading unexpected error: {e}")
        raise LLMProviderError(str(e), "unknown")


# ===== 工具函数 =====

def get_ai_service_status() -> dict:
    """
    获取AI服务状态（反映真实 provider 可用性和已验证的 grading capability，不暴露密钥）

    Returns:
        服务状态信息，区分 configured / verified / unavailable 状态
    """
    provider = _get_writing_llm_provider()
    provider_info = provider.get_status_info()

    if not provider.is_available():
        return {
            "status": "unavailable",
            "reason": "OPENAI_API_KEY is not configured",
            "services": {
                "task_type_detection": "unavailable",
                "writing_feedback": "unavailable",
                "text_processing": "available"
            },
            "model": None,
            "version": "2.0.0",
            "capability": None,
        }

    is_configured = provider_info.get("configured", False)
    last_successful_mode = provider_info.get("last_successful_mode")
    last_failure_classification = provider_info.get("last_failure_classification")
    json_fallback_enabled = provider_info.get("json_fallback_enabled", True)

    # Determine verified writing grading capability
    if last_successful_mode in ("structured_output", "json_fallback", "raw_text"):
        writing_feedback_status = "available"
    elif is_configured and not last_successful_mode:
        writing_feedback_status = "unverified"
    elif last_failure_classification:
        writing_feedback_status = "error"
    else:
        writing_feedback_status = "unverified"

    return {
        "status": "active",
        "services": {
            "task_type_detection": writing_feedback_status,
            "writing_feedback": writing_feedback_status,
            "text_processing": "available"
        },
        "model": provider_info.get("model"),
        "version": "2.0.0",
        "capability": {
            "configured": is_configured,
            "last_successful_mode": last_successful_mode,
            "last_failure_classification": last_failure_classification if not last_successful_mode else None,
            "json_fallback_enabled": json_fallback_enabled,
        },
    }


def _build_user_ai_status_payload(
    settings_row: Optional[UserAIModelSettings],
) -> dict:
    if settings_row is None or not settings_row.api_key_encrypted:
        return {
            "status": "unavailable",
            "reason": "User provider API key is not configured",
            "services": {
                "task_type_detection": "unavailable",
                "writing_feedback": "unavailable",
                "text_processing": "available",
            },
            "model": settings_row.model_name if settings_row is not None else None,
            "base_url": settings_row.base_url if settings_row is not None else None,
            "version": "2.0.0",
            "capability": {
                "configured": False,
                "last_successful_mode": None,
                "last_failure_classification": "unavailable",
                "json_fallback_enabled": (
                    settings_row.json_fallback_enabled
                    if settings_row is not None
                    else True
                ),
            },
        }

    last_successful_mode = settings_row.last_successful_mode
    last_failure_classification = settings_row.last_failure_classification
    if last_successful_mode in ("structured_output", "json_fallback", "raw_text"):
        writing_feedback_status = "available"
    elif last_failure_classification:
        writing_feedback_status = "error"
    else:
        writing_feedback_status = "unverified"

    return {
        "status": "active",
        "services": {
            "task_type_detection": writing_feedback_status,
            "writing_feedback": writing_feedback_status,
            "text_processing": "available",
        },
        "model": settings_row.model_name,
        "base_url": settings_row.base_url,
        "version": "2.0.0",
        "capability": {
            "configured": True,
            "last_successful_mode": last_successful_mode,
            "last_failure_classification": (
                last_failure_classification if not last_successful_mode else None
            ),
            "json_fallback_enabled": settings_row.json_fallback_enabled,
        },
    }


def get_user_ai_service_status(db: Session, user_id: int) -> dict:
    """Return user-scoped AI status without making provider calls."""
    return _build_user_ai_status_payload(get_user_ai_settings(db, user_id))


__all__ = [
    "grade_writing_with_ai",
    "get_ai_service_status",
    "get_user_ai_service_status",
]

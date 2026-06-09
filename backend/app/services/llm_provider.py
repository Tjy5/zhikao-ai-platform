"""
OpenAI-compatible LLM provider wrapper for writing grading.
Provides timeout, retry, error classification, and raw text generation.
"""

import logging
import time
from typing import Any, Dict, Optional

from openai import AsyncOpenAI, APIError, AuthenticationError, APITimeoutError
from pydantic import ValidationError

from ..core.config import settings
from .writing_prompt_builder import (
    build_raw_grading_system_prompt,
    build_raw_grading_user_prompt,
)

logger = logging.getLogger(__name__)


class LLMProviderError(Exception):
    """LLM provider 错误基类"""
    def __init__(self, message: str, classification: str):
        super().__init__(message)
        self.classification = classification


class LLMUnavailableError(LLMProviderError):
    def __init__(self, message: str = "LLM provider is unavailable"):
        super().__init__(message, "unavailable")


class LLMTimeoutError(LLMProviderError):
    def __init__(self, message: str = "Provider request timed out"):
        super().__init__(message, "timeout")


class LLMAuthError(LLMProviderError):
    def __init__(self, message: str = "Provider authentication failed"):
        super().__init__(message, "authentication")


class LLMRefusalError(LLMProviderError):
    def __init__(self, message: str = "Provider refused or filtered content"):
        super().__init__(message, "refusal")


class LLMMalformedOutputError(LLMProviderError):
    def __init__(self, message: str = "Provider returned malformed output"):
        super().__init__(message, "malformed_output")


class LLMRateLimitError(LLMProviderError):
    def __init__(self, message: str = "Provider rate limit exceeded"):
        super().__init__(message, "rate_limit")


class WritingLLMProvider:
    """OpenAI-compatible 写作评分 LLM provider — raw text generation only."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        json_fallback_enabled: Optional[bool] = None,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
    ):
        self.api_key = settings.OPENAI_API_KEY if api_key is None else api_key
        self.base_url = settings.OPENAI_API_BASE if base_url is None else base_url
        self.model_name = settings.OPENAI_MODEL_NAME if model_name is None else model_name
        self._json_fallback_enabled = json_fallback_enabled
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self._client: Optional[AsyncOpenAI] = None

        # Acquisition mode tracking
        self._last_successful_mode: Optional[str] = None
        self._last_failure_classification: Optional[str] = None
        self._last_validation_status: Optional[str] = None
        self._structured_attempted: bool = False
        self._json_fallback_attempted: bool = False
        self._raw_text_attempted: bool = False

        if self.api_key:
            self._client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
                timeout=self.timeout_seconds,
            )

    @property
    def json_fallback_enabled(self) -> bool:
        """Whether JSON fallback is enabled for this provider."""
        if self._json_fallback_enabled is not None:
            return self._json_fallback_enabled
        val = getattr(settings, "WRITING_LLM_JSON_FALLBACK", "true")
        if isinstance(val, bool):
            return val
        return str(val).lower() in ("true", "1", "yes")

    def is_available(self) -> bool:
        """Provider 是否可用（已配置 API key）"""
        return self._client is not None and bool(self.api_key)

    async def list_models(self) -> list[Dict[str, Any]]:
        """Return safe model metadata from the provider models endpoint."""
        if not self.is_available():
            raise LLMUnavailableError()

        try:
            discovered_models: list[Dict[str, Any]] = []
            async for model in self._client.models.list(timeout=self.timeout_seconds):
                discovered_models.append(
                    {
                        "id": getattr(model, "id", ""),
                        "created": getattr(model, "created", None),
                        "object": getattr(model, "object", None),
                        "owned_by": getattr(model, "owned_by", None),
                    }
                )
            logger.info(
                "Provider model discovery success base_url=%s count=%d",
                self.base_url,
                len(discovered_models),
            )
            return discovered_models
        except APITimeoutError as e:
            logger.warning("Provider model discovery timeout base_url=%s", self.base_url)
            raise LLMTimeoutError(str(e))
        except AuthenticationError as e:
            logger.warning(
                "Provider model discovery authentication failed base_url=%s",
                self.base_url,
            )
            raise LLMAuthError(str(e))
        except APIError as e:
            if hasattr(e, "status_code") and e.status_code == 429:
                classification = "rate_limit"
                provider_error = LLMRateLimitError(str(e))
            else:
                classification = "provider_error"
                provider_error = LLMProviderError(str(e), classification)
            logger.warning(
                "Provider model discovery API error base_url=%s classification=%s",
                self.base_url,
                classification,
            )
            raise provider_error
        except LLMProviderError:
            raise
        except Exception as e:
            logger.warning(
                "Provider model discovery unexpected error base_url=%s: %s",
                self.base_url,
                e,
            )
            raise LLMProviderError(str(e), "unknown")

    async def grade_writing_raw(
        self,
        writing_content: str,
        task_type: Optional[str] = None,
    ) -> str:
        """Generate raw Markdown grading content for writing submissions.

        This path performs a single provider text-generation call and accepts
        only non-empty provider-authored content.
        """
        if not self.is_available():
            self._last_failure_classification = "unavailable"
            raise LLMUnavailableError()

        self._structured_attempted = False
        self._json_fallback_attempted = False
        self._raw_text_attempted = True
        self._last_successful_mode = None
        self._last_validation_status = None

        system_prompt = build_raw_grading_system_prompt()
        user_prompt = build_raw_grading_user_prompt(writing_content, task_type)

        start_time = time.time()
        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                timeout=self.timeout_seconds,
            )
            elapsed = time.time() - start_time

            message = response.choices[0].message
            if message.refusal:
                self._last_failure_classification = "refusal"
                self._last_validation_status = "validation_failed"
                raise LLMRefusalError(f"Model refused raw grading: {message.refusal}")

            raw_content = message.content if isinstance(message.content, str) else ""
            content = raw_content.strip()
            if not content:
                self._last_failure_classification = "malformed_output"
                self._last_validation_status = "validation_failed"
                raise LLMMalformedOutputError("Raw grading returned empty content")

            self._last_successful_mode = "raw_text"
            self._last_validation_status = "content_validated"
            self._last_failure_classification = None
            logger.info(
                "LLM raw grading success model=%s elapsed=%.3fs acquisition_mode=raw_text "
                "validation_status=content_validated content_length=%d",
                self.model_name,
                elapsed,
                len(content),
            )
            return content
        except APITimeoutError as e:
            self._last_failure_classification = "timeout"
            self._last_validation_status = "provider_error"
            raise LLMTimeoutError(str(e))
        except AuthenticationError as e:
            self._last_failure_classification = "authentication"
            self._last_validation_status = "provider_error"
            raise LLMAuthError(str(e))
        except APIError as e:
            if hasattr(e, "status_code") and e.status_code == 429:
                self._last_failure_classification = "rate_limit"
                self._last_validation_status = "provider_error"
                raise LLMRateLimitError(str(e))
            self._last_failure_classification = "provider_error"
            self._last_validation_status = "provider_error"
            raise LLMProviderError(str(e), "provider_error")
        except ValidationError as e:
            self._last_failure_classification = "malformed_output"
            self._last_validation_status = "validation_failed"
            raise LLMMalformedOutputError(str(e))
        except LLMProviderError:
            raise
        except Exception as e:
            self._last_failure_classification = "unknown"
            self._last_validation_status = "provider_error"
            raise LLMProviderError(str(e), "unknown")

    def get_status_info(self) -> dict:
        """返回非敏感的 provider 状态信息，包含 capability 元数据"""
        available = self.is_available()
        info: Dict[str, Any] = {
            "configured": bool(self.api_key),
            "available": available,
            "model": self.model_name if available else None,
            "base_url": self.base_url if available else None,
            "json_fallback_enabled": self.json_fallback_enabled,
            "last_successful_mode": self._last_successful_mode,
            "last_failure_classification": self._last_failure_classification,
            "last_validation_status": self._last_validation_status,
            "acquisition_modes": {
                "structured_output": self._structured_attempted,
                "json_fallback": self._json_fallback_attempted,
                "raw_text": self._raw_text_attempted,
            },
        }
        return info

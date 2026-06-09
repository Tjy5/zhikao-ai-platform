import base64
import hashlib
from datetime import datetime
from typing import Any, Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ai_settings import UserAIModelSettings
from app.schemas.ai_settings import (
    WritingAIModelDiscoveryRequest,
    WritingAISettingsResponse,
    WritingAISettingsUpdate,
    ProviderModelInfo,
    ProviderModelsResponse,
    ProviderTestResponse,
)
from app.services.llm_provider import WritingLLMProvider, LLMProviderError


DEFAULT_PROVIDER_NAME = "openai-compatible"
DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL_NAME = "gpt-4o-mini"
_PROVIDER_CACHE: dict[tuple[int, int, str], WritingLLMProvider] = {}


def _fernet() -> Fernet:
    secret = settings.MODEL_SETTINGS_ENCRYPTION_KEY or settings.APP_SECRET_KEY
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_api_key(api_key: str) -> str:
    value = api_key.strip()
    if not value:
        raise ValueError("API key cannot be empty")
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_api_key(encrypted_api_key: Optional[str]) -> Optional[str]:
    if not encrypted_api_key:
        return None
    try:
        return _fernet().decrypt(encrypted_api_key.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Stored API key cannot be decrypted") from exc


def mask_api_key(api_key: str) -> str:
    value = api_key.strip()
    if not value:
        return ""
    suffix = value[-4:] if len(value) >= 4 else value
    return "****" + suffix


def get_user_ai_settings(
    db: Session,
    user_id: int,
) -> Optional[UserAIModelSettings]:
    return (
        db.query(UserAIModelSettings)
        .filter(UserAIModelSettings.user_id == user_id)
        .first()
    )


def _normalize_update(payload: WritingAISettingsUpdate) -> dict:
    provider_name = payload.provider_name.strip() or DEFAULT_PROVIDER_NAME
    base_url = payload.base_url.strip() or DEFAULT_BASE_URL
    model_name = payload.model_name.strip() or DEFAULT_MODEL_NAME
    if not base_url.startswith(("http://", "https://")):
        raise ValueError("Provider base URL must start with http:// or https://")
    return {
        "provider_name": provider_name,
        "base_url": base_url.rstrip("/"),
        "model_name": model_name,
        "json_fallback_enabled": payload.json_fallback_enabled,
    }


def _normalize_provider_base_url(base_url: str) -> str:
    value = base_url.strip()
    if not value.startswith(("http://", "https://")):
        raise ValueError("Provider base URL must start with http:// or https://")
    return value.rstrip("/")


def _resolve_discovery_base_url(
    settings_row: Optional[UserAIModelSettings],
    override_base_url: Optional[str],
) -> str:
    if override_base_url is not None and override_base_url.strip():
        return _normalize_provider_base_url(override_base_url)
    if settings_row is not None:
        return _normalize_provider_base_url(settings_row.base_url)
    return DEFAULT_BASE_URL


def _resolve_discovery_api_key(
    settings_row: Optional[UserAIModelSettings],
    override_api_key: Optional[str],
) -> Optional[str]:
    if override_api_key is not None and override_api_key.strip():
        return override_api_key.strip()
    if settings_row is None or not settings_row.api_key_encrypted:
        return None
    decrypted = decrypt_api_key(settings_row.api_key_encrypted)
    return decrypted.strip() if decrypted else None


def _models_to_response_items(
    raw_models: list[dict[str, Any]],
) -> list[ProviderModelInfo]:
    items = [
        ProviderModelInfo(
            id=str(model.get("id", "")).strip(),
            created=model.get("created"),
            object=model.get("object"),
            owned_by=model.get("owned_by"),
        )
        for model in raw_models
        if str(model.get("id", "")).strip()
    ]
    return sorted(items, key=lambda model: model.id.lower())


def settings_to_response(
    settings_row: Optional[UserAIModelSettings],
) -> WritingAISettingsResponse:
    if settings_row is None:
        return WritingAISettingsResponse(
            provider_name=DEFAULT_PROVIDER_NAME,
            base_url=DEFAULT_BASE_URL,
            model_name=DEFAULT_MODEL_NAME,
            json_fallback_enabled=True,
            has_api_key=False,
        )

    return WritingAISettingsResponse(
        id=settings_row.id,
        provider_name=settings_row.provider_name,
        base_url=settings_row.base_url,
        model_name=settings_row.model_name,
        json_fallback_enabled=settings_row.json_fallback_enabled,
        has_api_key=bool(settings_row.api_key_encrypted),
        api_key_hint=settings_row.api_key_hint,
        last_test_status=settings_row.last_test_status,
        last_tested_at=settings_row.last_tested_at,
        last_failure_classification=settings_row.last_failure_classification,
        last_successful_mode=settings_row.last_successful_mode,
    )


def read_user_ai_settings(
    db: Session,
    user_id: int,
) -> WritingAISettingsResponse:
    return settings_to_response(get_user_ai_settings(db, user_id))


def upsert_user_ai_settings(
    db: Session,
    user_id: int,
    payload: WritingAISettingsUpdate,
) -> UserAIModelSettings:
    values = _normalize_update(payload)
    settings_row = get_user_ai_settings(db, user_id)
    if settings_row is None:
        settings_row = UserAIModelSettings(user_id=user_id)
        db.add(settings_row)

    settings_row.provider_name = values["provider_name"]
    settings_row.base_url = values["base_url"]
    settings_row.model_name = values["model_name"]
    settings_row.json_fallback_enabled = values["json_fallback_enabled"]
    settings_row.updated_at = datetime.utcnow()

    if payload.api_key is not None and payload.api_key.strip():
        api_key = payload.api_key.strip()
        settings_row.api_key_encrypted = encrypt_api_key(api_key)
        settings_row.api_key_hint = mask_api_key(api_key)
        settings_row.last_test_status = None
        settings_row.last_tested_at = None
        settings_row.last_failure_classification = None
        settings_row.last_successful_mode = None

    db.commit()
    db.refresh(settings_row)
    return settings_row


def build_provider_from_settings(
    settings_row: UserAIModelSettings,
) -> WritingLLMProvider:
    api_key = decrypt_api_key(settings_row.api_key_encrypted)
    return WritingLLMProvider(
        api_key=api_key or "",
        base_url=settings_row.base_url,
        model_name=settings_row.model_name,
        json_fallback_enabled=settings_row.json_fallback_enabled,
    )


def resolve_user_writing_provider(
    db: Session,
    user_id: int,
) -> tuple[WritingLLMProvider, Optional[UserAIModelSettings]]:
    settings_row = get_user_ai_settings(db, user_id)
    if settings_row is None or not settings_row.api_key_encrypted:
        return (
            WritingLLMProvider(
                api_key="",
                base_url=(
                    settings_row.base_url if settings_row is not None else DEFAULT_BASE_URL
                ),
                model_name=(
                    settings_row.model_name if settings_row is not None else DEFAULT_MODEL_NAME
                ),
                json_fallback_enabled=(
                    settings_row.json_fallback_enabled
                    if settings_row is not None
                    else True
                ),
            ),
            settings_row,
        )

    version = (
        settings_row.updated_at.isoformat()
        if settings_row.updated_at is not None
        else "unversioned"
    )
    cache_key = (user_id, settings_row.id, version)
    provider = _PROVIDER_CACHE.get(cache_key)
    if provider is None:
        provider = build_provider_from_settings(settings_row)
        _PROVIDER_CACHE[cache_key] = provider
    return provider, settings_row


def record_provider_status(
    db: Session,
    settings_row: Optional[UserAIModelSettings],
    provider: WritingLLMProvider,
) -> None:
    if settings_row is None:
        return
    provider_info = provider.get_status_info()
    settings_row.last_tested_at = datetime.utcnow()
    settings_row.last_successful_mode = provider_info.get("last_successful_mode")
    settings_row.last_failure_classification = provider_info.get(
        "last_failure_classification"
    )
    settings_row.last_test_status = (
        "succeeded" if settings_row.last_successful_mode else "failed"
    )
    db.commit()


async def test_user_ai_provider(
    db: Session,
    user_id: int,
) -> ProviderTestResponse:
    settings_row = get_user_ai_settings(db, user_id)
    if settings_row is None or not settings_row.api_key_encrypted:
        return ProviderTestResponse(
            status="unavailable",
            configured=False,
            last_failure_classification="unavailable",
            message="Provider API key is not configured",
        )

    provider = build_provider_from_settings(settings_row)
    try:
        await provider.grade_writing_raw(
            "围绕公共服务提质增效，简要论述数字治理的重要意义。",
            task_type="analysis",
        )
    except LLMProviderError as exc:
        provider_info = provider.get_status_info()
        settings_row.last_test_status = "failed"
        settings_row.last_tested_at = datetime.utcnow()
        settings_row.last_failure_classification = (
            provider_info.get("last_failure_classification") or exc.classification
        )
        settings_row.last_successful_mode = None
        db.commit()
        return ProviderTestResponse(
            status="failed",
            configured=True,
            model=settings_row.model_name,
            base_url=settings_row.base_url,
            last_failure_classification=settings_row.last_failure_classification,
            message="Provider test failed",
        )

    provider_info = provider.get_status_info()
    settings_row.last_test_status = "succeeded"
    settings_row.last_tested_at = datetime.utcnow()
    settings_row.last_failure_classification = None
    settings_row.last_successful_mode = provider_info.get("last_successful_mode")
    db.commit()
    return ProviderTestResponse(
        status="succeeded",
        configured=True,
        model=settings_row.model_name,
        base_url=settings_row.base_url,
        last_successful_mode=settings_row.last_successful_mode,
        message="Provider test succeeded",
    )


async def discover_user_ai_models(
    db: Session,
    user_id: int,
    payload: WritingAIModelDiscoveryRequest,
) -> ProviderModelsResponse:
    settings_row = get_user_ai_settings(db, user_id)
    base_url = _resolve_discovery_base_url(settings_row, payload.base_url)
    try:
        api_key = _resolve_discovery_api_key(settings_row, payload.api_key)
    except ValueError:
        return ProviderModelsResponse(
            status="failed",
            configured=False,
            base_url=base_url,
            last_failure_classification="provider_error",
            message="Stored API key cannot be decrypted",
        )

    if not api_key:
        return ProviderModelsResponse(
            status="unavailable",
            configured=False,
            base_url=base_url,
            last_failure_classification="unavailable",
            message="Provider API key is not configured",
        )

    provider = WritingLLMProvider(
        api_key=api_key,
        base_url=base_url,
        model_name=(
            settings_row.model_name if settings_row is not None else DEFAULT_MODEL_NAME
        ),
        json_fallback_enabled=(
            settings_row.json_fallback_enabled if settings_row is not None else True
        ),
    )
    try:
        raw_models = await provider.list_models()
    except LLMProviderError as exc:
        return ProviderModelsResponse(
            status="failed",
            configured=True,
            base_url=base_url,
            last_failure_classification=exc.classification,
            message="Model discovery failed",
        )

    models = _models_to_response_items(raw_models)
    return ProviderModelsResponse(
        status="succeeded",
        configured=True,
        base_url=base_url,
        model_count=len(models),
        models=models,
        message="Model discovery succeeded",
    )

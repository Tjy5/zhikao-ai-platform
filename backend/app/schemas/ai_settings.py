from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class WritingAISettingsUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    provider_name: str = Field(
        default="openai-compatible",
        min_length=1,
        max_length=64,
    )
    base_url: str = Field(
        default="https://api.openai.com/v1",
        min_length=1,
        max_length=512,
    )
    model_name: str = Field(default="gpt-4o-mini", min_length=1, max_length=128)
    api_key: Optional[str] = Field(default=None, max_length=4096)
    json_fallback_enabled: bool = True


class WritingAIModelDiscoveryRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    base_url: Optional[str] = Field(default=None, max_length=512)
    api_key: Optional[str] = Field(default=None, max_length=4096)


class WritingAISettingsResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: Optional[int] = None
    provider_name: str
    base_url: str
    model_name: str
    json_fallback_enabled: bool
    has_api_key: bool
    api_key_hint: Optional[str] = None
    last_test_status: Optional[str] = None
    last_tested_at: Optional[datetime] = None
    last_failure_classification: Optional[str] = None
    last_successful_mode: Optional[str] = None


class ProviderModelInfo(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    created: Optional[int] = None
    object: Optional[str] = None
    owned_by: Optional[str] = None


class ProviderModelsResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: str
    configured: bool
    base_url: Optional[str] = None
    model_count: int = 0
    models: list[ProviderModelInfo] = Field(default_factory=list)
    last_failure_classification: Optional[str] = None
    message: str


class ProviderTestResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: str
    configured: bool
    model: Optional[str] = None
    base_url: Optional[str] = None
    last_successful_mode: Optional[str] = None
    last_failure_classification: Optional[str] = None
    message: str

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.ai_settings import (
    WritingAIModelDiscoveryRequest,
    WritingAISettingsResponse,
    WritingAISettingsUpdate,
    ProviderModelsResponse,
    ProviderTestResponse,
)
from app.services.user_ai_settings_service import (
    discover_user_ai_models,
    read_user_ai_settings,
    settings_to_response,
    test_user_ai_provider,
    upsert_user_ai_settings,
)


router = APIRouter()


@router.get("/settings/writing-ai", response_model=WritingAISettingsResponse)
def read_writing_ai_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAISettingsResponse:
    return read_user_ai_settings(db, current_user.id)


@router.put("/settings/writing-ai", response_model=WritingAISettingsResponse)
def save_writing_ai_settings(
    payload: WritingAISettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAISettingsResponse:
    try:
        settings_row = upsert_user_ai_settings(db, current_user.id, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    return settings_to_response(settings_row)


@router.post("/settings/writing-ai/test", response_model=ProviderTestResponse)
async def test_writing_ai_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProviderTestResponse:
    try:
        return await test_user_ai_provider(db, current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.post("/settings/writing-ai/models", response_model=ProviderModelsResponse)
async def discover_writing_ai_models(
    payload: WritingAIModelDiscoveryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProviderModelsResponse:
    try:
        return await discover_user_ai_models(db, current_user.id, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

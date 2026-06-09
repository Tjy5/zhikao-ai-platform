from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.writing import (
    WritingSubmission,
    RawWritingFeedbackResult,
    RawWritingProgressiveResult,
)
from app.services.ai_service import (
    grade_writing_with_ai,
    get_user_ai_service_status,
)
from app.services.llm_provider import LLMProviderError
import logging
import json
from app.services.history_service import (
    append_history,
    list_history,
    get_history_item,
    clear_history,
)
from app.services.user_ai_settings_service import (
    record_provider_status,
    resolve_user_writing_provider,
)

router = APIRouter()
logger = logging.getLogger(__name__)

AI_ERROR_STATUS_CODES = {
    "unavailable": 503,
    "authentication": 503,
    "timeout": 504,
    "rate_limit": 429,
    "refusal": 422,
    "malformed_output": 502,
    "provider_error": 503,
    "unknown": 500,
}

AI_ERROR_MESSAGES = {
    "unavailable": "AI 服务未配置，请先在设置中配置 API Key",
    "authentication": "AI 认证异常，请检查 API Key 或稍后重试",
    "timeout": "AI 服务请求超时，请稍后重试",
    "rate_limit": "请求过多或额度不足，请稍后再试",
    "refusal": "AI 无法处理该内容，请调整内容后重试",
    "malformed_output": "AI 返回结果格式异常，请稍后重试",
    "provider_error": "AI 服务不可用，请稍后重试",
    "unknown": "服务异常，请稍后再试",
}

AI_ERROR_RETRYABLE = {
    "unavailable": False,
    "authentication": False,
    "timeout": True,
    "rate_limit": True,
    "refusal": False,
    "malformed_output": True,
    "provider_error": True,
    "unknown": True,
}


def _normalize_ai_error(error: Exception) -> LLMProviderError:
    if isinstance(error, LLMProviderError):
        classification = error.classification or "unknown"
        if classification in AI_ERROR_STATUS_CODES:
            return error
        return LLMProviderError(str(error), "unknown")
    return LLMProviderError(str(error), "unknown")


def _ai_error_detail(error: Exception) -> dict:
    ai_error = _normalize_ai_error(error)
    classification = ai_error.classification
    return {
        "message": AI_ERROR_MESSAGES[classification],
        "classification": classification,
        "retryable": AI_ERROR_RETRYABLE[classification],
    }


def _ai_http_exception(error: Exception) -> HTTPException:
    detail = _ai_error_detail(error)
    return HTTPException(
        status_code=AI_ERROR_STATUS_CODES[detail["classification"]],
        detail=detail,
    )


def _ai_sse_error_payload(error: Exception) -> dict:
    detail = _ai_error_detail(error)
    return {
        "stage": "error",
        "progress": 0,
        "status": "评分失败",
        "message": detail["message"],
        "classification": detail["classification"],
        "retryable": detail["retryable"],
        "partial": False,
    }


def _record_provider_status_safely(
    db: Session,
    settings_row,
    writing_llm_provider,
) -> None:
    try:
        record_provider_status(db, settings_row, writing_llm_provider)
    except Exception as error:
        logger.error(f"Record provider status failed: {error}")


@router.post("/writings/grade-progressive")
async def grade_writing_progressive(
    submission: WritingSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    渐进式AI评分接口

    使用单次 provider raw 文本生成，最终仅发出一个成功事件。
    """
    try:
        writing_llm_provider, settings_row = resolve_user_writing_provider(db, current_user.id)
        logger.info("=== 开始AI渐进式评分 ===")
        logger.info(f"Content length: {len(submission.content)}")
        logger.info(f"Requested type: {submission.task_type}")

        async def generate_progressive_response():
            try:
                logger.info("AI 渐进式评分开始...")
                raw_result: RawWritingFeedbackResult = await grade_writing_with_ai(
                    submission.content,
                    task_type=submission.task_type,
                    writing_llm_provider=writing_llm_provider,
                )

                final_result = RawWritingProgressiveResult(
                    content=raw_result.content,
                    contentFormat=raw_result.contentFormat,
                )
                final_response = final_result.model_dump()
                append_history(
                    user_id=current_user.id,
                    kind="progressive",
                    request={
                        "content": submission.content,
                        "task_type": submission.task_type,
                    },
                    response=final_response,
                )
                _record_provider_status_safely(db, settings_row, writing_llm_provider)

                yield (
                    f"data: {json.dumps(final_response, ensure_ascii=False)}\n\n"
                ).encode("utf-8", errors="replace")

            except Exception as e:
                logger.error(f"Progressive grading failed: {str(e)}")
                error_response = _ai_sse_error_payload(e)
                _record_provider_status_safely(db, settings_row, writing_llm_provider)
                yield (
                    f"data: {json.dumps(error_response, ensure_ascii=False)}\n\n"
                ).encode("utf-8", errors="replace")

        # Proper SSE response: ensure correct media type and disable buffering
        return StreamingResponse(
            generate_progressive_response(),
            media_type="text/event-stream; charset=utf-8",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                # Disable proxy buffering (e.g., nginx) to avoid truncated/decoded bodies
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        logger.error(f"Progressive grading setup failed: {str(e)}")
        raise _ai_http_exception(e)


@router.post("/writings/grade")
async def grade_writing(
    submission: WritingSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    单次原始 AI 评分接口。
    """
    writing_llm_provider, settings_row = resolve_user_writing_provider(db, current_user.id)
    try:
        logger.info("=== Start grading ===")
        logger.info(f"Content length: {len(submission.content)}")
        logger.info(f"Requested type: {submission.task_type}")

        result: RawWritingFeedbackResult = await grade_writing_with_ai(
            writing_content=submission.content,
            task_type=submission.task_type,
            writing_llm_provider=writing_llm_provider,
        )
        response_data = result.model_dump()

        append_history(
            user_id=current_user.id,
            kind="grade",
            request={
                "content": submission.content,
                "task_type": submission.task_type,
            },
            response=response_data,
        )
        _record_provider_status_safely(db, settings_row, writing_llm_provider)
        return response_data

    except Exception as e:
        logger.error(f"Grading failed: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        _record_provider_status_safely(db, settings_row, writing_llm_provider)
        raise _ai_http_exception(e)


@router.get("/writings/ai-status")
async def check_ai_service_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_user_ai_service_status(db, current_user.id)


@router.get("/writings/history")
async def get_writing_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
):
    """List recent grading history (most recent first)."""
    try:
        items = list_history(user_id=current_user.id, limit=limit)
        return {"items": items}
    except Exception as e:
        logger.error(f"List history failed: {str(e)}")
        raise HTTPException(status_code=500, detail="历史记录读取失败")


@router.get("/writings/history/{item_id}")
async def get_writing_history_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        item = get_history_item(user_id=current_user.id, item_id=item_id)
        if not item:
            raise HTTPException(status_code=404, detail="未找到对应历史记录")
        return item
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get history item failed: {str(e)}")
        raise HTTPException(status_code=500, detail="历史记录读取失败")


@router.delete("/writings/history")
async def delete_writing_history(
    current_user: User = Depends(get_current_user),
):
    try:
        count = clear_history(user_id=current_user.id)
        return {"deleted": count}
    except Exception as e:
        logger.error(f"Clear history failed: {str(e)}")
        raise HTTPException(status_code=500, detail="历史记录清空失败")

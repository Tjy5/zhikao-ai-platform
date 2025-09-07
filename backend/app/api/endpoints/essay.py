from fastapi import APIRouter, HTTPException
from app.schemas.essay import EssaySubmission
from app.services.ai_service import (
    get_question_type_from_ai,
    grade_essay_with_ai,
    get_ai_service_status,
    generate_adaptive_score_details,
    clean_unicode_text,
    sanitize_result_like,
    sanitize_text_public,
)
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


def final_insurance_scan(response_data: dict) -> dict:
    """Final public-output sanitization before returning to frontend."""
    try:
        # Strong pass on feedback/suggestions/scoreDetails
        sanitize_result_like(response_data)
        if isinstance(response_data.get("feedback"), str):
            response_data["feedback"] = sanitize_text_public(response_data["feedback"], location="feedback_final")
        if isinstance(response_data.get("suggestions"), list):
            response_data["suggestions"] = [
                sanitize_text_public(s, location=f"suggestion_final_{i}") if isinstance(s, str) else s
                for i, s in enumerate(response_data["suggestions"])
            ]
        if isinstance(response_data.get("scoreDetails"), list):
            for i, d in enumerate(response_data["scoreDetails"]):
                if isinstance(d, dict) and isinstance(d.get("description"), str):
                    d["description"] = sanitize_text_public(d["description"], location=f"scoreDetail_final_{i}")
    except Exception:
        # Minimal fallback: just clean unicode in scoreDetails descriptions
        if "scoreDetails" in response_data and response_data["scoreDetails"]:
            for detail in response_data["scoreDetails"]:
                if isinstance(detail, dict) and "description" in detail:
                    detail["description"] = clean_unicode_text(detail["description"])
                elif hasattr(detail, "description"):
                    detail.description = clean_unicode_text(detail.description)
    return response_data


@router.post("/essays/grade")
async def grade_essay(submission: EssaySubmission):
    """Grade essay with AI and return sanitized feedback with score details."""
    try:
        logger.info("=== Start grading ===")
        logger.info(f"Content length: {len(submission.content)}")
        logger.info(f"Requested type: {submission.question_type}")

        # Determine question type if not provided
        question_type = submission.question_type
        if not question_type:
            logger.info("Question type not provided; asking AI to recognize type...")
            question_type = await get_question_type_from_ai(submission.content)
            logger.info(f"Type recognized: {question_type}")

        # Main grading
        result = await grade_essay_with_ai(
            essay_content=submission.content,
            question_type=question_type
        )
        logger.info(
            f"Graded - score: {result.score}, details: {len(result.scoreDetails) if result.scoreDetails else 0}"
        )

        # Ensure consistent scoreDetails via adaptive generator
        try:
            logger.info("Regenerating scoreDetails adaptively (strong mode)")
            result.scoreDetails = generate_adaptive_score_details(
                submission.content,
                question_type,
                result.score,
                result.feedback,
            )
            logger.info(f"scoreDetails regenerated: {len(result.scoreDetails)}")
        except Exception as e:
            logger.warning(f"Adaptive scoreDetails failed: {e}")

        # Normalize output shape
        score_details_list = []
        if result.scoreDetails:
            for detail in result.scoreDetails:
                if hasattr(detail, 'model_dump'):
                    score_details_list.append(detail.model_dump())
                else:
                    score_details_list.append(detail)

        response_data = {
            "score": result.score,
            "feedback": result.feedback,
            "suggestions": result.suggestions,
            "scoreDetails": score_details_list,
        }

        # Final public-output cleanup
        response_data = final_insurance_scan(response_data)
        return response_data

    except Exception as e:
        logger.error(f"Grading failed: {str(e)}")
        err = str(e).lower()
        if "api_key" in err or "authentication" in err or "unauthorized" in err:
            raise HTTPException(status_code=503, detail="AI 认证异常，请稍后重试")
        if "connection" in err or "timeout" in err or "network" in err:
            raise HTTPException(status_code=504, detail="网络超时，请稍后重试")
        if "rate_limit" in err or "quota" in err:
            raise HTTPException(status_code=429, detail="请求过多，请稍后再试")
        if "model_not_found" in err:
            raise HTTPException(status_code=503, detail="AI 模型不可用，请联系管理员")
        raise HTTPException(status_code=500, detail="服务异常，请稍后再试")


@router.get("/essays/ai-status")
async def check_ai_service_status():
    return await get_ai_service_status()


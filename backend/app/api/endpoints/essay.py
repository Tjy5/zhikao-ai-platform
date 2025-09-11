from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.essay import EssaySubmission
from app.services.ai_service import (
    get_question_type_from_ai,
    grade_essay_with_ai,
    grade_essay_with_expert_diagnosis,
    get_ai_service_status,
    clean_unicode_text,
    convert_diagnosis_to_score_details,
)
from app.core.config import settings
import logging
import json
import asyncio

router = APIRouter()
logger = logging.getLogger(__name__)


def final_insurance_scan(response_data: dict) -> dict:
    """Final light cleanup to avoid over-trimming user-visible content."""
    try:
        # Feedback: only unicode cleanup (no aggressive sanitization)
        if isinstance(response_data.get("feedback"), str):
            response_data["feedback"] = clean_unicode_text(response_data["feedback"])

        # Suggestions: unicode cleanup per item
        if isinstance(response_data.get("suggestions"), list):
            response_data["suggestions"] = [
                clean_unicode_text(s) if isinstance(s, str) else s
                for s in response_data["suggestions"]
            ]

        # ScoreDetails.description: 现在直接使用AI反馈，不需要额外的模板化处理
        if isinstance(response_data.get("scoreDetails"), list):
            for d in response_data["scoreDetails"]:
                if isinstance(d, dict):
                    if "description" in d:
                        d["description"] = clean_unicode_text(str(d["description"]))
                else:
                    # pydantic model like ScoreDetail
                    if hasattr(d, "description"):
                        d.description = clean_unicode_text(str(d.description))
    except Exception:
        # Best-effort; do not fail response on cleanup
        pass
    return response_data


@router.post("/essays/grade-progressive")
async def grade_essay_progressive(submission: EssaySubmission):
    """
    双阶段AI专家诊断式评分接口
    返回进度式响应：50%诊断结果 + 100%完整评价
    """
    try:
        logger.info("=== 开始双阶段AI专家评分 ===")
        logger.info(f"Content length: {len(submission.content)}")
        logger.info(f"Requested type: {submission.question_type}")

        # Determine question type if not provided
        question_type = submission.question_type
        question_type_source = "client"
        if not question_type:
            logger.info("Question type not provided; asking AI to recognize type...")
            question_type = await get_question_type_from_ai(submission.content)
            question_type_source = "ai"
            logger.info(f"Type recognized: {question_type}")

        async def generate_progressive_response():
            try:
                # ===== 第一阶段：专业诊断 (进度50%) =====
                logger.info("第一阶段：AI专家诊断开始...")
                diagnosis_data, evaluation_data = await grade_essay_with_expert_diagnosis(
                    submission.content, question_type
                )
                
                # 将诊断结果转换为评分细则格式
                diagnosis_score_details = convert_diagnosis_to_score_details(diagnosis_data)
                
                # 第一阶段响应 (50%进度)
                stage1_response = {
                    "stage": 1,
                    "progress": 50,
                    "status": "专业诊断完成",
                    "message": "AI专家老师已完成逐句批改诊断",
                    "questionType": question_type,
                    "questionTypeSource": question_type_source,
                    "scoreDetails": [
                        detail.model_dump() if hasattr(detail, 'model_dump') 
                        else detail for detail in diagnosis_score_details
                    ],
                    "teacherComments": diagnosis_data.get("teacher_comments", ""),
                    "partial": True  # 标记为部分结果
                }
                
                yield f"data: {json.dumps(stage1_response, ensure_ascii=False)}\n\n"
                
                # ===== 第二阶段：整体评价 (进度100%) =====
                logger.info("第二阶段：整体评价生成...")
                
                # 获取总分和评价
                total_score = evaluation_data.get("total_score", 75.0)
                try:
                    total_score = float(total_score)
                    total_score = max(0, min(100, total_score))
                except (ValueError, TypeError):
                    total_score = 75.0
                
                # 获取整体评价作为feedback
                overall_evaluation = evaluation_data.get("overall_evaluation", "AI批改完成")
                teacher_comments = diagnosis_data.get("teacher_comments", "")
                
                # 合并反馈
                feedback = f"{overall_evaluation}\n\n**专业诊断意见：**\n{teacher_comments}"
                feedback = clean_unicode_text(feedback)
                
                # 获取改进建议
                priority_suggestions = evaluation_data.get("priority_suggestions", [])
                strengths = evaluation_data.get("strengths_to_maintain", [])
                
                # 合并所有建议
                all_suggestions = priority_suggestions + strengths
                suggestions = [clean_unicode_text(s) for s in all_suggestions[:5]]
                
                # 第二阶段完整响应 (100%进度)
                stage2_response = {
                    "stage": 2,
                    "progress": 100,
                    "status": "评分完成",
                    "message": "AI专家评分全部完成",
                    "score": total_score,
                    "feedback": feedback,
                    "suggestions": suggestions,
                    "scoreDetails": [
                        detail.model_dump() if hasattr(detail, 'model_dump') 
                        else detail for detail in diagnosis_score_details
                    ],
                    "questionType": question_type,
                    "questionTypeSource": question_type_source,
                    "finalComments": evaluation_data.get("final_comments", ""),
                    "partial": False  # 标记为完整结果
                }
                
                yield f"data: {json.dumps(stage2_response, ensure_ascii=False)}\n\n"
                
            except Exception as e:
                logger.error(f"Progressive grading failed: {str(e)}")
                error_response = {
                    "stage": "error",
                    "progress": 0,
                    "status": "评分失败",
                    "message": "AI评分服务异常，请稍后重试",
                    "error": str(e)[:200],
                    "partial": False
                }
                yield f"data: {json.dumps(error_response, ensure_ascii=False)}\n\n"

        return StreamingResponse(
            generate_progressive_response(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )

    except Exception as e:
        logger.error(f"Progressive grading setup failed: {str(e)}")
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


@router.post("/essays/grade")
async def grade_essay(submission: EssaySubmission):
    """
    原版单次评分接口（保持兼容性）
    现在使用新的双阶段AI评分，但返回传统格式
    """
    try:
        logger.info("=== Start grading ===")
        logger.info(f"Content length: {len(submission.content)}")
        logger.info(f"Requested type: {submission.question_type}")

        # Determine question type if not provided
        question_type = submission.question_type
        question_type_source = "client"
        if not question_type:
            logger.info("Question type not provided; asking AI to recognize type...")
            question_type = await get_question_type_from_ai(submission.content)
            question_type_source = "ai"
            logger.info(f"Type recognized: {question_type}")

        # Main grading
        result = await grade_essay_with_ai(
            essay_content=submission.content,
            question_type=question_type
        )
        logger.info(
            f"Graded - score: {result.score}, details: {len(result.scoreDetails) if result.scoreDetails else 0}"
        )

        # Use scoreDetails returned by service/model as-is (no regeneration)

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
            "questionType": question_type,
            "questionTypeSource": question_type_source,
        }

        # Final public-output cleanup disabled to avoid over-processing descriptions
        # response_data = final_insurance_scan(response_data)
        return response_data

    except Exception as e:
        logger.error(f"Grading failed: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        err = str(e).lower()
        if "api_key" in err or "authentication" in err or "unauthorized" in err:
            raise HTTPException(status_code=503, detail="AI 认证异常，请稍后重试")
        if "connection" in err or "timeout" in err or "network" in err:
            raise HTTPException(status_code=504, detail="网络超时，请稍后重试")
        if "rate_limit" in err or "quota" in err:
            raise HTTPException(status_code=429, detail="请求过多，请稍后再试")
        if "model_not_found" in err:
            raise HTTPException(status_code=503, detail="AI 模型不可用，请联系管理员")
        # 开发环境：返回结构化的兜底结果，避免前端 500 阻塞调试
        if settings.DEBUG:
            fallback_score = 75.0
            response_data = {
                "score": fallback_score,
                "feedback": f"[DEBUG 模式兜底]\n系统处理时发生异常：{type(e).__name__}: {str(e)[:300]}",
                "suggestions": [
                    "请精简输入内容后重试",
                    "稍后再次提交，或更换模型",
                    "若持续失败，请查看后端日志"
                ],
                "scoreDetails": [
                    {
                        "item": "综合评价",
                        "fullScore": 100.0,
                        "actualScore": fallback_score,
                        "description": "AI服务出现异常，已返回调试用的默认评分结果。"
                    }
                ],
                "questionType": question_type,
                "questionTypeSource": question_type_source,
            }
            return response_data
        # 生产环境：保持 500
        raise HTTPException(status_code=500, detail="服务异常，请稍后再试")


@router.get("/essays/ai-status")
async def check_ai_service_status():
    return await get_ai_service_status()

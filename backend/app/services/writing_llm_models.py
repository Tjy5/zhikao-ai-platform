"""
Structured output models for LLM writing grading.
Aligned with WritingFeedbackResult and progressive stage data.
"""

from typing import Any, List

from pydantic import BaseModel, Field, field_validator, model_validator


EXPECTED_SCORE_DETAIL_ITEMS = ("立意准确性", "结构完整性", "内容充实性", "语言表达")
SCORE_DETAIL_FULL_SCORE = 25.0
SCORE_TOTAL_TOLERANCE = 2.0


class LLMTaskTypeOutput(BaseModel):
    """LLM 结构化任务类型识别输出。"""
    task_type: str = Field(..., min_length=1, description="识别出的写作任务类型")

    @field_validator("task_type", mode="before")
    @classmethod
    def validate_task_type(cls, value: Any) -> str:
        if value is None:
            raise ValueError("task_type is required")
        if not isinstance(value, str):
            raise ValueError("task_type must be a string")
        normalized = value.strip()
        if not normalized:
            raise ValueError("task_type must be non-empty")
        return normalized


class LLMScoreDetail(BaseModel):
    """单个维度评分详情，映射到 ScoreDetail"""
    item: str = Field(..., min_length=1, description="评分维度名称")
    full_score: float = Field(
        default=SCORE_DETAIL_FULL_SCORE,
        gt=0,
        description="满分",
    )
    actual_score: float = Field(
        ...,
        ge=0,
        le=SCORE_DETAIL_FULL_SCORE,
        description="实际得分",
    )
    description: str = Field(..., description="评分说明")
    diagnosis_details: List[str] = Field(
        default_factory=list, description="该维度的诊断细节"
    )

    @model_validator(mode="after")
    def validate_score_bounds(self) -> "LLMScoreDetail":
        if abs(self.full_score - SCORE_DETAIL_FULL_SCORE) > 0.001:
            raise ValueError(f"full_score must be {SCORE_DETAIL_FULL_SCORE}")
        if self.actual_score > self.full_score:
            raise ValueError("actual_score must not exceed full_score")
        return self


class LLMGradingOutput(BaseModel):
    """LLM 结构化评分输出，映射到 WritingFeedbackResult"""
    overall_score: float = Field(
        ..., ge=0, le=100, description="总分 0-100"
    )
    feedback: str = Field(..., description="综合评语")
    suggestions: List[str] = Field(
        default_factory=list, description="改进建议列表"
    )
    score_details: List[LLMScoreDetail] = Field(
        ...,
        min_length=len(EXPECTED_SCORE_DETAIL_ITEMS),
        max_length=len(EXPECTED_SCORE_DETAIL_ITEMS),
        description="各维度评分详情",
    )
    strengths: List[str] = Field(
        default_factory=list, description="文章优点"
    )
    improvement_areas: List[str] = Field(
        default_factory=list, description="待改进方面"
    )

    @model_validator(mode="after")
    def validate_score_details(self) -> "LLMGradingOutput":
        detail_items = [detail.item for detail in self.score_details]
        expected_items = set(EXPECTED_SCORE_DETAIL_ITEMS)
        actual_items = set(detail_items)

        if actual_items != expected_items or len(detail_items) != len(expected_items):
            missing = [item for item in EXPECTED_SCORE_DETAIL_ITEMS if item not in actual_items]
            unexpected = [item for item in detail_items if item not in expected_items]
            duplicate = [
                item
                for item in EXPECTED_SCORE_DETAIL_ITEMS
                if detail_items.count(item) > 1
            ]
            parts = []
            if missing:
                parts.append(f"missing={missing}")
            if unexpected:
                parts.append(f"unexpected={unexpected}")
            if duplicate:
                parts.append(f"duplicate={duplicate}")
            detail = "; ".join(parts) if parts else "invalid dimension set"
            raise ValueError(
                "score_details must include exactly the four required dimensions: "
                f"{', '.join(EXPECTED_SCORE_DETAIL_ITEMS)} ({detail})"
            )

        detail_total = sum(detail.actual_score for detail in self.score_details)
        if abs(detail_total - self.overall_score) > SCORE_TOTAL_TOLERANCE:
            raise ValueError(
                "score_details actual_score total must be within "
                f"{SCORE_TOTAL_TOLERANCE} points of overall_score "
                f"(detail_total={detail_total}, overall_score={self.overall_score})"
            )

        return self

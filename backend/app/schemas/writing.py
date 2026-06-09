from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class ScorePoint(BaseModel):
    """单个评分点（加分或扣分）"""
    content: str = Field(..., description="原文引用或评分说明")
    reason: str = Field(..., description="加分或扣分的理由")
    score_impact: Optional[float] = Field(None, description="分数影响（正数加分，负数扣分）")


class DetailedScoreDetail(BaseModel):
    """详细评分细则项 - 专家诊断版本"""
    item: str = Field(..., description="评分项名称")
    fullScore: float = Field(..., description="满分")
    actualScore: float = Field(..., description="实际得分")
    description: str = Field(..., description="总体评分说明")
    
    # 专家诊断新增字段
    positivePoints: List[ScorePoint] = Field(default=[], description="加分点列表")
    negativePoints: List[ScorePoint] = Field(default=[], description="扣分点列表")
    improvementSuggestion: str = Field(default="", description="针对性改进建议")
    methodology_reference: str = Field(default="", description="方法论依据")


class ScoreDetail(BaseModel):
    """传统评分细则项（保持向后兼容）"""
    item: str = Field(..., description="评分项名称")
    fullScore: float = Field(..., description="满分")
    actualScore: float = Field(..., description="实际得分")
    description: str = Field(..., description="评分说明")


class ReviewStageResult(BaseModel):
    """第一阶段诊断结果"""
    stage: int = Field(1, description="阶段标识")
    progress: int = Field(50, description="完成进度")
    status: str = Field("诊断完成", description="当前状态")
    message: str = Field(..., description="状态消息")
    taskType: str = Field(..., description="任务类型")
    taskTypeSource: str = Field(..., description="任务类型来源")
    scoreDetails: List[DetailedScoreDetail] = Field(..., description="详细评分细则")
    teacherComments: str = Field(default="", description="专家诊断意见")
    partial: bool = Field(True, description="是否为部分结果")


class FeedbackStageResult(BaseModel):
    """第二阶段评价结果"""
    stage: int = Field(2, description="阶段标识")
    progress: int = Field(100, description="完成进度")
    status: str = Field("评分完成", description="当前状态")
    message: str = Field(..., description="状态消息")
    score: float = Field(..., description="总分")
    feedback: str = Field(..., description="综合评语")
    suggestions: List[str] = Field(..., description="改进建议")
    scoreDetails: List[DetailedScoreDetail] = Field(..., description="详细评分细则")
    taskType: str = Field(..., description="任务类型")
    taskTypeSource: str = Field(..., description="任务类型来源")
    finalComments: str = Field(default="", description="最终评语")
    partial: bool = Field(False, description="是否为部分结果")


class WritingSubmission(BaseModel):
    """接收用户提交的写作内容"""
    content: str = Field(..., description="写作内容")
    task_type: Optional[str] = Field(None, description="任务类型")


class RawWritingFeedbackResult(BaseModel):
    """原始 AI 写作反馈结果"""

    content: str = Field(..., description="AI 生成的 Markdown 批改内容")
    contentFormat: Literal["markdown"] = Field(
        default="markdown",
        description="内容格式",
    )

    @field_validator("content", mode="before")
    @classmethod
    def validate_content(cls, value: object) -> str:
        if value is None:
            raise ValueError("content is required")
        if not isinstance(value, str):
            value = str(value)
        normalized = value.strip()
        if not normalized:
            raise ValueError("content must be non-empty")
        return normalized


class RawWritingProgressiveResult(RawWritingFeedbackResult):
    """渐进式 SSE 最终事件"""

    stage: Literal[2] = Field(2, description="阶段标识")
    progress: Literal[100] = Field(100, description="完成进度")
    status: str = Field("评分完成", description="当前状态")
    message: str = Field("AI评分已完成", description="状态消息")
    partial: bool = Field(False, description="是否为部分结果")


class WritingFeedbackResult(BaseModel):
    """返回写作反馈结果（传统版本，保持兼容性）"""
    score: float = Field(..., description="总分")
    feedback: str = Field(..., description="综合评语")
    suggestions: List[str] = Field(..., description="改进建议")
    scoreDetails: List[ScoreDetail] = Field(..., description="评分细则")


class ProgressiveFeedbackResult(BaseModel):
    """双阶段渐进式评分结果"""
    diagnosis_stage: ReviewStageResult = Field(..., description="第一阶段诊断结果")
    evaluation_stage: FeedbackStageResult = Field(..., description="第二阶段评价结果")

from pydantic import BaseModel, Field
from typing import List, Optional


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


class DiagnosisStageResult(BaseModel):
    """第一阶段诊断结果"""
    stage: int = Field(1, description="阶段标识")
    progress: int = Field(50, description="完成进度")
    status: str = Field("诊断完成", description="当前状态")
    message: str = Field(..., description="状态消息")
    questionType: str = Field(..., description="题型")
    questionTypeSource: str = Field(..., description="题型来源")
    scoreDetails: List[DetailedScoreDetail] = Field(..., description="详细评分细则")
    teacherComments: str = Field(default="", description="专家诊断意见")
    partial: bool = Field(True, description="是否为部分结果")


class EvaluationStageResult(BaseModel):
    """第二阶段评价结果"""
    stage: int = Field(2, description="阶段标识")
    progress: int = Field(100, description="完成进度")
    status: str = Field("评分完成", description="当前状态")
    message: str = Field(..., description="状态消息")
    score: float = Field(..., description="总分")
    feedback: str = Field(..., description="综合评语")
    suggestions: List[str] = Field(..., description="改进建议")
    scoreDetails: List[DetailedScoreDetail] = Field(..., description="详细评分细则")
    questionType: str = Field(..., description="题型")
    questionTypeSource: str = Field(..., description="题型来源")
    finalComments: str = Field(default="", description="最终评语")
    partial: bool = Field(False, description="是否为部分结果")


class EssaySubmission(BaseModel):
    """接收用户提交的申论内容"""
    content: str = Field(..., description="申论内容")
    question_type: Optional[str] = Field(None, description="题型")


class EssayGradingResult(BaseModel):
    """返回申论批改结果（传统版本，保持兼容性）"""
    score: float = Field(..., description="总分")
    feedback: str = Field(..., description="综合评语")
    suggestions: List[str] = Field(..., description="改进建议")
    scoreDetails: List[ScoreDetail] = Field(..., description="评分细则")


class ProgressiveGradingResult(BaseModel):
    """双阶段渐进式评分结果"""
    diagnosis_stage: DiagnosisStageResult = Field(..., description="第一阶段诊断结果")
    evaluation_stage: EvaluationStageResult = Field(..., description="第二阶段评价结果")
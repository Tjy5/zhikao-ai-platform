from pydantic import BaseModel, Field
from typing import List, Optional


class ScoreDetail(BaseModel):
    """评分细则项"""
    item: str = Field(..., description="评分项名称")
    fullScore: float = Field(..., description="满分")
    actualScore: float = Field(..., description="实际得分")
    description: str = Field(..., description="评分说明")


class EssaySubmission(BaseModel):
    """接收用户提交的申论内容"""
    content: str = Field(..., description="申论内容")
    question_type: Optional[str] = Field(None, description="题型")


class EssayGradingResult(BaseModel):
    """返回申论批改结果"""
    score: float = Field(..., description="总分")
    feedback: str = Field(..., description="综合评语")
    suggestions: List[str] = Field(..., description="改进建议")
    scoreDetails: List[ScoreDetail] = Field(..., description="评分细则")
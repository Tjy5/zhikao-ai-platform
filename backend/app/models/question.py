"""
题目相关数据库模型
"""
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base


class Question(Base):
    """题目表"""
    __tablename__ = "questions"
    
    id = Column(String, primary_key=True)
    title = Column(String(500))                    # 题目标题
    content = Column(Text)                         # 题目文本内容（JSON格式）
    question_type = Column(String(100))            # 题目类型：政治理论、常识判断等
    question_number = Column(Integer)              # 题目编号（1-135）
    parent_question_id = Column(String)            # 大题ID（用于资料分析等）
    difficulty = Column(String(50))                # 难度等级
    source = Column(String(200))                   # 来源文档
    paragraph_range = Column(String(50))           # 段落范围
    total_images = Column(Integer, default=0)      # 图片总数
    total_text_length = Column(Integer, default=0) # 文本总长度
    answer = Column(String(10))                    # 正确答案（A/B/C/D）
    answer_explanation = Column(Text)              # 答案解析
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关联关系
    images = relationship("QuestionImage", back_populates="question", cascade="all, delete-orphan")


class QuestionImage(Base):
    """题目图片表"""
    __tablename__ = "question_images"
    
    id = Column(String, primary_key=True)
    question_id = Column(String, ForeignKey("questions.id"))
    image_name = Column(String(255))               # 图片文件名（兼容旧库约束）
    image_path = Column(String(500))               # 图片存储路径
    image_type = Column(String(100))               # 图片类型：material/question/option等
    image_order = Column(Integer)                  # 兼容旧库的非空顺序列
    ocr_text = Column(Text)                        # OCR识别文字
    context_text = Column(Text)                    # 上下文文字
    paragraph_index = Column(Integer)              # 段落索引
    position_in_question = Column(Integer)         # 在题目中的位置
    order_index = Column(Integer)                  # 显示顺序
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关联关系
    question = relationship("Question", back_populates="images")


class ExtractionHistory(Base):
    """文档提取历史"""
    __tablename__ = "extraction_history"
    
    id = Column(String, primary_key=True)
    filename = Column(String(200))                 # 文档文件名
    file_path = Column(String(500))                # 文档路径
    total_questions_extracted = Column(Integer)    # 提取的题目数
    total_images_extracted = Column(Integer)       # 提取的图片数
    success = Column(Boolean, default=True)        # 是否成功
    error_message = Column(Text)                   # 错误信息
    extraction_result = Column(Text)               # 完整提取结果（JSON）
    processing_time_seconds = Column(Integer)      # 处理时间（秒）
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class QuestionReview(Base):
    """题目审核表"""
    __tablename__ = "question_reviews"
    
    id = Column(String, primary_key=True)
    question_id = Column(String, ForeignKey("questions.id"))
    review_status = Column(String(50))             # pending/approved/rejected
    reviewer = Column(String(100))                 # 审核人
    confidence_score = Column(Integer)             # 置信度分数 0-100
    review_notes = Column(Text)                    # 审核备注
    issues_found = Column(Text)                    # 发现的问题（JSON）
    corrections_made = Column(Text)                # 已修正的内容（JSON）
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())



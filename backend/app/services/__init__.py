"""
服务模块初始化
导出主要的服务接口
"""

# 向后兼容性：从重构后的模块导入
from .ai_service import (
    grade_writing_with_ai,
    get_ai_service_status,
    get_user_ai_service_status,
)

# 专业服务
# from .writing_feedback_service import writing_feedback_service  # 模块不存在，暂时注释

# 工具模块
from .text_utils import (
    clean_unicode_text,
    clean_ai_thinking_patterns,
    normalize_whitespace,
    sanitize_filename,
)
from .ai_response_parser import AIResponseParser

__all__ = [
    # 主要AI服务
    "grade_writing_with_ai",
    "get_ai_service_status",
    "get_user_ai_service_status",
    
    # 专业服务实例 (暂时注释)
    # "writing_feedback_service",
    
    # 工具函数
    "clean_unicode_text",
    "clean_ai_thinking_patterns",
    "normalize_whitespace",
    "sanitize_filename",
    
    # 解析器
    "AIResponseParser",
]

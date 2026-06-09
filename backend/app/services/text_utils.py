"""
文本处理工具模块
提供文本清理、格式化等通用功能
"""

import re
from typing import Dict, List


def clean_unicode_text(text: str) -> str:
    """清理文本中的特殊Unicode字符"""
    if not text:
        return text
        
    replacements: Dict[str, str] = {
        '\u2014': '--',  # 长破折号
        '\u2013': '-',   # 短破折号
        '\u2018': "'",   # 左单引号
        '\u2019': "'",   # 右单引号
        '\u201c': '"',   # 左双引号
        '\u201d': '"',   # 右双引号
        '\u2026': '...',  # 省略号
        '\u00a0': ' ',   # 不间断空格
        '\u2022': '•',   # 项目符号
    }
    
    for unicode_char, replacement in replacements.items():
        text = text.replace(unicode_char, replacement)
    
    return text


def clean_ai_thinking_patterns(text: str) -> str:
    """
    清理AI生成文本中的思考模式和模板化表达
    """
    if not text:
        return text
    
    # 移除AI思考过程的标志性表达
    thinking_patterns: List[str] = [
        r"让我来分析一下.*?[：:]",
        r"根据.*?我认为",
        r"从.*?角度来看",
        r"综合考虑.*?因素",
        r"基于以上分析",
        r"让我.*?评估",
        r"我来.*?分析",
        r"让我们.*?看看",
    ]
    
    cleaned = text
    for pattern in thinking_patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    
    # 移除多余的空白和标点
    cleaned = re.sub(r'\s+', ' ', cleaned)
    cleaned = re.sub(r'[：:]\s*', '', cleaned)
    
    return cleaned.strip()




def normalize_whitespace(text: str) -> str:
    """标准化文本中的空白字符"""
    if not text:
        return text
    
    # 将各种空白字符统一为单个空格
    text = re.sub(r'\s+', ' ', text)
    # 移除行首行尾空白
    text = text.strip()
    
    return text


def sanitize_filename(filename: str) -> str:
    """清理文件名，移除非法字符"""
    if not filename:
        return "untitled"
    
    # 移除或替换非法字符
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
    sanitized = re.sub(r'\s+', '_', sanitized)
    
    # 限制长度
    if len(sanitized) > 100:
        sanitized = sanitized[:100]
    
    return sanitized or "untitled"


import json
import logging
import re
import sys
from typing import Optional
from openai import AsyncOpenAI
from ..core.config import settings
from ..schemas.essay import EssayGradingResult, ScoreDetail
from .prompt_service import create_essay_grading_prompt, extract_chapter_content, create_master_grading_prompt, create_expert_grading_prompt

logger = logging.getLogger(__name__)


# ---------------- Public-output sanitization helpers ----------------
def _strip_system_sections(text: str) -> str:
    """Remove any embedded prompt/system sections that the model may have echoed.

    Strips blocks between tags like <INSTRUCTIONS>...</INSTRUCTIONS>,
    <FINAL_COMMAND>...</FINAL_COMMAND>, <KNOWLEDGE_BASE>...</KNOWLEDGE_BASE>,
    and triple-backtick code blocks. Lightweight and idempotent.
    """
    if not text:
        return text
    try:
        # Remove known tag blocks
        tag_pairs = [
            (r"<INSTRUCTIONS>", r"</INSTRUCTIONS>"),
            (r"<FINAL_COMMAND>", r"</FINAL_COMMAND>"),
            (r"<KNOWLEDGE_BASE>", r"</KNOWLEDGE_BASE>"),
            (r"<USER_SUBMISSION>", r"</USER_SUBMISSION>"),
        ]
        cleaned = text
        for start_tag, end_tag in tag_pairs:
            cleaned = re.sub(start_tag + r"[\s\S]*?" + end_tag, "", cleaned, flags=re.IGNORECASE)

        # Remove fenced code blocks ```...```
        cleaned = re.sub(r"```[\s\S]*?```", "", cleaned)

        # Remove common echoed headings that leak analysis intent
        cleaned = re.sub(r"^\s*#+\s*(Analysis|Internal|思考|分析过程|Chain[- ]?of[- ]?Thought).*$",
                         "", cleaned, flags=re.IGNORECASE | re.MULTILINE)
        return cleaned
    except Exception:
        return text


def sanitize_text_public(text: str, location: str = "feedback") -> str:
    """Strong, layered sanitizer for any user-visible text.

    Order:
    - Unicode cleanup
    - Strip system/prompt sections and code fences
    - Aggressive chain-of-thought pattern cleaning
    - Nuclear validation pass (detect + final clean or fallback)
    """
    if not isinstance(text, str) or not text:
        return text
    # 1) Basic unicode cleanup
    s = clean_unicode_text(text)
    # 2) Strip known prompt/system sections
    s = _strip_system_sections(s)
    # 3) Pattern-based CoT cleanup
    s = clean_ai_thinking_patterns(s)
    # 3.1) Explicitly strip/neutralize Chinese '第X步' style CoT step markers (robust forms)
    try:
        import re as _re
        # Normalize patterns like  "第一步[审题拆解]: ……"  ->  "[审题拆解]: ……"
        s = _re.sub(r'第[\s一二三四五六七八九十百千0-9]+步\s*\[([^\]]+)\]\s*[:：]?', r'[\1] ', s)
        # Remove bare markers like "第一步:"/"第 1 步:"/"步骤一:"/"Step 1:"
        s = _re.sub(r'第[\s一二三四五六七八九十百千0-9]+步\s*[:：]?', '', s)
        s = _re.sub(r'步\s*骤\s*[一二三四五六七八九十0-9]+\s*[:：]?', '', s)
        s = _re.sub(r'\bStep\s*\d+\s*[:：]?', '', s, flags=_re.IGNORECASE)
        # Remove list/bold-wrapped markers like "- **第一步**" or "— 第三步"
        s = _re.sub(r'(^|[\s>])[\-–—•·]?\s*\*{0,2}第[\s一二三四五六七八九十百千0-9]+步\*{0,2}\s*', r'\1', s, flags=_re.MULTILINE)
    except Exception:
        pass
    # 4) Final nuclear validation pass
    s = nuclear_validate_content(s, location=location)
    return s.strip()


def sanitize_result_like(obj: "EssayGradingResult|dict"):
    """Sanitize fields on an EssayGradingResult or a dict with similar keys in-place.

    - Cleans `feedback`
    - Cleans each item in `suggestions`
    - Cleans each `ScoreDetail.description` in `scoreDetails`
    - Drops empty suggestions
    """
    try:
        # Feedback
        if isinstance(obj, dict):
            if "feedback" in obj and isinstance(obj["feedback"], str):
                obj["feedback"] = sanitize_text_public(obj["feedback"], location="feedback")
        else:
            if getattr(obj, "feedback", None):
                obj.feedback = sanitize_text_public(obj.feedback, location="feedback")

        # Suggestions
        suggestions = None
        if isinstance(obj, dict):
            suggestions = obj.get("suggestions")
        else:
            suggestions = getattr(obj, "suggestions", None)
        if isinstance(suggestions, list):
            cleaned_sugs = []
            seen = set()
            for i, s in enumerate(suggestions):
                if not isinstance(s, str):
                    continue
                cs = sanitize_text_public(s, location=f"suggestion_{i}")
                if cs and len(cs) >= 3:
                    key = cs.strip()
                    if key not in seen:
                        cleaned_sugs.append(cs)
                        seen.add(key)
            if isinstance(obj, dict):
                obj["suggestions"] = cleaned_sugs[:5]
            else:
                obj.suggestions = cleaned_sugs[:5]

        # ScoreDetails descriptions
        score_details = None
        if isinstance(obj, dict):
            score_details = obj.get("scoreDetails")
        else:
            score_details = getattr(obj, "scoreDetails", None)

        if isinstance(score_details, list):
            for idx, d in enumerate(score_details):
                # Handle dict or pydantic model
                try:
                    if isinstance(d, dict):
                        desc = d.get("description")
                        if isinstance(desc, str):
                            d["description"] = sanitize_text_public(desc, location=f"scoreDetail_{idx}")
                    else:
                        desc = getattr(d, "description", None)
                        if isinstance(desc, str):
                            d.description = sanitize_text_public(desc, location=f"scoreDetail_{idx}")
                except Exception:
                    continue
    except Exception:
        # Best-effort; do not block response on sanitizer failure
        pass

def nuclear_validate_content(content: str, location: str = "unknown") -> str:
    """
    ★ 核弹级内容验证管道 ★
    在关键节点验证内容，确保无思考模式泄露
    
    Args:
        content: 要验证的内容
        location: 验证位置标识，用于日志跟踪
        
    Returns:
        str: 验证并清理后的安全内容
    """
    if not content or not isinstance(content, str):
        return content
    
    # 超全面的危险关键词库
    dangerous_patterns = [
        # 步骤相关
        r'第[一二三四五六七八九十\d]+步', r'Step\s*\d+', r'步骤[一二三四五六七八九十\d]+',
        # 用户分析相关
        r'用户.*?识别', r'用户.*?判断', r'用户.*?掌握', r'用户.*?锁定',
        # 材料分析相关  
        r'材料中提到', r'材料.*?指出', r'材料.*?显示',
        # 分析思辨词
        r'分析可知', r'综合分析', r'深入分析', r'仔细分析',
        r'可以看出', r'不难发现', r'显而易见', r'由此可见',
        # 引导性词汇
        r'让我们', r'我们来', r'接下来', 
        # 评价思考词
        r'这体现了.*?思维', r'这说明.*?分析', r'经分析', r'通过.*?分析',
        # 特殊符号和格式
        r'----+', r'【[^】]*】', r'===[^=]*===', r'→'
    ]
    
    import re
    
    original_content = content
    contaminated = False
    
    # 检查是否包含危险模式
    for pattern in dangerous_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            contaminated = True
            logger.error(f"★ 验证失败[{location}]: 发现危险模式 '{pattern}' in: {content[:50]}...")
            break
    
    if contaminated:
        # 尝试清理
        cleaned = clean_ai_thinking_patterns(content)
        
        # 再次检查清理后的内容
        still_contaminated = False
        for pattern in dangerous_patterns:
            if re.search(pattern, cleaned, re.IGNORECASE):
                still_contaminated = True
                break
        
        if still_contaminated:
            # 清理失败，返回安全的默认内容
            logger.error(f"★ 清理失败[{location}]: 使用安全默认值")
            return "专业评价，符合申论评分标准"
        else:
            logger.info(f"★ 清理成功[{location}]: {len(original_content)} -> {len(cleaned)} 字符")
            return cleaned
    else:
        logger.debug(f"★ 验证通过[{location}]: 内容安全")
        return content


def clean_unicode_text(text: str) -> str:
    """
    清理文本中的特殊Unicode字符，避免编码问题
    
    Args:
        text: 原始文本
        
    Returns:
        str: 清理后的文本
    """
    if not text:
        return text
        
    # 替换常见的特殊Unicode字符
    replacements = {
        '\u2014': '--',  # 长破折号
        '\u2013': '-',   # 短破折号
        '\u2011': '-',   # 不间断连字符
        '\u2010': '-',   # 连字符
        '\u2018': "'",   # 左单引号
        '\u2019': "'",   # 右单引号
        '\u201c': '"',   # 左双引号
        '\u201d': '"',   # 右双引号
        '\u2026': '...',  # 省略号
        '\u00a0': ' ',   # 不间断空格
        '\u2022': '•',   # 项目符号
        '\u2713': 'V',   # 对勾
        '\u2717': 'X',   # 叉号
        '\u2714': 'V',   # 粗对勾
        '\u2716': 'X',   # 粗叉号
        '\u25cf': '●',   # 黑色圆点
        '\u25cb': '○',   # 空心圆点
        '\u25a0': '■',   # 黑色方块
        '\u25a1': '□',   # 空心方块
    }
    
    for unicode_char, replacement in replacements.items():
        text = text.replace(unicode_char, replacement)
    
    return text


def clean_ai_thinking_patterns(text: str) -> str:
    """
    ★ 核弹级AI思考模式清理器 ★
    多轮深度清理，确保所有思考过程模式被彻底根除
    
    Args:
        text: 原始文本
        
    Returns:
        str: 彻底净化后的文本
    """
    if not text:
        return text
        
    import re
    
    # 【超全面的思考模式库】覆盖所有已知和潜在的AI思考格式
    nuclear_patterns = [
        # === 步骤标记模式 (主要目标) ===
        r'[-*•]*\s*\*{0,2}第[一二三四五六七八九十\d]+步\*{0,2}\s*\[.*?\]\s*[：:：]\s*[^。！？\n]*',      # 所有步骤[标注]格式
        r'[-*•]*\s*\*{0,2}第[一二三四五六七八九十\d]+步\*{0,2}\s*[：:：]\s*[^。！？\n]*',                   # 所有步骤格式
        r'[-*•]*\s*Step\s*\d+\s*\[.*?\]\s*[：:：]\s*[^。！？\n]*',                                        # Step N [xxx]: 格式
        r'[-*•]*\s*Step\s*\d+\s*[：:：]\s*[^。！？\n]*',                                                 # Step N: 格式
        r'[-*•]*\s*步骤[一二三四五六七八九十\d]+\s*[：:：]\s*[^。！？\n]*',                                    # 步骤X：格式
        
        # === 用户分析模式 (重要目标) ===
        r'用户.*?识别.*?题目.*?(?=[。！？\n，]|$)',                                                        # 用户识别题目类型
        r'用户.*?准确.*?识别.*?(?=[。！？\n，]|$)',                                                        # 用户准确识别
        r'用户.*?锁定.*?核心.*?(?=[。！？\n，]|$)',                                                        # 用户锁定核心
        r'用户.*?判断.*?(?=[。！？\n，]|$)',                                                              # 用户判断
        r'用户.*?理解.*?(?=[。！？\n，]|$)',                                                              # 用户理解
        r'用户.*?掌握.*?(?=[。！？\n，]|$)',                                                              # 用户掌握
        
        # === 材料引用模式 ===
        r'材料中提到的.*?["""\']{1,2}[^"""\',]*["""\']{1,2}',                                          # 材料中提到的"内容"
        r'材料中.*?指出.*?(?=[。！？\n，]|$)',                                                            # 材料中指出
        r'材料.*?显示.*?(?=[。！？\n，]|$)',                                                              # 材料显示
        r'----+[^。！？\n]*',                                                                           # 连续破折号
        
        # === 标签和注释模式 ===
        r'【[^】]*】[^。！？\n]*',                                                                         # 【标签】及其后续内容
        r'\([^)]*分析[^)]*\)[^。！？\n]*',                                                               # (xxx分析xxx)及后续
        r'\([^)]*思考[^)]*\)[^。！？\n]*',                                                               # (xxx思考xxx)及后续
        r'\([^)]*判断[^)]*\)[^。！？\n]*',                                                               # (xxx判断xxx)及后续
        
        # === 逗号连接的思考片段 ===
        r'，\s*[-*•]*\s*\*{0,2}第[一二三四五六七八九十\d]+步.*?(?=[，。！？\n]|$)',                        # ，第X步...
        r'，\s*并锁定.*?(?=[，。！？\n]|$)',                                                              # ，并锁定...
        r'，\s*经分析.*?(?=[，。！？\n]|$)',                                                              # ，经分析...
        r'，\s*通过.*?分析.*?(?=[，。！？\n]|$)',                                                         # ，通过...分析...
        
        # === 分析思辨词汇 ===
        r'(?:^|\n|\s)[^。！？\n]*(?:分析可知|综合分析|深入分析|仔细分析)[^。！？\n]*',                        # 各种分析词
        r'(?:^|\n|\s)[^。！？\n]*(?:可以看出|不难发现|显而易见|由此可见)[^。！？\n]*',                        # 推理词
        r'(?:^|\n|\s)[^。！？\n]*(?:让我们|我们来|接下来)[^。！？\n]*',                                     # 引导词
        
        # === 特殊符号模式 ===
        r'→[^。！？\n]*',                                                                               # 箭头及后续
        r'===[^=]*===',                                                                               # === 分隔符 ===
        r'---[^-]*---',                                                                               # --- 分隔符 ---
        
        # === 评价性词汇跟思考过程 ===
        r'[，。]\s*这体现了.*?思维.*?(?=[，。！？\n]|$)',                                                   # 这体现了...思维
        r'[，。]\s*这说明.*?(?:[分析|思考|判断]).*?(?=[，。！？\n]|$)',                                     # 这说明...分析/思考/判断
        
        # === 复合模式清理 ===
        r'(?:审题|拆解|搜寻|重构|诊断|定位|来源|表达)\s*能力.*?(?:用户|学生|考生).*?(?=[。！？\n，]|$)',         # 能力+用户分析混合
    ]
    
    # 【多轮核弹级清理】确保嵌套模式也被清除
    cleaned_text = text
    max_rounds = 5  # 最多清理5轮，确保嵌套模式被彻底清除
    
    for round_num in range(max_rounds):
        original_length = len(cleaned_text)
        
        # 执行这一轮的模式清理
        for pattern in nuclear_patterns:
            try:
                cleaned_text = re.sub(pattern, '', cleaned_text, flags=re.DOTALL | re.MULTILINE | re.IGNORECASE)
            except Exception as e:
                logger.warning(f"Pattern清理异常 (轮次{round_num+1}): {pattern[:50]}... -> {e}")
                continue
        
        # 如果这轮没有清理掉任何内容，则停止
        if len(cleaned_text) == original_length:
            break
        
        logger.info(f"核弹级清理第{round_num+1}轮：删除了{original_length - len(cleaned_text)}个字符")
    
    # 【最终格式整理】
    # 清理多余的空白和格式
    cleaned_text = re.sub(r'\n\s*\n\s*\n+', '\n\n', cleaned_text)                    # 多个换行合并
    cleaned_text = re.sub(r'^\s*[-•*]\s*$', '', cleaned_text, flags=re.MULTILINE)     # 空的列表项
    cleaned_text = re.sub(r'^\s*\*{2,}\s*$', '', cleaned_text, flags=re.MULTILINE)   # 空的粗体标记
    cleaned_text = re.sub(r'[，。]\s*[，。]', '。', cleaned_text)                      # 重复标点
    cleaned_text = re.sub(r'\s+([，。！？])', r'\1', cleaned_text)                     # 标点前多余空格
    cleaned_text = re.sub(r'([，。！？])\s*\n\s*$', r'\1', cleaned_text, flags=re.MULTILINE)  # 行末标点后的空白
    
    # 删除空行和首尾空白
    lines = [line.strip() for line in cleaned_text.split('\n') if line.strip()]
    cleaned_text = '\n'.join(lines)
    
    logger.info(f"核弹级清理完成：原文{len(text)}字符 → 净化后{len(cleaned_text)}字符 (清除{len(text) - len(cleaned_text)}字符)")
    
    return cleaned_text


def analyze_ai_thinking_content(ai_feedback: str) -> dict:
    """
    ★ AI思考内容分析器 ★
    智能分析AI反馈中的有价值信息，提取核心评价要素
    
    Args:
        ai_feedback: AI的原始反馈内容
        
    Returns:
        dict: 包含提取的评价要素和关键信息
    """
    if not ai_feedback:
        return {"evaluation_points": [], "key_insights": [], "error": "空反馈"}
    
    logger.info("开始AI思考内容分析")
    
    try:
        # 初始化分析结果
        analysis_result = {
            "evaluation_points": [],  # 评价要点
            "key_insights": [],       # 关键见解
            "strengths": [],          # 优势表现
            "weaknesses": [],         # 不足之处
            "specific_examples": [],  # 具体举例
            "technical_terms": []     # 专业术语
        }
        
        # === 1. 提取步骤分析中的核心价值 ===
        step_patterns = [
            # 审题拆解相关
            (r'第[一二三四五六七八九十\d]*步.*?审题.*?[:：](.{10,200})', "审题能力"),
            (r'审题.*?[:：](.{10,200})', "审题能力"),
            # 材料理解相关
            (r'第[一二三四五六七八九十\d]*步.*?理解.*?[:：](.{10,200})', "材料理解"),
            (r'理解.*?[:：](.{10,200})', "材料理解"),
            # 论证分析相关
            (r'第[一二三四五六七八九十\d]*步.*?分析.*?[:：](.{10,200})', "分析能力"),
            (r'分析.*?[:：](.{10,200})', "分析能力"),
            # 表达组织相关
            (r'第[一二三四五六七八九十\d]*步.*?表达.*?[:：](.{10,200})', "表达能力"),
            (r'表达.*?[:：](.{10,200})', "表达能力"),
        ]
        
        for pattern, category in step_patterns:
            matches = re.findall(pattern, ai_feedback, re.DOTALL)
            for match in matches:
                # 清理提取的内容
                content = match.strip()
                content = re.sub(r'[，。！？].*', '', content)  # 只取第一句
                if len(content) > 5:  # 有意义的内容
                    analysis_result["evaluation_points"].append({
                        "category": category,
                        "content": content[:100],  # 限制长度
                        "source": "step_analysis"
                    })
        
        # === 2. 提取具体的表现描述 ===
        performance_patterns = [
            r'准确识别了(.{5,50})',
            r'能够(.{5,50})',
            r'体现出(.{5,50})',
            r'显示了(.{5,50})',
            r'表明(.{5,50})',
            r'说明(.{5,50})',
        ]
        
        for pattern in performance_patterns:
            matches = re.findall(pattern, ai_feedback)
            for match in matches:
                content = match.strip()
                if len(content) > 3 and not any(x in content for x in ['思考', '步骤', '分析']):
                    analysis_result["strengths"].append(content[:80])
        
        # === 3. 识别不足之处 ===
        weakness_patterns = [
            r'不足之处[:：](.{10,100})',
            r'需要改进[:：](.{10,100})',
            r'可以提升(.{10,100})',
            r'建议(.{10,100})',
        ]
        
        for pattern in weakness_patterns:
            matches = re.findall(pattern, ai_feedback)
            for match in matches:
                content = match.strip()
                if len(content) > 5:
                    analysis_result["weaknesses"].append(content[:80])
        
        # === 4. 提取专业术语和关键概念 ===
        # 申论相关的专业概念
        professional_terms = [
            '题型识别', '审题能力', '材料理解', '要点提取', '逻辑结构',
            '论证能力', '分析深度', '表达规范', '语言组织', '内容完整性',
            '观点明确', '层次清晰', '条理性', '针对性', '可操作性'
        ]
        
        for term in professional_terms:
            if term in ai_feedback:
                analysis_result["technical_terms"].append(term)
        
        # === 5. 提取关键见解 ===
        # 寻找评价性语句
        insight_patterns = [
            r'整体(.{10,80})',
            r'总体(.{10,80})',
            r'综合来看(.{10,80})',
            r'从.*角度(.{10,80})',
        ]
        
        for pattern in insight_patterns:
            matches = re.findall(pattern, ai_feedback)
            for match in matches:
                content = match.strip()
                if len(content) > 8 and not any(x in content for x in ['第一步', '第二步', '步骤']):
                    analysis_result["key_insights"].append(content[:100])
        
        # 去重和清理
        for key in analysis_result:
            if isinstance(analysis_result[key], list):
                # 去重
                seen = set()
                unique_items = []
                for item in analysis_result[key]:
                    if isinstance(item, dict):
                        item_key = item.get('content', '')
                    else:
                        item_key = item
                    
                    if item_key and item_key not in seen:
                        seen.add(item_key)
                        unique_items.append(item)
                
                analysis_result[key] = unique_items[:5]  # 限制数量
        
        logger.info(f"AI思考内容分析完成：提取了{len(analysis_result['evaluation_points'])}个评价要点")
        return analysis_result
        
    except Exception as e:
        logger.error(f"AI思考内容分析失败: {e}")
        return {"evaluation_points": [], "key_insights": [], "error": str(e)}


def extract_thinking_value(ai_feedback: str, question_type: str) -> dict:
    """
    ★ 智能提取引擎 ★
    从AI思考过程中提取核心评价信息，去除思考过程标记
    
    Args:
        ai_feedback: AI的详细反馈
        question_type: 题型类别
        
    Returns:
        dict: 提取的核心评价信息
    """
    if not ai_feedback:
        return {"extracted_points": [], "professional_summary": ""}
    
    logger.info(f"开始智能提取引擎处理 - 题型：{question_type}")
    
    try:
        # 先进行内容分析
        analysis = analyze_ai_thinking_content(ai_feedback)
        
        # 基于题型进行针对性提取
        extraction_result = {
            "extracted_points": [],
            "professional_summary": "",
            "category_scores": {},
            "key_strengths": [],
            "improvement_areas": []
        }
        
        # === 根据题型特点进行专业化提取 ===
        if question_type == "概括题":
            # 概括题关注：要点提取、逻辑归纳、表达规范
            focus_areas = ["审题能力", "材料理解", "要点提取", "逻辑结构", "表达规范"]
        elif question_type == "综合分析题":
            # 分析题关注：理解深度、分析逻辑、论证能力
            focus_areas = ["材料理解", "分析能力", "逻辑结构", "论证能力", "观点明确"]
        elif question_type == "对策题":
            # 对策题关注：问题识别、对策可行性、针对性
            focus_areas = ["问题识别", "对策分析", "可操作性", "针对性", "表达规范"]
        elif question_type == "应用文写作题":
            # 应用文关注：格式规范、内容完整、表达得体
            focus_areas = ["格式规范", "内容完整性", "表达能力", "针对性", "语言组织"]
        else:
            focus_areas = ["审题能力", "材料理解", "分析能力", "表达能力", "逻辑结构"]
        
        # 从分析结果中提取相关要点
        for point in analysis.get("evaluation_points", []):
            if point.get("category") in focus_areas:
                extraction_result["extracted_points"].append({
                    "dimension": point.get("category"),
                    "description": point.get("content", ""),
                    "performance_level": "良好"  # 默认评价，后续可细化
                })
        
        # 提取关键优势
        extraction_result["key_strengths"] = analysis.get("strengths", [])[:3]
        
        # 提取改进建议
        extraction_result["improvement_areas"] = analysis.get("weaknesses", [])[:3]
        
        # 生成专业摘要
        if extraction_result["extracted_points"]:
            strengths_text = "、".join(extraction_result["key_strengths"][:2])
            summary_parts = []
            
            if strengths_text:
                summary_parts.append(f"表现优势：{strengths_text}")
            
            dimensions = [p["dimension"] for p in extraction_result["extracted_points"]]
            unique_dimensions = list(set(dimensions))
            
            if unique_dimensions:
                summary_parts.append(f"涵盖维度：{('、'.join(unique_dimensions[:3]))}")
            
            extraction_result["professional_summary"] = "；".join(summary_parts)
        
        logger.info(f"智能提取完成：提取{len(extraction_result['extracted_points'])}个核心要点")
        return extraction_result
        
    except Exception as e:
        logger.error(f"智能提取引擎失败: {e}")
        return {"extracted_points": [], "professional_summary": "综合表现良好", "error": str(e)}


def transform_to_professional_description(extracted_data: dict, dimension: str, score_ratio: float, question_type: str) -> str:
    """
    ★ 专业描述转换器 ★
    将提取的AI分析信息转换为专业的申论评分描述
    
    Args:
        extracted_data: 智能提取的评价数据
        dimension: 评分维度
        score_ratio: 得分比例 (0.0-1.0)
        question_type: 题型
        
    Returns:
        str: 专业化的评分描述
    """
    try:
        logger.info(f"开始专业描述转换 - 维度：{dimension}, 得分比例：{score_ratio:.2f}")
        
        # === 1. 基于得分比例确定表现水平 ===
        if score_ratio >= 0.9:
            performance_level = "优秀"
            level_words = ["出色", "精准", "充分", "深入", "全面"]
        elif score_ratio >= 0.8:
            performance_level = "良好"
            level_words = ["较好", "准确", "基本充分", "比较深入", "相对全面"]
        elif score_ratio >= 0.7:
            performance_level = "中等"
            level_words = ["一般", "基本准确", "不够充分", "有待深入", "还需完善"]
        elif score_ratio >= 0.6:
            performance_level = "及格"
            level_words = ["有所体现", "部分准确", "略显不足", "深度欠缺", "需要改进"]
        else:
            performance_level = "不足"
            level_words = ["明显不足", "准确性欠缺", "严重不足", "缺乏深度", "亟待提升"]
        
        # === 2. 从提取数据中查找相关信息 ===
        relevant_points = []
        strengths = []
        
        # 查找与当前维度相关的评价要点
        for point in extracted_data.get("extracted_points", []):
            if point.get("dimension") == dimension or dimension in point.get("description", ""):
                relevant_points.append(point.get("description", ""))
        
        # 查找相关的优势表现
        for strength in extracted_data.get("key_strengths", []):
            if any(keyword in strength for keyword in ["准确", "清晰", "逻辑", "完整", "深入"]):
                strengths.append(strength)
        
        # === 3. 根据维度和题型生成专业描述模板 ===
        dimension_templates = {
            "审题能力": {
                "概括题": "审题定标准确性，题型识别{level}，关键信息把握{level}",
                "综合分析题": "审题拆解{level}，分析方向把握{level}，题意理解{level}",
                "对策题": "问题识别{level}，要求理解{level}，针对性把握{level}",
                "应用文写作题": "文种识别{level}，格式要求理解{level}，写作目标明确性{level}"
            },
            "材料理解": {
                "概括题": "材料阅读{level}，要点提取{level}，信息整合{level}",
                "综合分析题": "材料理解深度{level}，关键信息识别{level}，逻辑脉络梳理{level}",
                "对策题": "问题识别{level}，原因分析{level}，材料利用{level}",
                "应用文写作题": "素材理解{level}，内容选择{level}，材料运用{level}"
            },
            "逻辑结构": {
                "概括题": "要点归类{level}，层次安排{level}，逻辑条理性{level}",
                "综合分析题": "分析层次{level}，论证逻辑{level}，结构完整性{level}",
                "对策题": "对策层次{level}，逻辑递进性{level}，条理清晰度{level}",
                "应用文写作题": "结构安排{level}，内容组织{level}，逻辑连贯性{level}"
            },
            "表达规范": {
                "概括题": "语言简洁性{level}，表述准确性{level}，用词规范性{level}",
                "综合分析题": "表达准确性{level}，语言逻辑性{level}，用词专业性{level}",
                "对策题": "表述清晰性{level}，用词准确性{level}，语言规范性{level}",
                "应用文写作题": "语言得体性{level}，表述规范性{level}，文字功底{level}"
            },
            "分析能力": {
                "综合分析题": "分析深度{level}，理论运用{level}，观点阐述{level}",
                "对策题": "原因分析{level}，可行性分析{level}，综合分析{level}",
            },
            "内容完整性": {
                "概括题": "要点完整性{level}，内容涵盖面{level}，遗漏程度控制{level}",
                "综合分析题": "分析完整性{level}，内容充实度{level}，论述全面性{level}",
                "对策题": "对策完整性{level}，内容充实度{level}，覆盖全面性{level}",
                "应用文写作题": "内容完整性{level}，要素齐备性{level}，信息充实度{level}"
            }
        }
        
        # === 4. 生成基础描述 ===
        base_template = dimension_templates.get(dimension, {}).get(question_type, "")
        
        if not base_template:
            # 通用模板
            base_template = f"{dimension}{level_words[0]}，表现{performance_level}"
        else:
            # 用性能等级词汇替换模板
            base_template = base_template.format(level=level_words[0])
        
        # === 5. 添加具体表现描述 ===
        description_parts = [base_template]
        
        # 如果有相关要点，添加具体描述
        if relevant_points:
            specific_desc = relevant_points[0][:50]  # 取第一个相关描述的前50字
            if specific_desc and specific_desc not in base_template:
                description_parts.append(f"具体表现为{specific_desc}")
        
        # 如果有优势信息且分数较高，添加优势描述
        if score_ratio >= 0.7 and strengths:
            strength_desc = strengths[0][:40]
            if strength_desc and strength_desc not in "".join(description_parts):
                description_parts.append(f"体现出{strength_desc}")
        
        # === 6. 组合最终描述 ===
        final_description = "，".join(description_parts)
        
        # 确保描述长度适中
        if len(final_description) > 120:
            final_description = final_description[:120] + "..."
        elif len(final_description) < 30:
            # 如果太短，添加通用评价
            final_description += f"，整体水平达到{performance_level}标准"
        
        logger.info(f"专业描述转换完成 - 生成描述长度：{len(final_description)}字")
        return final_description
        
    except Exception as e:
        logger.error(f"专业描述转换失败: {e}")
        # 返回安全的默认描述
        default_descriptions = {
            "优秀": "表现优秀，充分体现专业能力",
            "良好": "表现良好，基本达到要求", 
            "中等": "表现一般，还有提升空间",
            "及格": "基本及格，需要进一步改进",
            "不足": "表现不足，需要重点加强"
        }
        
        if score_ratio >= 0.8:
            return default_descriptions.get("良好", "表现良好")
        elif score_ratio >= 0.6:
            return default_descriptions.get("中等", "表现一般")
        else:
            return default_descriptions.get("不足", "需要改进")


def _ensure_readable_markdown(s: str) -> str:
    """Ensure the feedback string isn't a single wall of text.

    - If list markers or headings already exist, return as-is.
    - Otherwise, insert a newline after Chinese punctuation (。！？；) to improve readability.
    """
    if not s:
        return s
    if ('- ' in s) or ('\n- ' in s) or ('\n\n' in s) or ('## ' in s):
        return s
    return re.sub(r'([。！？；])\s*', r'\1\n', s)


async def get_question_type_from_ai(question_text: str) -> str:
    """
    AI题型诊断服务 (Type Recognizer)
    专门用于判断申论题型的轻量级AI调用
    
    Args:
        question_text: 题目材料及问题内容
        
    Returns:
        str: 题型名称（概括题、综合分析题、对策题、应用文写作题中的一个）
        
    Raises:
        Exception: 当AI服务调用失败时抛出异常
    """
    try:
        # 初始化OpenAI客户端
        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base,
            default_headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
            }
        )
        
        # 极简的题型判断提示词
        prompt = f"""你是申论题型专家。请分析以下内容，仅返回题型名称。

题目内容：
{question_text}

请从以下四个选项中选择一个：
- 概括题
- 综合分析题  
- 对策题
- 应用文写作题

判断标准：
- 概括题：要求概括、归纳某些要点、做法、原因等
- 综合分析题：要求分析、解释概念含义、评价现象等  
- 对策题：要求提出解决方案、措施、建议等
- 应用文写作题：要求写倡议书、发言稿、公开信等具体文种

只返回题型名称，不要其他内容："""

        # 调用OpenAI API
        response = await client.chat.completions.create(
            model=settings.openai_model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,  # 统一降低温度确保输出稳定
            max_tokens=50    # 限制token数，只需要返回题型名称
        )
        
        # 获取AI返回的内容
        ai_response = response.choices[0].message.content
        if not ai_response:
            raise ValueError("AI返回了空响应")
            
        # 清理并验证返回的题型
        question_type = ai_response.strip()
        valid_types = ["概括题", "综合分析题", "对策题", "应用文写作题"]
        
        for valid_type in valid_types:
            if valid_type in question_type:
                logger.info(f"AI题型诊断结果: {valid_type}")
                return valid_type
        
        # 如果没有匹配到有效题型，返回默认值
        logger.warning(f"AI返回的题型无法识别: {question_type}，使用默认值")
        return "概括题"
        
    except Exception as e:
        logger.error(f"AI题型诊断失败: {e}")
        # 失败时返回默认题型
        return "概括题"


async def grade_essay_with_master_ai(essay_content: str, question_type: str, chapter_content: str) -> dict:
    """
    AI核心批改服务 (Master Grader) - 净化版本
    专注的AI批改调用，返回净化的JSON对象
    
    Args:
        essay_content: 学生作答内容
        question_type: 题型名称
        chapter_content: 相关教学章节内容
        
    Returns:
        dict: 净化后的批改结果JSON对象
        
    Raises:
        Exception: 当AI服务调用失败时抛出异常
    """
    try:
        # 初始化OpenAI客户端
        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base,
            default_headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
            }
        )
        
        # 生成净化后的批改提示词
        prompt = create_master_grading_prompt(essay_content, question_type, chapter_content)
        
        # 调用OpenAI API进行批改
        response = await client.chat.completions.create(
            model=settings.openai_model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,  # 统一温度参数，确保输出稳定
            max_tokens=3000   # 增加token限制以支持详细的批改内容
        )
        
        # 获取AI返回的内容
        ai_response = response.choices[0].message.content
        if not ai_response:
            raise ValueError("AI返回了空的批改内容")
        
        # 尝试直接解析为JSON
        try:
            # 寻找JSON对象的开始和结束
            json_start = ai_response.find('{')
            json_end = ai_response.rfind('}')
            
            if json_start != -1 and json_end != -1 and json_end > json_start:
                json_str = ai_response[json_start:json_end + 1]
                result_data = json.loads(json_str)
                
                # 验证必需字段
                required_fields = ["task_diagnosis", "comprehensive_evaluation", "score", "key_suggestions"]
                for field in required_fields:
                    if field not in result_data:
                        raise ValueError(f"AI返回的JSON缺少必需字段: {field}")
                
                logger.info(f"AI核心批改完成，题型: {question_type}, JSON解析成功，分数: {result_data.get('score')}")
                return result_data
                
            else:
                raise json.JSONDecodeError("无法找到有效的JSON对象", ai_response, 0)
                
        except json.JSONDecodeError as e:
            logger.warning(f"AI返回内容JSON解析失败，原始内容前500字符: {ai_response[:500]}")
            logger.warning(f"JSON解析错误详情: {str(e)}")
            # 应急处理：使用旧的Markdown解析器
            fallback_data = parse_grading_response_to_json(ai_response)
            return {
                "task_diagnosis": f"老师您好，我是您的专属申论辅导专家'悟道'。经分析，我判断这是'{question_type}'，将运用对应的核心方法论为您批改。",
                "comprehensive_evaluation": fallback_data["feedback"],
                "improvement_guides": [],
                "score": fallback_data["score"],
                "key_suggestions": fallback_data["suggestions"]
            }
        
    except Exception as e:
        logger.error(f"AI核心批改失败: {e}")
        raise Exception(f"AI批改服务暂时不可用: {str(e)}")


def parse_grading_response_to_json(grading_text: str) -> dict:
    """
    格式化封装服务 (Formatter)
    将AI返回的结构化文本解析并封装成标准JSON格式
    
    Args:
        grading_text: AI返回的批改文本（Markdown格式）
        
    Returns:
        dict: 包含score、feedback、suggestions的字典
    """
    try:
        result = {
            "score": 75.0,
            "feedback": "",
            "suggestions": []
        }
        
        # 提取分数
        score_patterns = [
            r'分数[：:]\s*(\d+)',
            r'评分[：:]\s*(\d+)', 
            r'得分[：:]\s*(\d+)',
            r'分数评定[：:].*?(\d+)分',
            r'(\d+)分'
        ]
        
        for pattern in score_patterns:
            match = re.search(pattern, grading_text, re.IGNORECASE)
            if match:
                try:
                    score = int(match.group(1))
                    if 0 <= score <= 100:
                        result["score"] = float(score)
                        break
                except (ValueError, IndexError):
                    continue
        
        # 组织feedback：将所有内容整合
        result["feedback"] = grading_text
        # Sanitize parsed feedback to strip any leaked analysis
        try:
            result["feedback"] = sanitize_text_public(result["feedback"], location="feedback_parse")
        except Exception:
            pass
        
        # 提取改进建议 - 寻找"改进建议"或"建议"部分
        suggestions = []
        
        # 寻找改进建议部分
        suggestion_section_match = re.search(r'##\s*改进建议(.*?)(?=##|$)', grading_text, re.DOTALL | re.IGNORECASE)
        if suggestion_section_match:
            suggestion_text = suggestion_section_match.group(1)
            
            # 提取建议条目
            suggestion_patterns = [
                r'^\d+[\.\、]\s*(.+?)(?=\n\d+[\.\、]|\n*$)',  # 1. 建议内容
                r'^[-•]\s*(.+?)(?=\n[-•]|\n*$)',              # - 建议内容
                r'(?:建议|应该|需要)(.+?)(?=\n|。)',              # 包含关键词的句子
            ]
            
            for pattern in suggestion_patterns:
                matches = re.findall(pattern, suggestion_text, re.MULTILINE)
                for match in matches:
                    suggestion = match.strip().rstrip('。').strip()
                    if len(suggestion) > 10:  # 过滤太短的内容
                        suggestions.append(suggestion)
                if suggestions:  # 如果找到了建议就停止
                    break
        
        # 如果没有找到具体建议，从全文中提取
        if not suggestions:
            # 寻找包含改进相关关键词的句子
            improvement_keywords = ['建议', '应该', '需要', '可以', '改进', '提升', '优化', '加强', '注意']
            sentences = re.split(r'[。！？\n]', grading_text)
            for sentence in sentences:
                if any(keyword in sentence for keyword in improvement_keywords):
                    cleaned = sentence.strip()
                    if 10 < len(cleaned) < 120:  # 合理长度的建议
                        suggestions.append(cleaned)
        
        # 确保至少有一些建议
        if not suggestions:
            suggestions = [
                "按照申论题型方法论进行改进",
                "注意答题格式和逻辑结构", 
                "提高要点概括的准确性",
                "多练习提升答题技巧"
            ]
        
        # 去重并限制数量
        result["suggestions"] = list(dict.fromkeys(suggestions))[:5]  # 最多5条，去重
        
        logger.info(f"格式化解析完成 - 分数: {result['score']}, 建议数: {len(result['suggestions'])}")
        return result
        
    except Exception as e:
        logger.error(f"格式化解析失败: {e}")
        # 返回默认格式
        return {
            "score": 75.0,
            "feedback": grading_text if grading_text else "AI批改完成，请参考建议进行改进。",
            "suggestions": ["请检查答题逻辑", "建议多加练习", "注意答题格式"]
        }


def parse_ai_markdown_response(markdown_text: str) -> Optional[dict]:
    """
    智能解析AI返回的响应，支持新的JSON结构和markdown格式
    
    Args:
        markdown_text: AI返回的响应文本
        
    Returns:
        dict: 解析后的结构化数据，包含score、feedback、suggestions
    """
    try:
        # 首先尝试解析为JSON (新的XML标签结构)
        cleaned_response = markdown_text.strip()
        
        # 寻找JSON对象
        json_start = cleaned_response.find('{')
        json_end = cleaned_response.rfind('}')
        
        if json_start != -1 and json_end != -1 and json_end > json_start:
            json_str = cleaned_response[json_start:json_end + 1]
            try:
                json_data = json.loads(json_str)
                
                # 新的JSON结构适配
                if "task_diagnosis" in json_data and "comprehensive_evaluation" in json_data:
                    # 构建适合前端的格式
                    comp_eval = json_data.get('comprehensive_evaluation', '')
                    result = {
                        "score": json_data.get("score", 75.0),
                        "feedback": f"{json_data.get('task_diagnosis', '')}\n\n{_ensure_readable_markdown(comp_eval)}",
                        "suggestions": json_data.get("key_suggestions", [])
                    }
                    
                    # 如果有详细的改进指南，添加到feedback中
                    if "improvement_guides" in json_data and json_data["improvement_guides"]:
                        result["feedback"] += "\n\n**改进指南：**"
                        for i, guide in enumerate(json_data["improvement_guides"], 1):
                            result["feedback"] += f"\n\n**指南 {i}：{guide.get('methodology_step', '改进建议')}**"
                            if guide.get('methodology_source'):
                                result["feedback"] += f"\n**方法论来源：** {guide['methodology_source']}"
                            if guide.get('problem_diagnosis'):
                                result["feedback"] += f"\n**问题诊断：** {guide['problem_diagnosis']}"
                            if guide.get('action_blueprint'):
                                result["feedback"] += f"\n**行动蓝图：** {guide['action_blueprint']}"
                            if guide.get('master_rewrite_example'):
                                result["feedback"] += f"\n**名师示范：** {guide['master_rewrite_example']}"
                    
                    logger.info(f"新JSON结构解析成功 - 分数: {result['score']}, 建议数: {len(result['suggestions'])}")
                    return result
                else:
                    # 兼容旧的JSON结构
                    result = {
                        "score": json_data.get("score", 75.0),
                        "feedback": json_data.get("feedback", ""),
                        "suggestions": json_data.get("suggestions", [])
                    }
                    logger.info(f"旧JSON结构解析成功 - 分数: {result['score']}")
                    return result
                    
            except json.JSONDecodeError:
                # JSON解析失败，继续使用markdown解析
                pass
        
        # 如果不是JSON格式，使用markdown解析逻辑
        result = {
            "score": 75.0,  # 默认分数
            "feedback": "",
            "suggestions": []
        }
        
        # 提取完整的反馈内容（保持原始格式用于显示）
        result["feedback"] = _ensure_readable_markdown(markdown_text)
        
        # 尝试从文本中提取分数
        score_patterns = [
            r'分[数评][:：]\s*(\d+)',  # 分数: 85
            r'得分[:：]\s*(\d+)',     # 得分: 80 
            r'评分[:：]\s*(\d+)',     # 评分: 90
            r'(\d+)分',               # 85分
            r'score[:\s]*(\d+)',      # score: 85
        ]
        
        for pattern in score_patterns:
            match = re.search(pattern, markdown_text, re.IGNORECASE)
            if match:
                try:
                    score = int(match.group(1))
                    if 0 <= score <= 100:
                        result["score"] = float(score)
                        break
                except (ValueError, IndexError):
                    continue
        
        # 提取建议内容
        suggestions = []
        
        # 寻找指南或建议部分
        suggestion_patterns = [
            r'指南\s*\d+[：:]\s*([^\n]+)',      # 指南 1: 内容
            r'建议\s*\d+[：:]\s*([^\n]+)',      # 建议 1: 内容  
            r'改进建议[：:]([^\n]+)',          # 改进建议：内容
            r'\d+\.\s*([^。\n]+)',             # 1. 内容
            r'[-•]\s*([^。\n]+)',              # - 内容 或 • 内容
        ]
        
        for pattern in suggestion_patterns:
            matches = re.findall(pattern, markdown_text, re.MULTILINE)
            for match in matches:
                cleaned_suggestion = match.strip()
                if len(cleaned_suggestion) > 5:  # 过滤太短的内容
                    suggestions.append(cleaned_suggestion)
        
        # 如果没有找到建议，提取一些关键改进点
        if not suggestions:
            # 寻找包含改进相关关键词的句子
            improvement_keywords = ['改进', '提升', '优化', '加强', '完善', '建议', '应该']
            sentences = re.split(r'[。！!]', markdown_text)
            for sentence in sentences:
                if any(keyword in sentence for keyword in improvement_keywords):
                    cleaned = sentence.strip()
                    if 10 < len(cleaned) < 100:  # 合理长度的建议
                        suggestions.append(cleaned)
        
        # 保证至少有一些建议
        if not suggestions:
            suggestions = [
                "根据申论四大题型方法论进行改进",
                "注意答题格式和逻辑结构", 
                "提高要点概括的准确性",
                "建议多练习提升答题技巧"
            ]
        
        # 限制建议数量并去重
        result["suggestions"] = list(dict.fromkeys(suggestions))[:6]  # 最多6条，去重
        
        logger.info(f"Markdown格式解析成功 - 分数: {result['score']}, 建议数: {len(result['suggestions'])}")
        
        return result
        
    except Exception as e:
        logger.error(f"智能解析过程中出错: {str(e)}")
        return None

def generate_adaptive_score_details(essay_content: str, question_type: str, total_score: float, ai_feedback: str = "") -> list:
    """
    ★ 智能提取转换评分细则生成器 ★ 
    利用AI思考价值，通过智能提取转换生成专业评分描述
    
    Args:
        essay_content: 答题内容
        question_type: 题型
        total_score: 总分
        ai_feedback: AI的详细反馈（智能分析提取价值）
        
    Returns:
        list: 基于AI价值提取的专业评分细则列表
    """
    scoreDetails = []
    
    logger.info(f"★ 智能提取转换模式：分析AI价值，生成专业描述 - 题型：{question_type}")
    
    # === 智能分析AI反馈，提取评价价值 ===
    extracted_data = {"extracted_points": [], "professional_summary": ""}
    if ai_feedback and ai_feedback.strip():
        try:
            extracted_data = extract_thinking_value(ai_feedback, question_type)
            logger.info(f"AI价值提取完成：获得{len(extracted_data.get('extracted_points', []))}个评价要点")
        except Exception as e:
            logger.warning(f"AI价值提取失败，使用默认模式: {e}")
            extracted_data = {"extracted_points": [], "professional_summary": "综合表现良好"}
    
    # 根据《申论四大题型核心秘籍》定义评分维度和权重
    if question_type == "概括题":
        # 基于四步核心方法论：审题定标、精准找点、逻辑归并、规范成文
        dimensions = [
            {"item": "审题定标能力", "weight": 0.30, "base_desc": "明确概括对象、范围和要求的准确性"},
            {"item": "精准找点能力", "weight": 0.40, "base_desc": "关键词定位、多主体视角搜寻能力"},
            {"item": "逻辑归并能力", "weight": 0.20, "base_desc": "分类合并、语言精炼的整合能力"},
            {"item": "规范成文能力", "weight": 0.10, "base_desc": "总分结构、要点化呈现的表达能力"}
        ]
    elif question_type == "综合分析题":
        # 基于解构与重构的逻辑思辨：审题拆解、搜寻组件、逻辑重构、规范作答
        dimensions = [
            {"item": "审题拆解能力", "weight": 0.25, "base_desc": "识别分析类型、锁定核心对象的能力"},
            {"item": "搜寻组件能力", "weight": 0.30, "base_desc": "挖掘定义表现、原因目的、影响意义的能力"},
            {"item": "逻辑重构能力", "weight": 0.35, "base_desc": "搭建分析框架、构建论证链条的能力"},
            {"item": "规范作答能力", "weight": 0.10, "base_desc": "观点前置、论述清晰的表达能力"}
        ]
    elif question_type == "对策题":
        # 基于对症下药的精准施策：问题诊断、角色定位、对策来源、结构表达
        dimensions = [
            {"item": "问题诊断能力", "weight": 0.25, "base_desc": "准确识别问题、深挖根本原因的能力"},
            {"item": "角色定位能力", "weight": 0.20, "base_desc": "明确身份权责、锁定解决视角的能力"},
            {"item": "对策来源能力", "weight": 0.40, "base_desc": "直接提炼、问题反推、经验借鉴的能力"},
            {"item": "结构表达能力", "weight": 0.15, "base_desc": "逻辑归类、动词化表述的规范能力"}
        ]
    else:  # 应用文写作题
        # 基于情境适配的场景化写作：情境解构、格式遵从、内容组织、语言匹配
        dimensions = [
            {"item": "情境解构能力", "weight": 0.25, "base_desc": "身份对象目的三要素分析能力"},
            {"item": "格式遵从能力", "weight": 0.25, "base_desc": "标题称谓正文落款的规范性"},
            {"item": "内容组织能力", "weight": 0.35, "base_desc": "逻辑框架构建、材料信息整合能力"},
            {"item": "语言匹配能力", "weight": 0.15, "base_desc": "语气风格与情境适配度"}
        ]
    
    # 精确分数分配算法
    remaining_score = total_score
    
    for i, dim in enumerate(dimensions):
        if i == len(dimensions) - 1:
            # 最后一项使用剩余分数，确保总和精确等于综合评分
            actual_score = remaining_score
        else:
            # 根据权重和表现水平计算分数
            base_score = total_score * dim["weight"]
            
            # 基于内容质量的微调（保持在权重附近的合理范围内）
            quality_factor = _assess_content_quality(essay_content, dim["item"], "")  # 不传入AI反馈
            score_variation = base_score * 0.1 * quality_factor  # 最多10%的波动
            
            actual_score = base_score + score_variation
            actual_score = max(0, min(total_score * dim["weight"] * 1.2, actual_score))
            
            remaining_score -= actual_score
        
        # 计算该项的满分（根据权重）
        full_score = round(100.0 * dim["weight"], 1)
        actual_score = max(0, min(full_score, round(actual_score, 1)))
        
        # ★ 智能转换专业描述生成：基于AI价值提取 ★
        score_ratio = actual_score / full_score if full_score > 0 else 0
        try:
            description = transform_to_professional_description(extracted_data, dim["item"], score_ratio, question_type)
        except Exception as e:
            logger.warning(f"专业描述转换失败，使用安全默认描述: {e}")
            # 安全后备描述
            if score_ratio >= 0.8:
                description = f"{dim['item']}表现良好，基本达到要求"
            elif score_ratio >= 0.6:
                description = f"{dim['item']}表现一般，还有提升空间"  
            else:
                description = f"{dim['item']}需要改进，有待加强"
        
        # ★ 最终安全验证：确保无思考过程痕迹 ★
        if any(dangerous in description for dangerous in ["第一步", "第二步", "第三步", "第四步", "第五步", "Step", "步骤", "**", "["]):
            logger.warning(f"★ 发现残留思考痕迹，进行清理：{description}")
            description = clean_ai_thinking_patterns(description)
            if not description or len(description) < 10:
                # 基于分数比例确定水平
                if score_ratio >= 0.8:
                    level = "良好"
                elif score_ratio >= 0.6:
                    level = "一般"
                else:
                    level = "待提升"
                description = f"{dim['item']}综合表现达到{level}水平"
        
        logger.info(f"★ 智能转换描述生成：{dim['item']} -> {description[:50]}...")
        
        scoreDetails.append(ScoreDetail(
            item=dim["item"],
            fullScore=full_score,
            actualScore=actual_score,
            description=description
        ))
    
    # 最终验证：确保总分精确匹配
    # Ensure per-dimension full scores sum to 100 (avoid 84.9 vs 85 confusion)
    try:
        total_full = round(sum(detail.fullScore for detail in scoreDetails), 1)
        if abs(total_full - 100.0) > 0.1 and scoreDetails:
            delta = 100.0 - total_full
            scoreDetails[-1].fullScore = round(max(0.0, min(100.0, scoreDetails[-1].fullScore + delta)), 1)
            # Keep actual score within adjusted full score
            if scoreDetails[-1].actualScore > scoreDetails[-1].fullScore:
                scoreDetails[-1].actualScore = round(scoreDetails[-1].fullScore, 1)
    except Exception:
        pass

    actual_total = sum(detail.actualScore for detail in scoreDetails)
    if abs(actual_total - total_score) > 0.1:
        # 如果有微小差异，调整最后一项
        if scoreDetails:
            scoreDetails[-1].actualScore += (total_score - actual_total)
            scoreDetails[-1].actualScore = round(max(0.0, min(scoreDetails[-1].fullScore, scoreDetails[-1].actualScore)), 1)
    
    logger.info(f"★ 智能提取转换模式：生成{len(scoreDetails)}个基于AI价值的专业评分细则")
    return scoreDetails


def _assess_content_quality(essay_content: str, dimension: str, ai_feedback: str) -> float:
    """
    评估内容在特定维度上的质量表现
    返回-1到1之间的调整因子
    """
    if not essay_content:
        return -0.5
    
    content_length = len(essay_content)
    quality_score = 0.0
    
    # 基于内容长度的基础评价
    if content_length < 100:
        quality_score -= 0.3
    elif content_length > 800:
        quality_score += 0.2
    
    # 基于AI反馈的质量评估
    if ai_feedback:
        positive_keywords = ["优秀", "准确", "完整", "清晰", "规范", "深入", "充分"]
        negative_keywords = ["不足", "缺乏", "有待", "需要", "改进", "遗漏"]
        
        feedback_lower = ai_feedback.lower()
        for keyword in positive_keywords:
            if keyword in feedback_lower:
                quality_score += 0.1
        for keyword in negative_keywords:
            if keyword in feedback_lower:
                quality_score -= 0.1
    
    # 限制在合理范围内
    return max(-1.0, min(1.0, quality_score))


def generate_personalized_description(item: str, score_ratio: float, ai_feedback: str, question_type: str) -> str:
    """
    ★ 超核弹级隔离版评分描述生成器 ★
    完全拒绝AI反馈，100%使用安全模板，绝对零污染
    
    Args:
        item: 评分项名称
        score_ratio: 该项得分比例
        ai_feedback: AI反馈内容（完全忽略，永不使用）
        question_type: 题型
        
    Returns:
        str: 绝对安全的专业评分说明
    """
    # 【超核弹级策略】完全忽略AI反馈参数，永远不使用
    # AI反馈被当作有毒物质处理，绝对隔离
    
    # 完全基于模板的安全描述
    base_description = get_professional_description(item, score_ratio, question_type)
    
    # 基于分数的客观评价（不依赖任何AI内容）
    if score_ratio >= 0.85:
        performance_indicator = "，表现优秀"
    elif score_ratio >= 0.75:
        performance_indicator = "，表现良好"
    elif score_ratio >= 0.65:
        performance_indicator = "，基本合格"
    elif score_ratio >= 0.5:
        performance_indicator = "，仍需努力"
    else:
        performance_indicator = "，需要重点改进"
    
    final_description = base_description + performance_indicator
    
    # 【超核弹级验证】最终检测任何残留污染
    dangerous_fragments = [
        "第一步", "第二步", "第三步", "第四步", "第五步",
        "Step", "步骤", "分析可知", "用户", "材料中",
        "**", "[", "]", "----", "审题", "拆解", "搜寻", "重构"
    ]
    
    for fragment in dangerous_fragments:
        if fragment in final_description:
            logger.error(f"★ 超核弹级检测：发现残留污染片段 '{fragment}' 在描述中：{final_description}")
            # 发现污染立即使用最安全的替代描述
            return get_ultra_safe_description(item, score_ratio)
    
    logger.info(f"★ 超核弹级验证通过：{item} -> {final_description[:30]}...")
    return final_description


# ★ ELIMINATED: extract_feedback_for_item function completely removed ★
# This function was a major contamination source for AI thinking patterns
# All extraction-based logic replaced with pure template generation
# NO MORE EXTRACTION FROM AI FEEDBACK - TEMPLATE ONLY!


def get_ultra_safe_description(item: str, score_ratio: float) -> str:
    """
    ★ 超安全备用描述生成器 ★
    当检测到任何污染时使用的绝对安全描述
    """
    safe_descriptions = {
        "审题拆解能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "搜寻组件能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定", 
        "逻辑重构能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "规范作答能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "精准找点能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "逻辑归并能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "问题诊断能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "角色定位能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "对策来源能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "结构表达能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "情境解构能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "格式遵从能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "内容组织能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定",
        "语言匹配能力": f"该项能力评价为{int(score_ratio * 100)}分，专业水平评定"
    }
    
    return safe_descriptions.get(item, f"专业评价结果：{int(score_ratio * 100)}分")


def get_professional_description(item: str, score_ratio: float, question_type: str) -> str:
    descriptions = {
        # 概括题专业描述
        "审题定标能力": {
            "excellent": "准确把握概括对象、范围和要求，审题精准无误",
            "good": "基本明确概括要素，审题较为准确",
            "fair": "概括要素识别基本正确，审题能力待提升",
            "poor": "概括对象不明确，审题存在偏差"
        },
        "精准找点能力": {
            "excellent": "关键词定位精准，多主体视角搜寻全面，要点提取完整",
            "good": "要点搜寻较为全面，关键信息提取能力良好",
            "fair": "基本能够找到主要要点，搜寻能力有待加强",
            "poor": "要点搜寻不够全面，关键信息遗漏较多"
        },
        "逻辑归并能力": {
            "excellent": "分类合并逻辑清晰，语言精炼度高，整合能力出色",
            "good": "逻辑归类较为合理，语言表达比较简洁",
            "fair": "基本能够进行分类整理，语言精炼度一般",
            "poor": "分类逻辑不清，语言冗余，整合能力不足"
        },
        "规范成文能力": {
            "excellent": "总分结构完整，要点序号化清晰，成文规范",
            "good": "结构层次比较清晰，要点呈现较为规范",
            "fair": "基本采用总分结构，成文规范性一般",
            "poor": "结构不够清晰，成文规范性有待提高"
        },
        
        # 综合分析题专业描述
        "审题拆解能力": {
            "excellent": "准确识别分析类型，核心对象锁定精准，拆解能力强",
            "good": "分析类型判断较准确，对象识别比较明确",
            "fair": "基本能够进行审题拆解，准确性有待提升",
            "poor": "审题拆解不够准确，分析方向存在偏差"
        },
        "搜寻组件能力": {
            "excellent": "深入挖掘定义表现、原因目的、影响意义等逻辑组件",
            "good": "较好地搜寻到多种逻辑组件，材料利用充分",
            "fair": "基本能够找到相关组件，搜寻深度一般",
            "poor": "逻辑组件搜寻不够深入，材料利用不充分"
        },
        "逻辑重构能力": {
            "excellent": "分析框架完整，论证链条严密，逻辑重构能力突出",
            "good": "分析框架较为完整，论证逻辑比较清晰",
            "fair": "基本能够构建分析思路，逻辑重构能力一般",
            "poor": "分析框架不够完整，逻辑重构能力有待加强"
        },
        "规范作答能力": {
            "excellent": "观点前置明确，论述清晰有条理，表达规范",
            "good": "观点表达比较明确，论述条理性较好",
            "fair": "基本能够规范作答，表达清晰度一般",
            "poor": "观点不够明确，论述条理性有待提高"
        },
        
        # 对策题专业描述
        "问题诊断能力": {
            "excellent": "准确识别问题本质，深挖根本原因，诊断能力强",
            "good": "问题识别较为准确，原因分析比较深入",
            "fair": "基本能够识别主要问题，诊断深度一般",
            "poor": "问题识别不够准确，根本原因挖掘不足"
        },
        "角色定位能力": {
            "excellent": "身份权责定位准确，解决视角锁定精准",
            "good": "角色定位比较明确，权责范围把握较好",
            "fair": "基本明确角色定位，视角选择基本正确",
            "poor": "角色定位不够清晰，权责范围把握不准"
        },
        "对策来源能力": {
            "excellent": "直接提炼、问题反推、经验借鉴运用娴熟，对策丰富",
            "good": "对策来源途径较多，材料利用比较充分",
            "fair": "基本能够从材料中提取对策，来源途径一般",
            "poor": "对策来源单一，材料利用不够充分"
        },
        "结构表达能力": {
            "excellent": "逻辑归类清晰，动词化表述规范，可操作性强",
            "good": "结构层次比较清晰，表述较为规范",
            "fair": "基本能够分类表述，结构规范性一般",
            "poor": "结构层次不清，表述规范性有待提高"
        },
        
        # 应用文写作题专业描述
        "情境解构能力": {
            "excellent": "身份、对象、目的三要素分析透彻，情境把握准确",
            "good": "情境要素分析较为全面，场景理解比较到位",
            "fair": "基本能够进行情境分析，三要素识别一般",
            "poor": "情境解构不够深入，三要素把握不准"
        },
        "格式遵从能力": {
            "excellent": "标题、称谓、正文、落款格式完全规范，符合文种要求",
            "good": "格式基本规范，文种要求掌握较好",
            "fair": "格式基本正确，规范性有待完善",
            "poor": "格式存在不规范，文种要求掌握不足"
        },
        "内容组织能力": {
            "excellent": "逻辑框架完整，材料信息整合充分，内容组织出色",
            "good": "内容组织较为有序，材料运用比较恰当",
            "fair": "基本能够组织内容，逻辑框架一般",
            "poor": "内容组织缺乏条理，材料整合不足"
        },
        "语言匹配能力": {
            "excellent": "语气风格与写作情境高度适配，语言得体准确",
            "good": "语言风格比较得体，情境适配性较好",
            "fair": "语言基本得体，风格匹配度一般",
            "poor": "语言风格不够得体，情境适配性不足"
        }
    }
    
    # 根据得分比例选择描述级别
    if score_ratio >= 0.85:
        level = "excellent"
    elif score_ratio >= 0.70:
        level = "good" 
    elif score_ratio >= 0.60:
        level = "fair"
    else:
        level = "poor"
    
    # 获取对应的专业描述
    item_descriptions = descriptions.get(item, {})
    return item_descriptions.get(level, f"{item}表现{level}")  # fallback




async def grade_essay_with_ai(essay_content: str, question_type: Optional[str] = None) -> EssayGradingResult:
    """
    使用OpenAI GPT模型对申论文章进行智能批改
    
    Args:
        essay_content: 申论文章内容
        question_type: 申论题型（概括题、综合分析题、对策题、应用文写作题），可选，AI将自动判断
        
    Returns:
        EssayGradingResult: 批改结果
        
    Raises:
        Exception: 当AI服务调用失败时抛出异常
    """
    
    try:
        # 初始化OpenAI客户端
        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base,
            default_headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
            }
        )
        
        # 生成基于《申论四大题型核心秘籍》的专业批改提示词
        prompt = create_expert_grading_prompt(essay_content, question_type or "概括题")
        
        # 调用OpenAI API
        response = await client.chat.completions.create(
            model=settings.openai_model_name,
            messages=[
                {
                    "role": "user",
                    "content": f"你是一位专业的申论批改专家。请严格按照要求返回JSON格式的评分结果。\n\n{prompt}"
                }
            ],
            temperature=0.2,
            max_tokens=4096
        )
        
        # 获取AI返回的内容
        ai_response = response.choices[0].message.content
        
        if not ai_response:
            raise ValueError("AI返回了空响应")
        
        # 【智能提取转换模式】保留AI完整思考能力，用于智能价值提取
        logger.info("★ 智能提取转换模式：保留AI完整思考能力")
        
        # 解析简化的JSON响应
        logger.info(f"AI原始响应前500字符: {ai_response[:500]}")
        try:
            # 寻找JSON对象的开始和结束
            json_start = ai_response.find('{')
            json_end = ai_response.rfind('}')
            
            if json_start != -1 and json_end != -1 and json_end > json_start:
                json_str = ai_response[json_start:json_end + 1]
                result_data = json.loads(json_str)
                logger.info(f"简化JSON解析成功: {result_data.keys()}")
                
            else:
                # 如果没有找到JSON，使用fallback解析
                result_data = parse_grading_response_to_json(ai_response)
                logger.info("使用fallback解析方式")
                
        except json.JSONDecodeError as e:
            logger.warning(f"JSON解析失败，使用fallback: {str(e)}")
            result_data = parse_grading_response_to_json(ai_response)
        
        # 验证和处理必需字段，提供默认值
        score = result_data.get("score", 75.0)
        feedback = result_data.get("feedback", "AI批改完成，请参考建议进行改进。")
        suggestions = result_data.get("suggestions", ["请检查答题逻辑", "建议多加练习"])
        
        # 清理Unicode字符，避免编码问题
        feedback = clean_unicode_text(feedback)
        suggestions = [clean_unicode_text(s) for s in suggestions]
        # Additional sanitization to prevent thinking-process leakage
        feedback = sanitize_text_public(feedback, location="feedback")
        if isinstance(suggestions, list):
            suggestions = [
                sanitize_text_public(s, location=f"suggestion_{i}")
                for i, s in enumerate(suggestions) if isinstance(s, str)
            ]
        
        # 【智能提取转换】AI反馈将用于后续智能分析和价值提取
        logger.info("★ 智能提取转换：AI反馈保留用于智能分析")
        
        logger.info(f"处理后的数据 - 分数: {score}, 反馈长度: {len(feedback)}, 反馈前100字符: {feedback[:100]}")
        logger.info(f"建议数量: {len(suggestions)}, 建议: {suggestions[:2]}")
        
        # 确保score是数字类型且在合理范围内
        try:
            score = float(score)
            if not (0 <= score <= 100):
                score = max(0, min(100, score))  # 限制在0-100范围内
        except (ValueError, TypeError):
            score = 75.0
        
        # 确保feedback是字符串
        if not isinstance(feedback, str):
            feedback = str(feedback) if feedback else "AI批改完成。"
        
        # 确保suggestions是列表
        if not isinstance(suggestions, list):
            if isinstance(suggestions, str):
                suggestions = [suggestions]
            else:
                suggestions = ["请检查答题逻辑", "建议多加练习"]
        
        # 生成更智能的评分细则
        scoreDetails = generate_adaptive_score_details(essay_content, question_type or "概括题", score, feedback)
        
        # 清理评分细则中的Unicode字符
        if scoreDetails:
            for detail in scoreDetails:
                detail.description = clean_unicode_text(detail.description)
        
        # 构造并返回结果
        return EssayGradingResult(
            score=score,
            feedback=feedback,
            suggestions=suggestions,
            scoreDetails=scoreDetails
        )
        
    except Exception as e:
        logger.error(f"AI批改服务调用失败: {e}")
        logger.error(f"错误类型: {type(e).__name__}")
        logger.error(f"错误详情: {str(e)}")
        
        # 详细的错误分类处理
        error_type = type(e).__name__
        error_msg = str(e).lower()
        
        if "api_key" in error_msg or "authentication" in error_msg or "unauthorized" in error_msg:
            logger.error("API密钥验证失败")
            raise Exception("AI服务认证失败，请检查API密钥配置")
        elif "connection" in error_msg or "timeout" in error_msg or "network" in error_msg:
            logger.error("网络连接问题")
            raise Exception("网络连接超时，请稍后重试")
        elif "rate_limit" in error_msg or "quota" in error_msg:
            logger.error("API调用频率限制")
            raise Exception("API调用频率超限，请稍后重试")
        elif "model_not_found" in error_msg:
            logger.error("AI模型不可用")
            raise Exception("AI模型服务不可用，请联系管理员")
        elif error_type == "JSONDecodeError":
            logger.error("AI响应格式解析错误")
            raise Exception("AI服务返回格式异常，请重试")
        else:
            logger.error(f"未知错误类型: {error_type}")
            raise Exception(f"AI服务暂时不可用，错误信息: {str(e)[:100]}")


async def get_ai_service_status() -> dict:
    """
    检查AI服务状态
    
    Returns:
        dict: 服务状态信息
    """
    try:
        # 检查API密钥是否配置
        api_key = settings.openai_api_key
        if not api_key or api_key == "sk-your-openai-api-key-here":
            return {
                "status": "error",
                "message": "OpenAI API密钥未正确配置"
            }
        
        return {
            "status": "ready",
            "message": "AI服务已就绪",
            "model": settings.openai_model_name,
            "api_base": settings.openai_api_base
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"AI服务配置错误: {str(e)}"
        }

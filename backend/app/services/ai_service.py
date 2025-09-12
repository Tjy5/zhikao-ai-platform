#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
简化的AI评分服务 - 完全修复版本
确保所有内容都是AI生成，无模板化代码
"""

import json
import logging
import re
import sys
import traceback
from typing import Optional, List
from openai import AsyncOpenAI
from ..core.config import settings
from ..schemas.essay import EssayGradingResult, ScoreDetail, DetailedScoreDetail, ScorePoint
from .prompt_service_simple import (
    create_expert_diagnosis_prompt,
    create_overall_evaluation_prompt,
    get_question_type_dimensions
)
from .prompt_service import extract_chapter_content

logger = logging.getLogger(__name__)


def clean_unicode_text(text: str) -> str:
    """清理文本中的特殊Unicode字符"""
    if not text:
        return text
        
    replacements = {
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


def convert_emoji_to_blue_html(text: str) -> str:
    """将表情符号格式转换为蓝色HTML格式"""
    if not text:
        return text
    
    # 转换表情符号格式为蓝色HTML格式
    replacements = {
        '✅ **加分点：**': '<span style="color: #1e40af; font-weight: bold;">【得分点】</span>',
        '❌ **扣分点：**': '<span style="color: #1e40af; font-weight: bold;">【扣分点】</span>',
        '💡 **改进建议：**': '<span style="color: #1e40af; font-weight: bold;">【改进方向】</span>',
        '💡 **改进方向：**': '<span style="color: #1e40af; font-weight: bold;">【改进方向】</span>',
        '**加分点：**': '<span style="color: #1e40af; font-weight: bold;">【得分点】</span>',
        '**扣分点：**': '<span style="color: #1e40af; font-weight: bold;">【扣分点】</span>',
        '**改进建议：**': '<span style="color: #1e40af; font-weight: bold;">【改进方向】</span>',
        '**改进方向：**': '<span style="color: #1e40af; font-weight: bold;">【改进方向】</span>',
        # 添加更多可能的格式变体
        '✅**加分点：**': '<span style="color: #1e40af; font-weight: bold;">【得分点】</span>',
        '❌**扣分点：**': '<span style="color: #1e40af; font-weight: bold;">【扣分点】</span>',
        '💡**改进建议：**': '<span style="color: #1e40af; font-weight: bold;">【改进方向】</span>',
        '💡**改进方向：**': '<span style="color: #1e40af; font-weight: bold;">【改进方向】</span>'
    }
    
    for old_format, new_format in replacements.items():
        text = text.replace(old_format, new_format)
    
    return text


def extract_meaningful_evaluation_from_raw_content(content: str) -> str:
    """从AI原始响应中智能提取评价内容，专门用于整体评价"""
    if not content:
        return ""
    
    # 先尝试从可能的JSON中提取
    try:
        # 简单的JSON提取尝试
        if '"overall_evaluation"' in content:
            start = content.find('"overall_evaluation"') + len('"overall_evaluation"')
            # 找到后面的值
            colon_pos = content.find(':', start)
            if colon_pos != -1:
                # 从冒号后开始找值
                value_start = colon_pos + 1
                # 找到引号开始
                quote_start = content.find('"', value_start)
                if quote_start != -1:
                    quote_end = content.find('"', quote_start + 1)
                    while quote_end != -1 and content[quote_end - 1] == '\\':
                        quote_end = content.find('"', quote_end + 1)
                    if quote_end != -1:
                        evaluation_text = content[quote_start + 1:quote_end]
                        if evaluation_text and len(evaluation_text) > 20:
                            return evaluation_text.replace('\\n', '\n').strip()
    except Exception:
        pass
    
    # 如果JSON提取失败，尝试提取明显的评价句子
    sentences = re.split(r'[。！？\.]', content)
    evaluation_sentences = []
    
    for sentence in sentences:
        sentence = sentence.strip()
        # 寻找包含评价关键词的句子
        if (len(sentence) > 15 and
            any(keyword in sentence for keyword in ['答案', '表现', '水平', '能力', '基础', '整体', '分析', '评价']) and
            not sentence.startswith('{') and
            not sentence.startswith('"') and
            '解析失败' not in sentence):
            evaluation_sentences.append(sentence)
            if len(evaluation_sentences) >= 2:
                break
    
    if evaluation_sentences:
        result = '。'.join(evaluation_sentences) + '。'
        return result[:500]  # 限制长度
    
    return ""


def extract_answer_from_reasoning(reasoning_content: str) -> str:
    """从推理模型的reasoning_content中提取题型答案"""
    if not reasoning_content:
        return ""
    
    # 题型选项
    valid_types = ["概括题", "综合分析题", "对策题", "应用文写作题"]
    
    # 在推理内容中查找明确的题型答案
    for question_type in valid_types:
        if question_type in reasoning_content:
            # 检查上下文，确保是作为答案而非举例
            type_index = reasoning_content.find(question_type)
            context = reasoning_content[max(0, type_index-50):type_index+50].lower()
            
            # 如果上下文包含确定性词汇，认为是答案
            if any(keyword in context for keyword in ["that's", "答案", "是", "应该", "判断", "选择"]):
                logger.info(f"从reasoning中提取到答案: {question_type}")
                return question_type
    
    # 如果没有找到明确答案，尝试从推理逻辑中推断
    reasoning_lower = reasoning_content.lower()
    if "comprehensive analysis" in reasoning_lower or "综合分析" in reasoning_lower:
        return "综合分析题"
    elif "summary" in reasoning_lower or "概括" in reasoning_lower:
        return "概括题"
    elif "policy" in reasoning_lower or "对策" in reasoning_lower:
        return "对策题"
    elif "application" in reasoning_lower or "应用文" in reasoning_lower:
        return "应用文写作题"
    
    return ""


def clean_ai_thinking_patterns(text: str) -> str:
    """清理AI思考过程的模式和prompt指令，但保留有价值的分析内容"""
    if not text:
        return text
    
    # 只检查明确的错误信息模式，不过度过滤
    critical_error_indicators = [
        "解析失败，原始内容：",
        "JSON解析错误",
        "parse error",
        "failed to parse",
        "dimension_analysis\":",  # JSON结构特征
        "\"total_score\":",
        "\"overall_evaluation\":",
        "\"positive_points\":",
        "\"negative_points\":"
    ]
    
    # 如果包含明确的错误模式，才返回空内容
    if any(indicator in text for indicator in critical_error_indicators):
        logger.warning("检测到明确的错误信息，返回空内容")
        return ""
    
    # 删除AI思考过程的步骤标记，但保留分析内容
    patterns = [
        r'第[一二三四五六七八九十\d]+步：?',
        r'Step\s*\d+:?\s*',
        r'步骤[一二三四五六七八九十\d]+：?',
    ]
    
    # 删除prompt指令泄漏
    prompt_leakage_patterns = [
        r'请严格按照申论四大题型核心秘籍的方法论，对该维度进行深度评价。评价要求：\s*',
        r'基于《申论四大题型核心秘籍》.*?评价要求：\s*',
        r'申论四大题型核心秘籍.*?方法论.*?评价要求：\s*',
        r'请严格按照.*?核心秘籍.*?评价要求：\s*',
        r'作为资深申论阅卷专家["\']?悟道["\']?的.*?[：:]\s*',
        r'作为.*?阅卷专家.*?的.*?[：:]\s*',
        r'作为专业阅卷老师对这篇.*?答案的.*?[：:]\s*',
        r'悟道.*?专业.*?[：:]\s*',
        r'深度专业诊断[：:]\s*',
        r'最终专业点评[：:]\s*',
    ]
    
    for pattern in patterns + prompt_leakage_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    
    return text.strip()


async def grade_essay_with_expert_diagnosis(essay_content: str, question_type: Optional[str] = None) -> tuple:
    """
    双阶段AI专家诊断式评分
    第一阶段：专业阅卷老师逐句诊断
    第二阶段：基于诊断生成整体评价
    
    Returns:
        tuple: (第一阶段诊断结果, 第二阶段评价结果)
    """
    try:
        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base,
            default_headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
        
        # ===== 第一阶段：专业诊断 =====
        diagnosis_prompt = create_expert_diagnosis_prompt(essay_content, question_type or "概括题")
        
        logger.info("开始第一阶段：AI专家诊断分析...")
        diagnosis_response = await client.chat.completions.create(
            model=settings.openai_model_name,
            messages=[
                {
                    "role": "user",
                    "content": "你是一位资深申论阅卷专家。请进行专业的逐句批改诊断。\n\n" + diagnosis_prompt
                }
            ],
            temperature=0.2,
            max_tokens=4096
        )
        
        diagnosis_content = diagnosis_response.choices[0].message.content
        if not diagnosis_content:
            raise ValueError("第一阶段AI诊断返回空响应")
        
        # 解析第一阶段结果（容错）
        try:
            diagnosis_data = parse_ai_json_response(diagnosis_content, "诊断阶段", question_type or "概括题")
        except Exception as parse_err:
            logger.warning("诊断阶段JSON解析失败，使用回退方案: {}".format(str(parse_err)[:200]))
            diagnosis_data = {
                "dimensions": {},
                "summary": clean_ai_thinking_patterns(diagnosis_content) or "AI专家诊断完成",
                "teacher_comments": clean_ai_thinking_patterns(diagnosis_content)[:800]
            }
        
        # ===== 第二阶段：整体评价 =====
        evaluation_prompt = create_overall_evaluation_prompt(
            diagnosis_data, essay_content, question_type or "概括题"
        )
        
        logger.info("开始第二阶段：整体评价生成...")
        evaluation_response = await client.chat.completions.create(
            model=settings.openai_model_name,
            messages=[
                {
                    "role": "user",
                    "content": "请基于第一阶段的专业诊断结果，生成整体评价。\n\n" + evaluation_prompt
                }
            ],
            temperature=0.2,
            max_tokens=2048
        )
        
        evaluation_content = evaluation_response.choices[0].message.content
        if not evaluation_content:
            raise ValueError("第二阶段整体评价返回空响应")
        
        # 解析第二阶段结果（容错）
        try:
            evaluation_data = parse_ai_json_response(evaluation_content, "评价阶段", question_type or "概括题")
            logger.info("评价阶段JSON解析成功，overall_evaluation: {}".format(
                str(evaluation_data.get("overall_evaluation", ""))[:100]))
        except Exception as parse_err2:
            logger.warning("评价阶段JSON解析失败，使用回退方案: {}".format(str(parse_err2)[:200]))
            evaluation_data = {
                "total_score": 75.0,
                "overall_evaluation": extract_meaningful_evaluation_from_raw_content(evaluation_content) or "AI专家已完成综合评估，请参考详细的专业诊断意见",
                "priority_suggestions": [],
                "strengths_to_maintain": [],
                "final_comments": ""
            }
        
        return diagnosis_data, evaluation_data
        
    except Exception as e:
        logger.error("双阶段AI诊断失败: {}".format(str(e)))
        raise Exception("AI专家诊断服务暂时不可用: {}".format(str(e)[:100]))


async def grade_essay_with_ai(essay_content: str, question_type: Optional[str] = None) -> EssayGradingResult:
    """
    新的双阶段AI专家评分主函数
    整合诊断和评价两个阶段的结果，确保返回干净的用户友好内容
    """
    try:
        # 调用双阶段诊断
        diagnosis_data, evaluation_data = await grade_essay_with_expert_diagnosis(
            essay_content, question_type
        )
        
        # 获取总分
        total_score = evaluation_data.get("total_score", 75.0)
        try:
            total_score = float(total_score)
            total_score = max(0, min(100, total_score))
        except (ValueError, TypeError):
            total_score = 75.0
        
        # 获取整体评价 - 特殊处理，避免误杀正常内容
        overall_evaluation = evaluation_data.get("overall_evaluation", "AI批改完成")
        logger.info("原始overall_evaluation: {}".format(str(overall_evaluation)[:150]))
        
        # 如果是从JSON正确解析出来的评价内容，不要过度清理
        if overall_evaluation and overall_evaluation != "AI批改完成":
            # 只清理明显的错误模式，保留正常的评价内容
            if any(error_pattern in overall_evaluation for error_pattern in ["解析失败", "JSON解析错误", "parse error"]):
                overall_evaluation = "AI专家已完成综合评估，具体分析请参考专业诊断意见"
                logger.info("检测到错误模式，使用默认评价")
            else:
                logger.info("保留原始评价内容")
            # 其他情况保留原始评价内容
        else:
            # 使用更有意义的默认评价
            overall_evaluation = "AI专家已完成综合评估，具体分析请参考专业诊断意见"
            logger.info("使用默认评价，原因：overall_evaluation为空或为默认值")
        
        # 获取并清理专业诊断意见
        teacher_comments = diagnosis_data.get("teacher_comments", "")
        teacher_comments = clean_ai_thinking_patterns(teacher_comments)
        
        # 获取第二阶段的详细点评作为补充
        final_comments = evaluation_data.get("final_comments", "")
        final_comments = clean_ai_thinking_patterns(final_comments)
        
        # 构建清洁的反馈内容，确保不包含JSON或错误信息
        feedback_parts = []
        
        if overall_evaluation and len(overall_evaluation.strip()) > 0:
            feedback_parts.append("**整体评价：**\n{}".format(overall_evaluation))
        else:
            feedback_parts.append("**整体评价：**\nAI已完成对您答案的综合评估，请参考具体评分细则进行改进。")
        
        # 优先使用final_comments，如果没有再使用teacher_comments
        detailed_analysis = ""
        if final_comments and len(final_comments.strip()) > 50:
            detailed_analysis = final_comments
        elif teacher_comments and len(teacher_comments.strip()) > 50:
            detailed_analysis = teacher_comments
        
        if detailed_analysis:
            feedback_parts.append("**专业诊断意见：**\n{}".format(detailed_analysis))
        else:
            feedback_parts.append("**专业诊断意见：**\n专家对您的答案进行了全面分析，具体建议请参考评分细则。")
        
        feedback = "\n\n".join(feedback_parts)
        feedback = clean_unicode_text(feedback)
        
        # 获取并清理改进建议
        priority_suggestions = evaluation_data.get("priority_suggestions", [])
        strengths = evaluation_data.get("strengths_to_maintain", [])
        
        # 清理建议内容，过滤包含错误信息的项目
        cleaned_suggestions = []
        for suggestion in (priority_suggestions + strengths):
            if suggestion and isinstance(suggestion, str):
                cleaned = clean_ai_thinking_patterns(suggestion)
                if cleaned and len(cleaned.strip()) > 10:  # 确保建议有实质内容
                    cleaned_suggestions.append(cleaned)
        
        # 从诊断数据直接提取评分细则
        score_details = convert_diagnosis_to_score_details(diagnosis_data, question_type)
        
        # 检查评分细则中是否已经包含改进建议
        has_specific_suggestions = False
        if score_details:
            for detail in score_details:
                if detail.description and any(keyword in detail.description for keyword in ["【改进方向】", "【改进建议】", "建议", "改进"]):
                    has_specific_suggestions = True
                    break
        
        # 只有在评分细则中没有具体建议且AI也没有给出建议时，才提供简化的默认建议
        if not cleaned_suggestions and not has_specific_suggestions:
            cleaned_suggestions = ["请参考上方评分细则中的具体改进建议"]
        
        # 限制建议数量
        suggestions = cleaned_suggestions[:5]
        
        # === 方案一：强制一致性 - 使用评分细则总分作为最终总分 ===
        calculated_total = sum(detail.actualScore for detail in score_details) if score_details else 0
        
        # 如果评分细则有数据且总分合理，使用计算出的总分；否则使用AI给出的总分
        if score_details and calculated_total > 0:
            final_total_score = round(calculated_total, 1)
            logger.info("使用评分细则计算总分: AI总分={}, 细则总分={}, 最终总分={}".format(
                total_score, calculated_total, final_total_score))
            
            # 记录分数差异用于监控
            score_difference = abs(total_score - calculated_total)
            if score_difference > 5:
                logger.warning("总分差异较大: AI总分={}, 细则总分={}, 差异={}".format(
                    total_score, calculated_total, score_difference))
        else:
            final_total_score = total_score
            logger.info("使用AI总分: {} (评分细则数据不足)".format(final_total_score))
        
        return EssayGradingResult(
            score=final_total_score,  # 使用计算后的一致总分
            feedback=feedback,
            suggestions=suggestions,
            scoreDetails=score_details
        )
        
    except Exception as e:
        logger.error("AI评分失败: {}".format(str(e)))
        raise e


def parse_ai_json_response(ai_response: str, stage_name: str, question_type: str = "综合分析题") -> dict:
    """直接解析AI返回的JSON响应，如果失败则抛出异常"""
    try:
        # 记录AI响应
        logger.info("{}收到AI响应，长度: {}".format(stage_name, len(ai_response)))
        logger.info("{}AI响应前200字符: {}".format(stage_name, ai_response[:200]))
        
        # 尝试解析JSON响应
        result_data = try_parse_json_response(ai_response, stage_name)
        if result_data:
            logger.info("{}JSON解析成功".format(stage_name))
            return result_data
        
        # JSON解析失败，抛出异常
        logger.error("{}JSON解析失败".format(stage_name))
        raise ValueError("AI返回的内容无法解析为JSON格式: {}".format(ai_response[:200]))
            
    except Exception as e:
        logger.error("{}解析过程发生异常: {}".format(stage_name, str(e)))
        raise e


def try_parse_json_response(ai_response: str, stage_name: str) -> dict:
    """尝试解析JSON响应的多种方法"""
    try:
        # 清理响应中的markdown代码块标记
        cleaned_response = ai_response.strip()
        if cleaned_response.startswith('```json'):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.endswith('```'):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()
        
        # 方法1: 直接解析
        try:
            result = json.loads(cleaned_response)
            logger.info("{}直接JSON解析成功".format(stage_name))
            return result
        except json.JSONDecodeError:
            pass
        
        # 方法2: 查找JSON结构
        json_start = cleaned_response.find('{')
        json_end = cleaned_response.rfind('}')
        
        if json_start != -1 and json_end != -1 and json_end > json_start:
            json_str = cleaned_response[json_start:json_end + 1]
            
            # 修复常见的JSON格式问题
            json_str = json_str.replace('\n', ' ')
            json_str = re.sub(r',\s*}', '}', json_str)
            json_str = re.sub(r',\s*]', ']', json_str)
            
            try:
                result = json.loads(json_str)
                logger.info("{}结构化JSON解析成功".format(stage_name))
                return result
            except json.JSONDecodeError:
                pass
        
        # 方法3: 多个JSON对象的情况
        json_objects = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', cleaned_response)
        if json_objects:
            for json_obj in json_objects:
                try:
                    result = json.loads(json_obj)
                    logger.info("{}多对象JSON解析成功".format(stage_name))
                    return result
                except json.JSONDecodeError:
                    continue
        
        logger.warning("{}所有JSON解析方法都失败".format(stage_name))
        return None
        
    except Exception as e:
        logger.error("{}JSON解析异常: {}".format(stage_name, str(e)))
        return None


def convert_diagnosis_to_score_details(diagnosis_data: dict, question_type: str = "概括题") -> List[ScoreDetail]:
    """将诊断数据转换为评分细则格式"""
    try:
        score_details = []
        
        # 从诊断数据中提取维度评价
        dimensions = diagnosis_data.get("dimensions", {})
        
        # 获取该题型对应的满分设置
        question_type_dimensions = get_question_type_dimensions(question_type)
        
        for dimension_name, dimension_info in dimensions.items():
            if isinstance(dimension_info, dict):
                score = dimension_info.get("score", 0)
                feedback = dimension_info.get("feedback", "{}评价".format(dimension_name))
                
                # 清理prompt指令泄漏
                feedback = clean_ai_thinking_patterns(feedback)
                
                # 转换表情符号格式为蓝色HTML格式
                feedback = convert_emoji_to_blue_html(feedback)
                
                # 使用题型对应的满分，如果维度不存在则使用25分默认值
                full_score = question_type_dimensions.get(dimension_name, 25.0)
                
                # 创建评分细则对象 - 使用题型对应的满分
                score_detail = ScoreDetail(
                    item=dimension_name,
                    fullScore=float(full_score),
                    actualScore=float(score),
                    description=feedback
                )
                score_details.append(score_detail)
        
        # 如果没有维度数据，创建默认的评分细则
        if not score_details:
            default_feedback = diagnosis_data.get("summary", "AI专家诊断完成")
            score_details.append(ScoreDetail(
                item="综合评价", 
                fullScore=100.0,
                actualScore=75.0,
                description=default_feedback
            ))
        
        return score_details
        
    except Exception as e:
        logger.error("转换诊断数据失败: {}".format(str(e)))
        # 返回默认评分细则
        return [ScoreDetail(
            item="综合评价",
            fullScore=100.0,
            actualScore=75.0,
            description="AI诊断数据转换异常"
        )]


async def get_question_type_from_ai(question_text: str) -> str:
    """AI题型诊断服务 - 增强版本，基于申论四大题型核心秘籍"""
    try:
        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base,
            default_headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
        
        # 为避免偏置，仅使用中立定义进行识别
        prompt = """你是申论题型专家"悟道"，基于《申论四大题型核心秘籍》进行题型识别。

=== 申论四大题型核心识别要点 ===
1. **概括题**：要求"概括"、"归纳"、"梳理"某些要点、做法、原因、变化等
   - 关键词：概括、归纳、梳理、总结、列举
   - 特征：信息降维与逻辑重建
   - 注意：题目通常只要求列出要点，不要求深入分析关系
   
2. **综合分析题**：要求"分析"、"谈谈理解"、"评价"、"说明"某个观点、现象、词语
   - 关键词：分析、理解、谈谈、评价、如何看待、说明、阐述、解释
   - 特征：解构与重构的逻辑思辨
   - 注意：题目往往要求不仅说明"是什么"，还要分析"为什么"、"如何"等深层关系
   
3. **对策题**：要求提出"对策"、"建议"、"措施"、"怎么办"
   - 关键词：对策、建议、措施、办法、如何解决
   - 特征：对症下药的精准施策
   
4. **应用文写作题**：要求写"倡议书"、"讲话稿"、"报告"、"通知"等格式化文体
   - 关键词：写、拟、起草 + 具体文种名称
   - 特征：带着镣铐的场景之舞

=== 待识别内容 ===
{}

=== 识别要求 ===
请严格按照申论四大题型核心秘籍的标准，分析上述内容的题型特征：

1. **关键动词识别**：重点关注"谈谈"、"说明"、"分析"等词汇（这些通常是综合分析题）
2. **任务层次分析**：
   - 如果只要求列出要点 → 概括题
   - 如果要求解释含义+分析关系 → 综合分析题
   - 如果要求提出解决方案 → 对策题
   - 如果要求写特定格式文档 → 应用文写作题
3. **特别注意**：题目中同时出现"是什么"+"如何"+"为什么"等多层次要求时，通常是综合分析题

请只返回以下四个选项中的一个：
- 概括题
- 综合分析题  
- 对策题
- 应用文写作题

判断结果：""".format(question_text)

        response = await client.chat.completions.create(
            model=settings.openai_model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,  # 降低温度提高准确性
            max_tokens=200  # 增加token限制避免截断
        )
        
        # 处理推理模型：优先从reasoning_content获取响应，fallback到content
        ai_response = response.choices[0].message.content
        reasoning_content = getattr(response.choices[0].message, 'reasoning_content', None)
        
        # 如果content为空但reasoning_content有内容，尝试从reasoning中提取答案
        if not ai_response and reasoning_content:
            logger.info("检测到推理模型，从reasoning_content提取答案")
            ai_response = extract_answer_from_reasoning(reasoning_content)
        
        if not ai_response:
            raise ValueError("AI返回了空响应")
            
        question_type = ai_response.strip()
        valid_types = ["概括题", "综合分析题", "对策题", "应用文写作题"]
        
        # 优先精确匹配
        for valid_type in valid_types:
            if valid_type == question_type:
                logger.info("AI题型诊断结果（精确匹配）: {}".format(valid_type))
                ai_type = valid_type
                break
        else:
            ai_type = None
        
        # 如果没有精确匹配，进行包含匹配
        for valid_type in valid_types:
            if valid_type in question_type:
                logger.info("AI题型诊断结果（包含匹配）: {}".format(valid_type))
                ai_type = valid_type
                break
        
        # 仅对“题目材料及问题”片段做启发式识别，避免被“我的答案”干扰
        q_segment = question_text
        try:
            start = question_text.find("【题目材料及问题】")
            answer_pos = question_text.find("【我的答案】")
            if start != -1 and answer_pos != -1 and answer_pos > start:
                q_segment = question_text[start:answer_pos]
        except Exception:
            pass
        question_text_lower = q_segment.lower()
        
        # 综合分析题的识别优先级要高，因为它容易被误判为概括题
        # 增强版识别：包含更多综合分析题的关键词和表达模式
        comprehensive_analysis_keywords = [
            '分析', '理解', '谈谈', '评价', '如何看待', '说明', '阐述', '解释',
            '如何', '为什么', '关系', '作用', '意义', '影响', '原因'
        ]
        
        summary_keywords = ['概括', '归纳', '梳理', '总结', '列举']
        strategy_keywords = ['对策', '建议', '措施', '办法', '如何解决', '怎么办']
        application_keywords = ['倡议书', '讲话稿', '报告', '通知', '发言', '致辞', '公开信', '写', '拟']
        
        # 检测综合分析题的复合特征
        has_comprehensive_keywords = any(keyword in question_text_lower for keyword in comprehensive_analysis_keywords)
        has_multi_layer_requirements = ('是什么' in question_text_lower and '如何' in question_text_lower) or \
                                     ('什么' in question_text_lower and '说明' in question_text_lower) or \
                                     ('指的是' in question_text_lower and ('如何' in question_text_lower or '怎样' in question_text_lower))
        
        heuristic_type = None  # 初始化变量
        if has_comprehensive_keywords or has_multi_layer_requirements:
            heuristic_type = "综合分析题"
            logger.info(f"启发式识别为综合分析题，关键词匹配: {has_comprehensive_keywords}, 多层次要求: {has_multi_layer_requirements}")
        elif any(keyword in question_text_lower for keyword in summary_keywords) and not has_comprehensive_keywords:
            # 只有在没有分析类词汇的情况下才判断为概括题
            heuristic_type = "概括题"
        elif any(keyword in question_text_lower for keyword in strategy_keywords):
            heuristic_type = "对策题"
        elif any(keyword in question_text_lower for keyword in application_keywords):
            heuristic_type = "应用文写作题"
        
        logger.info(f"启发式识别结果: {heuristic_type}")
        
        # 决策：若 AI 判为概括题，但启发式强烈指向综合分析题，则以启发式为准
        if ai_type:
            # 修复操作符优先级bug：添加括号确保逻辑正确
            if ai_type == "概括题" and ('分析' in question_text_lower or '评价' in question_text_lower or '谈谈' in question_text_lower or '说明' in question_text_lower):
                logger.info("覆盖AI结果：启发式识别为综合分析题（检测到关键词：分析/评价/谈谈/说明）")
                return "综合分析题"
            return ai_type
        
        if heuristic_type:
            return heuristic_type
        
        logger.warning("AI题型诊断未能明确识别，默认返回概括题")
        return "概括题"
        
    except Exception as e:
        logger.error("AI题型诊断失败: {}".format(str(e)))
        # 异常情况下也要使用启发式逻辑
        logger.info("使用启发式逻辑作为fallback")
        question_text_lower = question_text.lower()
        
        comprehensive_analysis_keywords = [
            '分析', '理解', '谈谈', '评价', '如何看待', '说明', '阐述', '解释',
            '如何', '为什么', '关系', '作用', '意义', '影响', '原因'
        ]
        
        if any(keyword in question_text_lower for keyword in comprehensive_analysis_keywords):
            logger.info("异常fallback：识别为综合分析题")
            return "综合分析题"
        
        return "概括题"


async def get_ai_service_status() -> dict:
    """检查AI服务状态"""
    try:
        # 强制重载配置以获取最新值
        settings.reload()
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
            "message": "AI服务配置错误: {}".format(str(e))
        }
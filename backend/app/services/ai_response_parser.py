"""
AI响应解析器模块
处理AI模型返回的各种格式响应
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from .text_utils import clean_ai_thinking_patterns, normalize_whitespace

logger = logging.getLogger(__name__)


class AIResponseParser:
    """AI响应解析器"""
    
    @staticmethod
    def extract_json_from_response(content: str) -> Optional[Dict[str, Any]]:
        """从响应中提取JSON数据"""
        if not content:
            return None
            
        try:
            # 尝试直接解析
            if content.strip().startswith('{'):
                return json.loads(content)
            
            # 查找JSON块
            json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
            matches = re.findall(json_pattern, content, re.DOTALL)
            
            for match in matches:
                try:
                    return json.loads(match)
                except json.JSONDecodeError:
                    continue
                    
        except Exception as e:
            logger.warning(f"JSON解析失败: {e}")
            
        return None
    
    @staticmethod
    def parse_score_details(raw_data: Any) -> List[Dict[str, Any]]:
        """解析评分细节数据"""
        if not raw_data:
            return []
            
        # 处理不同格式的输入
        if isinstance(raw_data, str):
            try:
                raw_data = json.loads(raw_data)
            except json.JSONDecodeError:
                return []
        
        # 提取数组数据
        if isinstance(raw_data, dict):
            # 尝试多个可能的键名
            for key in ['data', 'items', 'details', 'scores']:
                if key in raw_data and isinstance(raw_data[key], list):
                    raw_data = raw_data[key]
                    break
        
        if not isinstance(raw_data, list):
            return []
        
        # 标准化每个评分项
        score_details = []
        for item in raw_data:
            if isinstance(item, dict):
                detail = {
                    'item': str(item.get('item', item.get('name', item.get('title', '')))),
                    'fullScore': float(item.get('fullScore', item.get('full_score', item.get('max', 100)))),
                    'actualScore': float(item.get('actualScore', item.get('actual_score', item.get('score', 0)))),
                    'description': str(item.get('description', item.get('desc', item.get('detail', ''))))
                }
                
                # 清理描述文本
                detail['description'] = clean_ai_thinking_patterns(detail['description'])
                
                if detail['item']:  # 只保留有效项目
                    score_details.append(detail)
        
        return score_details
    
    @staticmethod
    def parse_suggestions(raw_suggestions: Any) -> List[str]:
        """解析建议列表"""
        if not raw_suggestions:
            return []
        
        if isinstance(raw_suggestions, str):
            # 如果是字符串，按行分割
            suggestions = [s.strip() for s in raw_suggestions.split('\n') if s.strip()]
        elif isinstance(raw_suggestions, list):
            suggestions = [str(s).strip() for s in raw_suggestions if str(s).strip()]
        else:
            return []
        
        # 清理每个建议
        cleaned_suggestions = []
        for suggestion in suggestions:
            cleaned = clean_ai_thinking_patterns(suggestion)
            cleaned = normalize_whitespace(cleaned)
            if len(cleaned) > 10:  # 过滤过短的建议
                cleaned_suggestions.append(cleaned)
        
        return cleaned_suggestions[:10]  # 限制数量
    
    @staticmethod
    def extract_score_from_response(content: str, default: float = 75.0) -> float:
        """从响应中提取分数"""
        if not content:
            return default
        
        try:
            # 尝试从JSON中提取
            json_data = AIResponseParser.extract_json_from_response(content)
            if json_data:
                for key in ['score', 'total_score', 'totalScore', 'final_score']:
                    if key in json_data:
                        score = float(json_data[key])
                        return max(0, min(100, score))  # 限制在0-100范围
            
            # 尝试用正则表达式提取
            score_patterns = [
                r'分数[：:]?\s*(\d+(?:\.\d+)?)',
                r'得分[：:]?\s*(\d+(?:\.\d+)?)',
                r'总分[：:]?\s*(\d+(?:\.\d+)?)',
                r'score[：:]?\s*(\d+(?:\.\d+)?)',
            ]
            
            for pattern in score_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                if matches:
                    score = float(matches[0])
                    if 0 <= score <= 100:
                        return score
                        
        except (ValueError, TypeError) as e:
            logger.warning(f"分数提取失败: {e}")
        
        return default
    
    @staticmethod
    def parse_ai_json_response(
        content: str, 
        stage_name: str = "未知阶段", 
        task_type: str = "unknown"
    ) -> Dict[str, Any]:
        """
        解析AI的JSON响应，提供容错处理
        """
        result = {
            "dimensions": {},
            "summary": "",
            "teacher_comments": "",
            "total_score": 75.0,
            "overall_evaluation": "",
            "final_comments": "",
            "score_details": []
        }
        
        if not content:
            logger.warning(f"{stage_name}响应为空")
            return result
        
        try:
            # 尝试解析JSON
            json_data = AIResponseParser.extract_json_from_response(content)
            if not json_data:
                logger.warning(f"{stage_name}未找到有效JSON，使用文本回退")
                result["summary"] = clean_ai_thinking_patterns(content[:200])
                return result
            
            # 提取各个字段
            result.update({
                "dimensions": json_data.get("dimensions", {}),
                "summary": clean_ai_thinking_patterns(str(json_data.get("summary", ""))),
                "teacher_comments": clean_ai_thinking_patterns(str(json_data.get("teacher_comments", ""))),
                "total_score": AIResponseParser.extract_score_from_response(str(json_data.get("total_score", 75))),
                "overall_evaluation": clean_ai_thinking_patterns(str(json_data.get("overall_evaluation", ""))),
                "final_comments": clean_ai_thinking_patterns(str(json_data.get("final_comments", ""))),
                "score_details": AIResponseParser.parse_score_details(json_data.get("score_details", []))
            })
            
            logger.info(f"{stage_name}JSON解析成功")
            return result
            
        except Exception as e:
            logger.error(f"{stage_name}JSON解析失败: {e}")
            # 使用文本回退
            result["summary"] = clean_ai_thinking_patterns(content[:200])
            return result
    
    @staticmethod
    def extract_answer_from_reasoning(reasoning_content: str) -> str:
        """从推理模型的reasoning_content中提取任务类型答案"""
        if not reasoning_content:
            return ""
        
        # 任务类型选项
        valid_types = ["summary", "analysis", "solution", "format-writing"]
        
        # 在推理内容中查找明确的任务类型答案
        for task_type in valid_types:
            if task_type in reasoning_content:
                # 检查上下文，确保是作为答案而非举例
                type_index = reasoning_content.find(task_type)
                context = reasoning_content[max(0, type_index-50):type_index+50].lower()
                
                # 如果上下文包含确定性词汇，认为是答案
                if any(keyword in context for keyword in ["that's", "答案", "是", "应该", "判断", "选择"]):
                    logger.info(f"从reasoning中提取到答案: {task_type}")
                    return task_type
        
        return ""

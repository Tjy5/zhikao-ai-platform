"""
个性化练习API接口
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, String
from typing import List, Dict, Any
import random
from datetime import datetime

from ...db.database import get_db
from ...models import Question, QuestionImage
from .assessment import format_question_for_assessment, normalize_question_type

router = APIRouter()

@router.post("/personalized")
async def get_personalized_questions(
    request_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    基于测评结果获取个性化推荐题目
    """
    try:
        assessment_result = request_data.get("assessment_result")
        if not assessment_result:
            raise HTTPException(status_code=400, detail="缺少测评结果数据")
        
        # 解析测评结果
        dimension_scores = assessment_result.get("dimension_scores", {})
        detailed_scores = assessment_result.get("detailed_scores", [])
        
        # 生成个性化推荐题目
        recommended_questions = []
        
        # 1. 错题相关题目 (40%权重)
        wrong_questions = [q for q in detailed_scores if not q.get('correct', True)]
        wrong_question_types = list(set([q.get('question_type') for q in wrong_questions if q.get('question_type')]))
        
        if wrong_question_types:
            for question_type in wrong_question_types[:2]:  # 最多取2个错题题型
                similar_questions = await get_questions_by_type(db, question_type, limit=3)
                recommended_questions.extend(similar_questions)
        
        # 2. 薄弱题型强化 (40%权重)
        weak_dimensions = []
        for dimension, score in dimension_scores.items():
            if score < 70:  # 得分低于70分的题型
                weak_dimensions.append((dimension, score))
        
        # 按分数排序，优先练习最薄弱的
        weak_dimensions.sort(key=lambda x: x[1])
        
        for dimension, score in weak_dimensions[:2]:  # 最多取2个薄弱题型
            weak_questions = await get_questions_by_type(db, dimension, limit=4)
            recommended_questions.extend(weak_questions)
        
        # 3. 进阶提升 (20%权重)
        strong_dimensions = []
        for dimension, score in dimension_scores.items():
            if score >= 80:  # 得分高于80分的题型
                strong_dimensions.append((dimension, score))
        
        strong_dimensions.sort(key=lambda x: x[1], reverse=True)  # 按分数倒序
        
        for dimension, score in strong_dimensions[:1]:  # 取1个优势题型
            advanced_questions = await get_questions_by_type(db, dimension, limit=3)
            recommended_questions.extend(advanced_questions)
        
        # 如果推荐题目不足，随机补充一些题目
        if len(recommended_questions) < 10:
            random_questions = await get_random_questions(db, limit=10 - len(recommended_questions))
            recommended_questions.extend(random_questions)
        
        # 随机打乱题目顺序
        random.shuffle(recommended_questions)
        
        # 去重（基于题目ID）
        seen_ids = set()
        unique_questions = []
        for q in recommended_questions:
            if q['id'] not in seen_ids:
                seen_ids.add(q['id'])
                unique_questions.append(q)
        
        # 限制返回题目数量
        final_questions = unique_questions[:15]  # 最多返回15道题
        
        # 添加推荐理由
        for i, question in enumerate(final_questions):
            question['recommendation_reason'] = get_recommendation_reason(
                question, dimension_scores, wrong_question_types, weak_dimensions
            )
            question['sequence_number'] = i + 1
        
        return {
            "success": True,
            "data": {
                "questions": final_questions,
                "total_questions": len(final_questions),
                "recommendation_summary": {
                    "wrong_question_types": wrong_question_types,
                    "weak_dimensions": [d[0] for d in weak_dimensions],
                    "strong_dimensions": [d[0] for d in strong_dimensions],
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取个性化题目失败：{str(e)}")

async def get_questions_by_type(db: Session, question_type: str, limit: int = 5) -> List[Dict]:
    """根据题型获取题目"""
    try:
        # 标准化题型名称
        normalized_type = normalize_question_type(question_type)
        
        # 查询该题型的题目
        questions = db.query(Question).filter(
            Question.question_type.contains(normalized_type.split("与")[0]) if "与" in normalized_type else 
            Question.question_type.contains(normalized_type)
        ).all()
        
        # 筛选匹配的题目
        matching_questions = []
        for q in questions:
            if normalize_question_type(q.question_type or "") == normalized_type:
                matching_questions.append(q)
        
        # 随机选择
        if len(matching_questions) > limit:
            selected = random.sample(matching_questions, limit)
        else:
            selected = matching_questions
        
        # 格式化题目
        formatted_questions = []
        for q in selected:
            formatted_q = format_question_for_assessment(q, db)
            formatted_questions.append(formatted_q)
        
        return formatted_questions
        
    except Exception as e:
        print(f"获取题目失败: {e}")
        return []

async def get_random_questions(db: Session, limit: int = 5) -> List[Dict]:
    """获取随机题目"""
    try:
        # 获取所有题目
        all_questions = db.query(Question).all()
        
        if len(all_questions) > limit:
            selected = random.sample(all_questions, limit)
        else:
            selected = all_questions
        
        # 格式化题目
        formatted_questions = []
        for q in selected:
            formatted_q = format_question_for_assessment(q, db)
            formatted_questions.append(formatted_q)
        
        return formatted_questions
        
    except Exception as e:
        print(f"获取随机题目失败: {e}")
        return []

def get_recommendation_reason(question: Dict, dimension_scores: Dict, wrong_types: List, weak_dimensions: List) -> str:
    """生成推荐理由"""
    question_type = question.get('question_type', '')
    
    # 检查是否是错题相关
    if question_type in wrong_types:
        return f"错题巩固：针对您在{question_type}上的错误进行强化练习"
    
    # 检查是否是薄弱题型
    for weak_type, score in weak_dimensions:
        if question_type == weak_type:
            return f"薄弱提升：{question_type}得分{score}分，需要重点练习"
    
    # 检查是否是优势题型
    score = dimension_scores.get(question_type, 0)
    if score >= 80:
        return f"进阶提升：{question_type}基础较好({score}分)，适合进一步提升"
    
    return "综合练习：基于您的整体水平推荐的练习题目"

@router.post("/category")
async def get_category_questions(
    request_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    根据题型获取分类练习题目
    """
    try:
        category_type = request_data.get("category_type")
        limit = request_data.get("limit", 20)
        
        if not category_type:
            raise HTTPException(status_code=400, detail="缺少题型参数")
        
        # 获取该题型的题目
        questions = await get_questions_by_type(db, category_type, limit=limit)
        
        if not questions:
            raise HTTPException(status_code=404, detail=f"未找到题型为'{category_type}'的题目")
        
        return {
            "success": True,
            "questions": questions,
            "total_questions": len(questions),
            "category_type": category_type
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取分类题目失败：{str(e)}")

@router.post("/mock-exam")
async def get_mock_exam_questions(
    request_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    获取模拟考试题目
    """
    try:
        question_count = request_data.get("question_count", 18)
        
        # 按题型分配题目数量（模拟真实考试比例）
        type_allocation = {
            "常识判断": max(1, question_count // 6),
            "言语理解与表达": max(1, question_count // 3),
            "数量关系": max(1, question_count // 6),
            "判断推理": max(1, question_count // 3), 
            "资料分析": max(1, question_count // 6),
        }
        
        # 确保总数不超过要求的题目数
        total_allocated = sum(type_allocation.values())
        if total_allocated > question_count:
            # 按比例缩减
            for key in type_allocation:
                type_allocation[key] = max(1, int(type_allocation[key] * question_count / total_allocated))
        
        mock_exam_questions = []
        
        # 从每个题型中随机选择题目
        for question_type, count in type_allocation.items():
            type_questions = await get_questions_by_type(db, question_type, limit=count)
            mock_exam_questions.extend(type_questions)
        
        # 如果题目不够，随机补充
        if len(mock_exam_questions) < question_count:
            additional_count = question_count - len(mock_exam_questions)
            additional_questions = await get_random_questions(db, limit=additional_count)
            mock_exam_questions.extend(additional_questions)
        
        # 随机打乱题目顺序
        random.shuffle(mock_exam_questions)
        
        # 限制题目数量
        final_questions = mock_exam_questions[:question_count]
        
        # 添加题目序号
        for i, question in enumerate(final_questions):
            question['exam_sequence'] = i + 1
        
        return {
            "success": True,
            "questions": final_questions,
            "total_questions": len(final_questions),
            "type_allocation": type_allocation,
            "exam_mode": True
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取模拟考试题目失败：{str(e)}")

@router.get("/stats")
async def get_practice_stats(db: Session = Depends(get_db)):
    """获取练习统计信息"""
    try:
        # 获取题目总数
        total_questions = db.query(func.count(Question.id)).scalar()
        
        # 获取题型分布
        type_distribution = db.query(
            Question.question_type, 
            func.count(Question.id)
        ).group_by(Question.question_type).all()
        
        # 标准化题型分布
        normalized_distribution = {}
        for raw_type, count in type_distribution:
            normalized_type = normalize_question_type(raw_type or "")
            if normalized_type not in normalized_distribution:
                normalized_distribution[normalized_type] = 0
            normalized_distribution[normalized_type] += count
        
        return {
            "success": True,
            "data": {
                "total_questions": total_questions,
                "type_distribution": [
                    {"type": type_name, "count": count}
                    for type_name, count in normalized_distribution.items()
                ]
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取练习统计失败：{str(e)}")

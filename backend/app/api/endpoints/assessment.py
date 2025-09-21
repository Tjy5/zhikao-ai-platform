"""
能力测评API接口
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, cast, String
from typing import List, Dict, Any
import uuid
import time
import json
import random
from datetime import datetime

from ...db.database import get_db
from ...models import Question, QuestionImage
# from ...services.ai_service import AIService

router = APIRouter()

# 标准题型映射和数量配置
QUESTION_TYPES = {
    "政治理论": {"display_name": "政治理论", "count_per_assessment": 3},
    "常识判断": {"display_name": "常识判断", "count_per_assessment": 3},
    "言语理解与表达": {"display_name": "言语理解与表达", "count_per_assessment": 3},
    "数量关系": {"display_name": "数量关系", "count_per_assessment": 3},
    "判断推理": {"display_name": "判断推理", "count_per_assessment": 3},
    "资料分析": {"display_name": "资料分析", "count_per_assessment": 3},
}

def normalize_question_type(raw_type: str) -> str:
    """标准化题型名称"""
    t = (raw_type or "").strip()
    if "言语" in t:
        return "言语理解与表达"
    if "资料" in t:
        return "资料分析"
    if "常识" in t:
        return "常识判断"
    if "判断" in t:
        return "判断推理"
    if "数量" in t:
        return "数量关系"
    if "政治" in t:
        return "政治理论"
    return "未知"

def format_question_for_assessment(question: Question, db: Session = None) -> Dict[str, Any]:
    """格式化题目为测评格式"""
    try:
        content_data = json.loads(question.content) if question.content else {}
    except:
        content_data = {}
    
    # 提取题目内容和选项
    question_text = content_data.get('question_text', '')
    options = content_data.get('options', {})
    
    # 如果没有找到直接的question_text，尝试从paragraphs中提取
    if not question_text and 'paragraphs' in content_data:
        paragraphs = content_data['paragraphs']
        question_parts = []
        option_parts = {}
        
        for para in paragraphs:
            text = para.get('text', '').strip()
            if not text:
                continue
                
            # 跳过题型说明段落
            if '根据题目要求' in text or text.isdigit():
                continue
                
            # 识别选项
            if text.startswith(('A、', 'B、', 'C、', 'D、')):
                option_key = text[0]  # 获取A、B、C、D
                option_value = text[2:]  # 获取选项内容
                option_parts[option_key] = option_value
            # 识别题目主体内容
            elif len(text) > 10 and not text.startswith('①') and not text.startswith('②') and not text.startswith('③') and not text.startswith('④'):
                question_parts.append(text)
            # 如果是编号选项内容，也加入题目
            elif text.startswith(('①', '②', '③', '④')):
                question_parts.append(text)
        
        # 组合题目文本
        if question_parts:
            question_text = '\n'.join(question_parts)
        
        # 设置选项
        if option_parts:
            options = option_parts
    
    # 如果还没有选项，尝试从其他字段提取
    if not options and 'material' in content_data:
        material = content_data['material']
        if isinstance(material, dict):
            for key in ['A', 'B', 'C', 'D']:
                if key in material:
                    options[key] = material[key]
    
    # 获取题目图片
    images = []
    if db:
        try:
            question_images = (
                db.query(QuestionImage)
                .filter(cast(QuestionImage.question_id, String) == str(question.id))
                .order_by(QuestionImage.order_index)
                .all()
            )
            
            for img in question_images:
                images.append({
                    "id": img.id,
                    "url": f"http://localhost:65123/api/v1/questions/images/{img.image_path}",
                    "image_type": img.image_type,
                    "context_text": img.context_text,
                    "paragraph_index": img.paragraph_index,
                    "position_in_question": img.position_in_question,
                })
            
            # 若为资料分析非组首题，则补充本组组首题的材料图片
            if question.question_type and ('资料分析' in question.question_type):
                min_num = (
                    db.query(func.min(Question.question_number))
                    .filter(Question.question_type == question.question_type)
                    .scalar()
                )
                if min_num is None:
                    min_num = question.question_number
                
                n = int(question.question_number or 0)
                group_start_num = int(min_num + ((n - min_num) // 5) * 5)
                
                # 判断是否已有材料图
                has_material = any(img.get("image_type") == 'material' for img in images)
                
                if (n != group_start_num) and (not has_material):
                    leader = (
                        db.query(Question)
                        .filter(
                            Question.question_number == group_start_num,
                            Question.question_type == question.question_type,
                        )
                        .first()
                    )
                    if leader:
                        leader_imgs = (
                            db.query(QuestionImage)
                            .filter(cast(QuestionImage.question_id, String) == str(leader.id))
                            .order_by(QuestionImage.order_index)
                            .all()
                        )
                        
                        # 添加材料图
                        existing_urls = {img["url"] for img in images}
                        for limg in leader_imgs:
                            is_option = (limg.image_type == 'option')
                            if is_option:
                                continue
                            url = f"http://localhost:65123/api/v1/questions/images/{limg.image_path}"
                            if url not in existing_urls:
                                images.insert(0, {
                                    "id": limg.id,
                                    "url": url,
                                    "image_type": limg.image_type or 'material',
                                    "context_text": limg.context_text,
                                    "paragraph_index": limg.paragraph_index,
                                    "position_in_question": limg.position_in_question,
                                })
        except Exception as e:
            print(f"获取图片失败: {e}")
    
    # 构造标准格式
    return {
        "id": question.id,
        "title": question.title or f"题目{question.question_number}",
        "content": question_text,
        "options": options,
        "images": images,  # 添加图片信息
        "question_type": normalize_question_type(question.question_type),
        "question_number": question.question_number,
        "source": question.source,
        "correct_answer": question.answer,  # 添加正确答案
        "explanation": question.answer_explanation or ""  # 添加解析
    }

@router.post("/start")
async def start_assessment(db: Session = Depends(get_db)):
    """开始能力测评，按题型抽取题目"""
    
    try:
        session_id = str(uuid.uuid4())
        start_time = datetime.utcnow().isoformat()
        
        selected_questions = []
        assessment_summary = {}
        
        # 按题型抽取题目
        for question_type, config in QUESTION_TYPES.items():
            count_needed = config["count_per_assessment"]
            
            # 查询该题型的所有题目
            questions = db.query(Question).filter(
                Question.question_type.contains(question_type.split("与")[0]) if "与" in question_type else 
                Question.question_type.contains(question_type)
            ).all()
            
            # 标准化题型并筛选
            matching_questions = []
            for q in questions:
                normalized_type = normalize_question_type(q.question_type)
                if normalized_type == question_type:
                    matching_questions.append(q)
            
            # 随机选择指定数量的题目
            if len(matching_questions) >= count_needed:
                selected = random.sample(matching_questions, count_needed)
                for q in selected:
                    formatted_q = format_question_for_assessment(q, db)
                    selected_questions.append(formatted_q)
                
                assessment_summary[question_type] = {
                    "available": len(matching_questions),
                    "selected": len(selected),
                    "questions": [q.id for q in selected]
                }
            else:
                # 如果题目数量不足，选择所有可用题目
                for q in matching_questions:
                    formatted_q = format_question_for_assessment(q, db)
                    selected_questions.append(formatted_q)
                
                assessment_summary[question_type] = {
                    "available": len(matching_questions),
                    "selected": len(matching_questions),
                    "questions": [q.id for q in matching_questions],
                    "note": f"题目数量不足，仅有{len(matching_questions)}道题"
                }
        
        # 随机打乱题目顺序
        random.shuffle(selected_questions)
        
        # 为每道题添加序号
        for i, q in enumerate(selected_questions):
            q["sequence_number"] = i + 1
        
        return {
            "success": True,
            "data": {
                "session_id": session_id,
                "start_time": start_time,
                "questions": selected_questions,
                "total_questions": len(selected_questions),
                "assessment_summary": assessment_summary,
                "estimated_time_minutes": len(selected_questions) * 2  # 每题预计2分钟
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动测评失败：{str(e)}")

@router.post("/submit")
async def submit_assessment(
    request_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """提交测评答案并生成结果"""
    
    try:
        session_id = request_data.get("session_id")
        answers = request_data.get("answers", {})
        start_time_str = request_data.get("start_time")
        
        if not session_id or not answers:
            raise HTTPException(status_code=400, detail="缺少必要参数")
        
        # 计算测评时间
        start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        end_time = datetime.utcnow()
        completion_time_seconds = int((end_time - start_time).total_seconds())
        
        # 获取答题的题目信息（包含答案字段）
        question_ids = list(answers.keys())
        print(f"[DEBUG] question_ids类型和值: {[(qid, type(qid)) for qid in question_ids[:3]]}")
        
        # 尝试转换为整数类型，因为数据库id是整数
        try:
            numeric_question_ids = [int(qid) for qid in question_ids]
        except ValueError as e:
            print(f"[DEBUG] 转换question_id失败: {e}")
            numeric_question_ids = question_ids
            
        questions = db.query(Question).filter(Question.id.in_(numeric_question_ids)).all()
        
        # 创建题目字典方便查找，支持字符串和整数key查找
        question_dict = {}
        for q in questions:
            question_dict[q.id] = q
            question_dict[str(q.id)] = q  # 同时支持字符串key
        
        # 按题型统计答题情况
        type_stats = {}
        detailed_scores = []
        
        print(f"[DEBUG] 收到的answers数量: {len(answers)}")
        print(f"[DEBUG] 查询到的questions数量: {len(questions)}")
        
        # 安全的调试信息
        if questions:
            print(f"[DEBUG] 题目类型分布:")
            for q in questions[:5]:  # 只显示前5个避免输出过多
                try:
                    print(f"   题目{q.id}: {q.question_type or 'None'}")
                except Exception as e:
                    print(f"   题目显示错误: {e}")
        else:
            print("[DEBUG] 没有查询到任何题目！")
        
        for question_id, user_answer in answers.items():
            question = question_dict.get(question_id)
            if not question:
                print(f"[DEBUG] 未找到question_id: {question_id}")
                continue
                
            question_type = normalize_question_type(question.question_type)
            
            if question_type not in type_stats:
                type_stats[question_type] = {
                    "total": 0,
                    "answered": 0,
                    "questions": []
                }
            
            type_stats[question_type]["total"] += 1
            if user_answer.strip():
                type_stats[question_type]["answered"] += 1
            
            # 记录详细答题信息
            correct_answer = getattr(question, 'answer', None)  # 安全获取正确答案
            is_correct = False
            if user_answer.strip() and correct_answer:
                is_correct = user_answer.strip().upper() == correct_answer.upper()
            
            try:
                print(f"[DEBUG] 题目{question_id}: 答案对比 {is_correct}")
            except Exception as e:
                print(f"[DEBUG] 题目答案对比错误: {e}")
            
            # 获取完整的题目信息（使用同样的格式化函数）
            formatted_question = format_question_for_assessment(question, db)
            
            question_score = {
                "question_id": question_id,
                "question_type": question_type,
                "question_number": question.question_number,
                "user_answer": user_answer,
                "correct_answer": correct_answer,
                "correct": is_correct,
                "answered": bool(user_answer.strip()),
                "question_title": question.title,
                "explanation": getattr(question, 'answer_explanation', '') or "",  # 添加解析
                # 添加完整的题目内容和选项
                "question_content": formatted_question.get("content", ""),
                "question_options": formatted_question.get("options", {}),
                "question_images": formatted_question.get("images", [])
            }
            
            detailed_scores.append(question_score)
            type_stats[question_type]["questions"].append(question_score)
        
        print(f"[DEBUG] 最终detailed_scores数量: {len(detailed_scores)}")
        print(f"[DEBUG] 实际参与的题型统计: {[(k, v['total']) for k, v in type_stats.items()]}")
        
        # 科学评分系统
        dimension_scores = {}
        total_questions = len(question_ids)
        total_correct = sum(1 for detail in detailed_scores if detail['correct'])
        
        # 整体正确率
        overall_correct_rate = total_correct / total_questions if total_questions > 0 else 0
        
        # 动态权重计算系统
        type_weights = _calculate_dynamic_weights(type_stats, list(question_dict.values()))
        
        print(f"[DEBUG] 总题目数: {total_questions}, 总答对数: {total_correct}, 整体正确率: {overall_correct_rate:.1%}")
        
        # 各题型得分计算
        for question_type, stats in type_stats.items():
            if stats["total"] > 0:
                # 计算该题型的正确率
                type_correct_count = sum(1 for q in stats["questions"] if q.get('correct', False))
                type_correct_rate = type_correct_count / stats["total"]
                
                print(f"[DEBUG] {question_type}: {type_correct_count}/{stats['total']}题正确, 正确率: {type_correct_rate:.1%}")
                
                # 简化评分逻辑：直接基于正确率计算分数
                if type_correct_count == 0:
                    # 一题都没答对，就是0分
                    final_score = 0.0
                else:
                    # 有答对题目，基于正确率计算分数
                    base_score = type_correct_rate * 100
                    
                    # 适当的分数调整，但不要给0正确率加分
                    if base_score >= 60:
                        # 及格以上，给予鼓励
                        final_score = min(100, base_score + 10)
                    elif base_score >= 30:
                        # 30%-60%，正常计分
                        final_score = base_score + 5
                    else:
                        # 30%以下，稍作调整
                        final_score = base_score + 2
                    
                    final_score = max(0, min(100, final_score))
                
                dimension_scores[_map_type_to_dimension(question_type)] = round(final_score, 1)
                print(f"[DEBUG] {question_type} 最终得分: {final_score:.1f}")
        
        # 计算加权总分（包括0分题型）
        if dimension_scores:
            # 计算所有参与题型的加权分数（包括0分）
            participating_weight_sum = sum(type_weights.get(dim, 0) for dim in dimension_scores.keys())
            
            if participating_weight_sum > 0:
                # 计算加权总分（0分也参与计算）
                weighted_sum = sum(dimension_scores[dim] * type_weights.get(dim, 0) for dim in dimension_scores.keys())
                total_score = weighted_sum / participating_weight_sum
            else:
                # 如果权重有问题，使用简单平均
                total_score = sum(dimension_scores.values()) / len(dimension_scores)
            
            total_score = round(total_score, 1)
        else:
            total_score = 0.0
        
        try:
            print(f"[DEBUG] 参与测评的题型: {list(dimension_scores.keys())}")
            print(f"[DEBUG] 各题型分数: {dimension_scores}")
            print(f"[DEBUG] 最终总分: {total_score}")
        except Exception as e:
            print(f"[DEBUG] 调试信息输出错误: {e}")
        
        # 生成学习建议
        recommendations = _generate_recommendations(dimension_scores, type_stats)
        
        result = {
            "session_id": session_id,
            "total_score": total_score,
            "dimension_scores": dimension_scores,
            "detailed_scores": detailed_scores,
            "type_statistics": type_stats,
            "recommendations": recommendations,
            "completion_time": completion_time_seconds,
            "completed_at": end_time.isoformat(),
            "assessment_info": {
                "total_questions": total_questions,
                "answered_questions": sum(1 for detail in detailed_scores if detail['answered']),
                "completion_rate": round(overall_correct_rate * 100, 1)
            }
        }
        
        return {
            "success": True,
            "data": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提交测评失败：{str(e)}")

def _map_type_to_dimension(question_type: str) -> str:
    """将题型映射到能力维度 - 直接使用行测题型作为维度"""
    # 直接返回行测题型名称作为维度
    if question_type in ["政治理论", "常识判断", "言语理解与表达", "数量关系", "判断推理", "资料分析"]:
        return question_type
    return "其他"

def _calculate_dynamic_weights(type_stats: Dict[str, Any], questions: List[Question]) -> Dict[str, float]:
    """动态计算题型权重 - 基于题目来源和标准权重"""
    
    # 标准权重配置（基于不同考试级别）
    STANDARD_WEIGHTS = {
        "副省级_135题": {
            "政治理论": 0.16,      # 20题×0.8分=16分
            "常识判断": 0.09,      # 15题×0.6分=9分  
            "言语理解与表达": 0.24, # 30题×0.8分=24分
            "数量关系": 0.09,      # 15题×0.6分=9分
            "判断推理": 0.28,      # 35题×0.8分=28分
            "资料分析": 0.14       # 20题×0.7分=14分
        },
        "市地级_130题": {
            "政治理论": 0.16,      # 估算：20题×0.8分=16分
            "常识判断": 0.12,      # 估算：15题×0.8分=12分
            "言语理解与表达": 0.24, # 估算：30题×0.8分=24分  
            "数量关系": 0.08,      # 估算：10题×0.8分=8分
            "判断推理": 0.28,      # 估算：35题×0.8分=28分
            "资料分析": 0.12       # 估算：15题×0.8分=12分
        },
        "通用权重": {  # 默认权重，适用于混合题库
            "政治理论": 0.16,
            "常识判断": 0.10,      # 两种考试的平均值
            "言语理解与表达": 0.24,
            "数量关系": 0.085,     # 两种考试的平均值  
            "判断推理": 0.28,
            "资料分析": 0.135      # 两种考试的平均值
        }
    }
    
    # 分析题目来源分布
    source_distribution = {}
    for question in questions:
        # 根据source字段判断来源
        source = getattr(question, 'source', '') or ''
        if '副省级' in source or '省级' in source:
            exam_type = '副省级_135题'
        elif '市地级' in source or '地市级' in source:
            exam_type = '市地级_130题'
        else:
            exam_type = '未知'
        
        if exam_type not in source_distribution:
            source_distribution[exam_type] = 0
        source_distribution[exam_type] += 1
    
    total_questions = len(questions)
    
    # 决定使用哪种权重方案
    if total_questions == 0:
        return STANDARD_WEIGHTS["通用权重"]
    
    # 计算各来源的比例
    source_ratios = {k: v/total_questions for k, v in source_distribution.items()}
    
    # 权重计算策略
    if source_ratios.get('副省级_135题', 0) >= 0.8:
        # 如果80%以上是副省级题目，使用副省级权重
        return STANDARD_WEIGHTS["副省级_135题"]
    elif source_ratios.get('市地级_130题', 0) >= 0.8:
        # 如果80%以上是市地级题目，使用市地级权重
        return STANDARD_WEIGHTS["市地级_130题"]
    else:
        # 混合情况：根据比例加权计算
        final_weights = {}
        standard_types = ["政治理论", "常识判断", "言语理解与表达", "数量关系", "判断推理", "资料分析"]
        
        for question_type in standard_types:
            weighted_value = 0
            total_ratio = 0
            
            # 根据各来源比例计算加权权重
            for source_type, ratio in source_ratios.items():
                if source_type in STANDARD_WEIGHTS and ratio > 0:
                    weights = STANDARD_WEIGHTS[source_type]
                    weighted_value += weights.get(question_type, 0) * ratio
                    total_ratio += ratio
            
            # 如果有未知来源，使用通用权重补充
            if total_ratio < 1.0:
                unknown_ratio = 1.0 - total_ratio
                weighted_value += STANDARD_WEIGHTS["通用权重"][question_type] * unknown_ratio
            
            final_weights[question_type] = weighted_value
        
        # 归一化权重（确保总和为1）
        total_weight = sum(final_weights.values())
        if total_weight > 0:
            final_weights = {k: v/total_weight for k, v in final_weights.items()}
        else:
            final_weights = STANDARD_WEIGHTS["通用权重"]
        
        return final_weights

def _generate_recommendations(dimension_scores: Dict[str, float], type_stats: Dict[str, Any]) -> List[Dict[str, Any]]:
    """生成学习建议 - 只针对实际参与测评的题型"""
    recommendations = []
    
    # 过滤掉0分或未参与的题型，找出得分较低的维度
    actual_dimensions = {k: v for k, v in dimension_scores.items() if v > 0}
    low_score_dimensions = {k: v for k, v in actual_dimensions.items() if v < 70}
    
    try:
        print(f"[DEBUG] 实际参与题型: {len(actual_dimensions)}个")
        print(f"[DEBUG] 低分题型: {len(low_score_dimensions)}个")
    except Exception:
        pass  # 忽略调试信息错误
    
    if low_score_dimensions:
        for dim, score in sorted(low_score_dimensions.items(), key=lambda x: x[1]):
            
            if dim == "政治理论":
                rec = {
                    "title": f"提升{dim}学习",
                    "content": f"您的{dim}得分为{score}分，建议加强政治理论基础知识学习。",
                    "suggestions": [
                        "深入学习马克思主义基本原理",
                        "掌握习近平新时代中国特色社会主义思想",
                        "关注党的重要会议精神和政策文件",
                        "练习政治理论选择题，提高理论运用能力"
                    ]
                }
            elif dim == "常识判断":
                rec = {
                    "title": f"强化{dim}练习", 
                    "content": f"您的{dim}得分为{score}分，需要扩大知识面，提升综合素养。",
                    "suggestions": [
                        "关注时事政治，了解国内外重大事件",
                        "学习科技、经济、法律、历史等各领域知识",
                        "多做常识题目，积累答题经验",
                        "建立知识体系，形成知识网络"
                    ]
                }
            elif dim == "言语理解与表达":
                rec = {
                    "title": f"加强{dim}能力",
                    "content": f"您的{dim}得分为{score}分，建议提升阅读理解和语言运用能力。", 
                    "suggestions": [
                        "大量阅读优秀文章，提高语感和理解能力",
                        "练习逻辑填空，掌握词汇搭配规律",
                        "训练阅读理解，提高信息提取能力",
                        "学习语言文字运用技巧"
                    ]
                }
            elif dim == "数量关系":
                rec = {
                    "title": f"提升{dim}水平",
                    "content": f"您的{dim}得分为{score}分，需要加强数学运算和逻辑推理能力。",
                    "suggestions": [
                        "强化数学基础，熟练掌握四则运算",
                        "学习数量关系经典题型和解题技巧",
                        "练习速算方法，提高计算效率",
                        "培养数学思维，提高分析问题能力"
                    ]
                }
            elif dim == "判断推理":
                rec = {
                    "title": f"强化{dim}训练",
                    "content": f"您的{dim}得分为{score}分，建议提升逻辑推理和空间思维能力。",
                    "suggestions": [
                        "练习图形推理，提高空间想象能力",
                        "学习定义判断，掌握概念理解技巧",
                        "训练类比推理，提高逻辑分析能力",
                        "练习逻辑判断，增强推理论证能力"
                    ]
                }
            elif dim == "资料分析":
                rec = {
                    "title": f"强化{dim}能力",
                    "content": f"您的{dim}得分为{score}分，建议提升数据分析和计算能力。",
                    "suggestions": [
                        "熟练掌握增长率、比重等基本概念",
                        "练习快速阅读图表，提取关键信息",
                        "学习估算技巧，提高计算速度",
                        "培养数据敏感性，提高分析准确度"
                    ]
                }
            else:
                rec = {
                    "title": f"提升{dim}能力",
                    "content": f"您的{dim}得分为{score}分，建议针对性加强练习。",
                    "suggestions": [
                        "分析题型特点，掌握解题方法",
                        "加强基础知识学习",
                        "多做相关练习题",
                        "寻求专业指导"
                    ]
                }
            
            recommendations.append(rec)
    
    # 添加总体建议 - 基于实际参与的题型
    if actual_dimensions:
        avg_score = sum(actual_dimensions.values()) / len(actual_dimensions)
        
        # 添加测评覆盖度说明
        total_types = ["政治理论", "常识判断", "言语理解与表达", "数量关系", "判断推理", "资料分析"]
        coverage_ratio = len(actual_dimensions) / len(total_types)
        
        if coverage_ratio < 1.0:
            recommendations.append({
                "title": "扩大测评范围",
                "content": f"本次测评仅覆盖{len(actual_dimensions)}个题型（{coverage_ratio:.1%}覆盖率），建议参与更多题型的测评以获得更全面的能力评估。",
                "suggestions": [
                    f"已测评题型：{', '.join(actual_dimensions.keys())}",
                    f"待测评题型：{', '.join(set(total_types) - set(actual_dimensions.keys()))}",
                    "建议选择包含更多题型的测评方案",
                    "全面测评有助于发现更多潜在优势和劣势"
                ]
            })
    else:
        avg_score = 0
    
    if avg_score > 0 and avg_score < 60:
        recommendations.append({
            "title": "全面提升计划",
            "content": "您的整体得分偏低，建议制定系统的学习计划，全面提升各项能力。",
            "suggestions": [
                "制定详细的学习计划，确保各科目均衡发展",
                "坚持每日练习，逐步提升解题能力",
                "寻求专业指导，针对性解决薄弱环节"
            ]
        })
    elif avg_score > 0 and avg_score < 80:
        recommendations.append({
            "title": "稳步提升建议",
            "content": f"您在已测评题型中平均得分{avg_score:.1f}分，已具备一定基础，建议针对性提升薄弱环节。",
            "suggestions": [
                "重点攻克得分较低的题型",
                "保持优势科目的练习强度",
                "适当增加综合性练习"
            ]
        })
    elif avg_score >= 80:
        recommendations.append({
            "title": "保持优势策略",
            "content": f"您在已测评题型中平均得分{avg_score:.1f}分，整体水平较高，建议保持现有优势并精益求精。",
            "suggestions": [
                "保持规律的练习习惯",
                "挑战更高难度的题目", 
                "关注新题型和考试趋势"
            ]
        })
    
    return recommendations

@router.get("/types")
async def get_assessment_types(db: Session = Depends(get_db)):
    """获取测评题型统计信息"""
    
    try:
        # 查询所有题目的题型分布
        questions = db.query(Question.question_type, func.count(Question.id)).group_by(Question.question_type).all()
        
        type_distribution = {}
        total_questions = 0
        
        for raw_type, count in questions:
            normalized_type = normalize_question_type(raw_type)
            if normalized_type not in type_distribution:
                type_distribution[normalized_type] = 0
            type_distribution[normalized_type] += count
            total_questions += count
        
        # 计算每个题型的测评配置
        assessment_config = []
        for question_type, config in QUESTION_TYPES.items():
            available_count = type_distribution.get(question_type, 0)
            selected_count = min(available_count, config["count_per_assessment"])
            
            assessment_config.append({
                "type": question_type,
                "display_name": config["display_name"],
                "available_questions": available_count,
                "selected_per_assessment": selected_count,
                "sufficient": available_count >= config["count_per_assessment"]
            })
        
        total_selected = sum(item["selected_per_assessment"] for item in assessment_config)
        
        return {
            "success": True,
            "data": {
                "total_questions_in_db": total_questions,
                "total_questions_per_assessment": total_selected,
                "assessment_config": assessment_config,
                "type_distribution": type_distribution
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取题型信息失败：{str(e)}")


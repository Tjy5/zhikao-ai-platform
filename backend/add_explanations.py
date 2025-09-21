#!/usr/bin/env python3
"""
添加题目解析到数据库的脚本
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.question import Question
import re
import json

def update_question_explanations():
    """更新题目解析"""
    
    # 2025年国考《行测》（副省级）答案+解析数据
    # 这里需要您手动添加从PDF中提取的解析内容
    
    explanations_data = {
        # 格式: 题目编号: {"answer": "正确答案", "explanation": "详细解析"}
        # 示例:
        # 1: {
        #     "answer": "A", 
        #     "explanation": "本题考查的是马克思主义基本原理。根据马克思主义政治经济学理论..."
        # },
        # 2: {
        #     "answer": "B",
        #     "explanation": "本题考查常识判断。根据相关法律法规..."
        # },
        
        # TODO: 请在这里添加从PDF中提取的所有题目解析
        # 您可以逐步添加，也可以一次性添加所有内容
    }
    
    db = SessionLocal()
    try:
        print("=== 开始更新题目解析 ===")
        
        updated_count = 0
        not_found_count = 0
        
        for question_number, data in explanations_data.items():
            answer = data.get("answer", "")
            explanation = data.get("explanation", "")
            
            # 查找对应的题目
            question = db.query(Question).filter(
                Question.question_number == question_number
            ).first()
            
            if question:
                # 更新答案（如果数据库中没有或不正确）
                if not question.answer or question.answer.strip() == "":
                    question.answer = answer
                    print(f"题目{question_number}: 更新答案为 {answer}")
                elif question.answer != answer:
                    print(f"题目{question_number}: 数据库答案({question.answer}) 与PDF答案({answer})不一致")
                
                # 更新解析
                question.answer_explanation = explanation
                print(f"题目{question_number}: 添加解析 ({len(explanation)}字符)")
                
                updated_count += 1
            else:
                print(f"❌ 未找到题目编号: {question_number}")
                not_found_count += 1
        
        # 提交更改
        db.commit()
        
        print(f"\n=== 更新完成 ===")
        print(f"成功更新: {updated_count} 道题目")
        print(f"未找到: {not_found_count} 道题目")
        
        # 显示更新后的统计
        total_questions = db.query(Question).count()
        questions_with_explanation = db.query(Question).filter(
            Question.answer_explanation.isnot(None),
            Question.answer_explanation != ''
        ).count()
        
        print(f"数据库总题目数: {total_questions}")
        print(f"有解析的题目数: {questions_with_explanation}")
        print(f"无解析的题目数: {total_questions - questions_with_explanation}")
        
    except Exception as e:
        print(f"更新过程中发生错误: {e}")
        db.rollback()
    finally:
        db.close()

def show_questions_without_explanations():
    """显示没有解析的题目列表"""
    
    db = SessionLocal()
    try:
        print("=== 缺少解析的题目列表 ===")
        
        questions = db.query(Question).filter(
            (Question.answer_explanation.is_(None)) | 
            (Question.answer_explanation == '')
        ).order_by(Question.question_number).all()
        
        print(f"共有 {len(questions)} 道题目缺少解析:")
        print()
        
        for q in questions:
            print(f"题目{q.question_number}: {q.title}")
            print(f"  答案: {q.answer or '无答案'}")
            print(f"  题型: {q.question_type}")
            print()
        
    except Exception as e:
        print(f"查询过程中发生错误: {e}")
    finally:
        db.close()

def sample_explanation_format():
    """显示解析格式示例"""
    
    print("=== 解析数据格式示例 ===")
    print("""
请按以下格式在 explanations_data 中添加解析:

explanations_data = {
    1: {
        "answer": "B",
        "explanation": "本题考查马克思主义基本原理。题目涉及的是马克思主义政治经济学中关于商品价值的理论。根据马克思主义政治经济学理论，商品的价值是由生产商品的社会必要劳动时间决定的。选项A错误，因为...；选项C错误，因为...；选项D错误，因为...。因此正确答案是B。"
    },
    2: {
        "answer": "A", 
        "explanation": "本题考查常识判断。题目涉及的是中国传统文化知识。根据相关历史文献记载...因此正确答案是A。"
    },
    # 继续添加更多题目...
}

注意事项:
1. 题目编号要与数据库中的 question_number 字段匹配
2. 答案使用大写字母 A、B、C、D
3. 解析要详细，包含考查内容、解题思路、各选项分析等
4. 可以分批添加，不需要一次性添加所有135道题
""")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "show":
            show_questions_without_explanations()
        elif sys.argv[1] == "sample":
            sample_explanation_format()
        elif sys.argv[1] == "update":
            update_question_explanations()
        else:
            print("用法:")
            print("  python add_explanations.py show    # 显示缺少解析的题目")
            print("  python add_explanations.py sample  # 显示格式示例")
            print("  python add_explanations.py update  # 更新解析到数据库")
    else:
        print("题目解析更新工具")
        print("=" * 40)
        print("用法:")
        print("  python add_explanations.py show    # 显示缺少解析的题目")
        print("  python add_explanations.py sample  # 显示格式示例") 
        print("  python add_explanations.py update  # 更新解析到数据库")
        print()
        print("步骤:")
        print("1. 运行 'python add_explanations.py show' 查看需要添加解析的题目")
        print("2. 运行 'python add_explanations.py sample' 查看数据格式")
        print("3. 手动从PDF中提取解析内容并添加到脚本中")
        print("4. 运行 'python add_explanations.py update' 更新到数据库")






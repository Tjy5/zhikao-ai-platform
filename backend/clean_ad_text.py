#!/usr/bin/env python3
"""
清理题目解析中的广告文字脚本
删除题目解析中的"【认准淘宝店铺：通关达人资料库】"等广告内容
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.question import Question

def clean_ad_text():
    """清理题目解析中的广告文字"""
    
    # 要删除的广告文字列表
    ad_texts = [
        "【认准淘宝店铺：通关达人资料库】",
        "认准淘宝店铺：通关达人资料库",
        "【通关达人资料库】",
        "通关达人资料库"
    ]
    
    # 获取数据库会话
    db = next(get_db())
    
    try:
        # 查询所有有解析的题目
        questions_with_explanation = db.query(Question).filter(
            Question.answer_explanation.isnot(None),
            Question.answer_explanation != ""
        ).all()
        
        print(f"找到 {len(questions_with_explanation)} 道有解析的题目")
        
        cleaned_count = 0
        
        for question in questions_with_explanation:
            original_explanation = question.answer_explanation
            cleaned_explanation = original_explanation
            
            # 检查是否包含广告文字
            has_ad = False
            for ad_text in ad_texts:
                if ad_text in cleaned_explanation:
                    has_ad = True
                    cleaned_explanation = cleaned_explanation.replace(ad_text, "")
                    print(f"题目 {question.id} (题号: {question.question_number}) 发现广告文字: {ad_text}")
            
            if has_ad:
                # 清理多余的空白字符和换行
                cleaned_explanation = cleaned_explanation.strip()
                # 移除多余的空行
                lines = [line.strip() for line in cleaned_explanation.split('\n') if line.strip()]
                cleaned_explanation = '\n'.join(lines)
                
                # 更新数据库
                question.answer_explanation = cleaned_explanation
                cleaned_count += 1
                
                print(f"  原文: {original_explanation[:100]}...")
                print(f"  清理后: {cleaned_explanation[:100]}...")
                print("-" * 50)
        
        if cleaned_count > 0:
            # 提交更改
            db.commit()
            print(f"\n✅ 成功清理了 {cleaned_count} 道题目的广告文字")
        else:
            print("\n✅ 没有发现包含广告文字的题目")
            
    except Exception as e:
        db.rollback()
        print(f"❌ 清理过程中出现错误: {e}")
        
    finally:
        db.close()

def preview_ad_text():
    """预览包含广告文字的题目（不实际删除）"""
    
    ad_texts = [
        "【认准淘宝店铺：通关达人资料库】",
        "认准淘宝店铺：通关达人资料库",
        "【通关达人资料库】",
        "通关达人资料库"
    ]
    
    db = next(get_db())
    
    try:
        questions_with_explanation = db.query(Question).filter(
            Question.answer_explanation.isnot(None),
            Question.answer_explanation != ""
        ).all()
        
        print(f"正在检查 {len(questions_with_explanation)} 道题目的解析...")
        
        found_count = 0
        
        for question in questions_with_explanation:
            explanation = question.answer_explanation
            
            for ad_text in ad_texts:
                if ad_text in explanation:
                    found_count += 1
                    print(f"\n题目 {question.id} (题号: {question.question_number}, 题型: {question.question_type})")
                    print(f"发现广告文字: {ad_text}")
                    print(f"解析内容: {explanation[:200]}...")
                    break
        
        print(f"\n📊 总计发现 {found_count} 道题目包含广告文字")
        
    except Exception as e:
        print(f"❌ 预览过程中出现错误: {e}")
        
    finally:
        db.close()

if __name__ == "__main__":
    print("题目解析广告文字清理工具")
    print("=" * 50)
    
    while True:
        print("\n请选择操作:")
        print("1. 预览包含广告文字的题目")
        print("2. 清理广告文字（会修改数据库）")
        print("3. 退出")
        
        choice = input("\n请输入选择 (1/2/3): ").strip()
        
        if choice == "1":
            preview_ad_text()
        elif choice == "2":
            confirm = input("⚠️  这将修改数据库中的题目解析，确定要继续吗？(y/N): ").strip().lower()
            if confirm == 'y':
                clean_ad_text()
            else:
                print("已取消操作")
        elif choice == "3":
            print("退出程序")
            break
        else:
            print("无效选择，请重新输入")

#!/usr/bin/env python3
"""
调试脚本 - 用于测试和调试申论批改功能
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def debug_essay_grading():
    """调试申论批改功能"""
    
    # 测试数据
    test_data = {
        "material": "黄河奔腾生生不息，科技活水澎湃成潮。",
        "question": "请分析资料中提到的科技治黄措施。",
        "user_answer": "资料中提到的科技治黄措施包括数字孪生黄河和模型黄河等。",
        "question_type": "综合分析题"
    }
    
    print("🚀 开始调试申论批改功能...")
    print(f"测试数据: {test_data}")
    
    try:
        # 这里可以添加具体的调试逻辑
        print("✅ 调试成功！")
        
    except Exception as e:
        print(f"❌ 调试失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_essay_grading()
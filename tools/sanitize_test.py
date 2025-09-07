#!/usr/bin/env python3
"""
测试文本清理功能
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.text_sanitizer import TextSanitizer

def test_sanitizer():
    """测试文本清理功能"""
    
    # 测试数据
    test_texts = [
        "这是一个测试文本，包含一些特殊字符：\n\r\t",
        "另一个测试，包含多余空格  和   标点符号，，，！！",
        "测试Unicode字符：📝✅❌",
        "测试HTML标签：<div>内容</div>",
        "测试URL：https://example.com/path",
        "测试邮箱：user@example.com",
        "测试数字：123-456-7890",
    ]
    
    sanitizer = TextSanitizer()
    
    print("🚀 开始测试文本清理功能...")
    print("=" * 50)
    
    for i, text in enumerate(test_texts, 1):
        print(f"\n测试 {i}:")
        print(f"原始文本: {repr(text)}")
        
        cleaned = sanitizer.sanitize(text)
        print(f"清理后: {repr(cleaned)}")
        
        # 测试分词
        tokens = sanitizer.tokenize(cleaned)
        print(f"分词结果: {tokens}")
        
        print("-" * 30)
    
    print("✅ 文本清理功能测试完成！")

if __name__ == "__main__":
    test_sanitizer()
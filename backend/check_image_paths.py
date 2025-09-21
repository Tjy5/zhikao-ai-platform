#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
检查图片路径匹配问题
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.question import QuestionImage

def check_image_paths():
    """检查数据库中的图片路径"""
    print("🔍 检查数据库中的图片路径...")
    
    session = SessionLocal()
    try:
        # 获取前10个图片记录
        images = session.query(QuestionImage).limit(10).all()
        
        print(f"📊 数据库中的图片记录: {len(images)}")
        
        upload_dir = "uploads"
        images_dir = os.path.join(upload_dir, "images")
        
        for i, img in enumerate(images):
            print(f"\n{i+1}. 图片ID: {img.id}")
            print(f"   数据库路径: {img.image_path}")
            print(f"   图片类型: {img.image_type}")
            print(f"   上下文: {img.context_text[:30] if img.context_text else 'None'}...")
            
            # 检查文件是否存在
            if img.image_path:
                full_path = os.path.join(images_dir, img.image_path)
                exists = os.path.exists(full_path)
                print(f"   文件存在: {'✅' if exists else '❌'} {full_path}")
        
        # 检查实际文件
        print(f"\n📁 实际图片文件:")
        if os.path.exists(images_dir):
            files = os.listdir(images_dir)[:10]
            for i, file in enumerate(files):
                print(f"  {i+1}. {file}")
        
    except Exception as e:
        print(f"❌ 检查失败: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    check_image_paths()

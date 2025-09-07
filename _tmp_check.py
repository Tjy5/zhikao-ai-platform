#!/usr/bin/env python3
"""
检查系统状态
"""
import sys
import os

def check_system():
    """检查系统状态"""
    print("🔍 检查系统状态...")
    
    # 检查Python版本
    print(f"Python版本: {sys.version}")
    
    # 检查当前目录
    print(f"当前目录: {os.getcwd()}")
    
    # 检查必要文件
    necessary_files = ['backend', 'frontend', 'docker-compose.yml']
    for file in necessary_files:
        if os.path.exists(file):
            print(f"✅ {file} 存在")
        else:
            print(f"❌ {file} 不存在")
    
    print("✅ 系统检查完成")

if __name__ == "__main__":
    check_system()
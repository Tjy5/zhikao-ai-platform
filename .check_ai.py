#!/usr/bin/env python3
"""
检查AI服务状态
"""
import requests
import json

def check_ai_status():
    """检查AI服务状态"""
    
    try:
        response = requests.get(
            "http://localhost:8001/api/v1/essays/ai-status",
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ AI服务状态正常")
            print(f"状态: {result}")
        else:
            print(f"❌ AI服务状态异常: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ 无法连接到AI服务: {e}")

if __name__ == "__main__":
    print("🔍 检查AI服务状态...")
    check_ai_status()
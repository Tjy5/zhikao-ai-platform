#!/usr/bin/env python3
"""
测试改进后的申论批改功能
"""
import requests
import json
import time

def test_essay_grading():
    """测试申论批改功能"""
    
    # 测试数据
    test_data = {
        "material": "黄河奔腾生生不息，科技活水澎湃成潮。进入新的发展阶段，信息技术不断迭代升级，各种科技实践也正一幕幕上演，为黄河保护治理赋予新解。",
        "question": "给定资料1提到了三条'黄河'，请你谈谈这三条'黄河'分别指的是什么，并说明它们是如何协同发挥作用的。",
        "user_answer": """
"给定资料1"中提到的三条"黄河"指实体原型黄河、数字孪生黄河和"模型黄河"。

1. 实体原型黄河：指客观存在的、自然状态下的黄河，是科技治黄工作的服务对象和最终归宿。
2. 数字孪生黄河：是在计算机中构建的、与实体黄河同步仿真运行的虚拟黄河。它集成了"智慧石头"等物联网设备采集的实时数据，实现了具有预报、预警、预演、预案"四预"功能的智慧化管理，辅助管理者在"云端"决策。
3. "模型黄河"：是在实验室内按比例缩小的黄河物理模型。它通过开展洪水预演、泥沙淤积等实体模拟试验，为实体黄河的治理和重大水利工程建设提供精准的物理参数和科学支撑。

三者协同发挥作用，构筑了黄河的立体科技防线：以实体原型黄河为基础，通过数字孪生黄河进行全流域、系统性的实时动态模拟和智慧化管理；同时，利用"模型黄河"对关键、具体问题开展精准的物理模型试验，其试验成果既能为实体黄河治理提供科学依据，也能验证、优化数字孪生模型。三者虚实结合、相互支撑，共同推动了黄河治理的系统化和精准化。
        """,
        "question_type": "综合分析题"
    }
    
    try:
        # 发送请求
        response = requests.post(
            "http://localhost:8001/api/v1/essays/grade",
            json=test_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 测试成功！")
            print(f"评分: {result.get('score', 'N/A')}")
            print(f"反馈: {result.get('feedback', 'N/A')}")
            
            # 保存结果
            with open('last_result.json', 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            
        else:
            print(f"❌ 请求失败: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")

if __name__ == "__main__":
    print("🚀 开始测试改进后的申论批改功能...")
    test_essay_grading()
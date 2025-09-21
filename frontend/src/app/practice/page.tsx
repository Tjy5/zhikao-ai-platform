"use client";

import { useState, useEffect } from 'react';
import Navigation from '../../components/Navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../../config/api';

// 题型识别和图标映射函数
const getTypeInfo = (typeName: string): { icon: string; color: string; displayName: string } => {
  const typeStr = typeName.toLowerCase();
  
  if (typeStr.includes('政治理论') || typeStr.includes('一、政治')) {
    return { 
      icon: "🏛️", 
      color: "from-red-500 to-pink-600",
      displayName: "政治理论"
    };
  }
  
  if (typeStr.includes('常识判断') || typeStr.includes('二、常识')) {
    return { 
      icon: "🧠", 
      color: "from-blue-500 to-indigo-600",
      displayName: "常识判断"
    };
  }
  
  if (typeStr.includes('言语理解') || typeStr.includes('三、言语')) {
    return { 
      icon: "📝", 
      color: "from-green-500 to-emerald-600",
      displayName: "言语理解与表达"
    };
  }
  
  if (typeStr.includes('数量关系') || typeStr.includes('四、数量')) {
    return { 
      icon: "🔢", 
      color: "from-yellow-500 to-orange-600",
      displayName: "数量关系"
    };
  }
  
  if (typeStr.includes('判断推理') || typeStr.includes('五、判断')) {
    return { 
      icon: "🎯", 
      color: "from-purple-500 to-indigo-600",
      displayName: "判断推理"
    };
  }
  
  if (typeStr.includes('资料分析') || typeStr.includes('六、资料')) {
    return { 
      icon: "📊", 
      color: "from-cyan-500 to-blue-600",
      displayName: "资料分析"
    };
  }
  
  if (typeStr.includes('行测')) {
    return { 
      icon: "📋", 
      color: "from-indigo-500 to-purple-600",
      displayName: "行测"
    };
  }
  
  if (typeStr.includes('申论')) {
    return { 
      icon: "✍️", 
      color: "from-orange-500 to-red-600",
      displayName: "申论"
    };
  }
  
  // 默认未知类型
  return { 
    icon: "❓", 
    color: "from-gray-400 to-gray-600",
    displayName: typeName.length > 20 ? typeName.substring(0, 20) + "..." : typeName
  };
};

interface QuestionStats {
  total_questions: number;
  total_extractions: number;
  type_distribution: Array<{ type: string; count: number }>;
}

export default function PracticePage() {
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/questions/stats`);
        if (response.ok) {
          const data = await response.json();
          setQuestionStats(data);
        }
      } catch (error) {
        console.log('获取题库统计失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  // 开始分类练习
  const startCategoryPractice = (categoryType: string) => {
    try {
      // 保存练习配置
      const practiceConfig = {
        mode: 'category',
        categoryType: categoryType,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('practice_config', JSON.stringify(practiceConfig));
      
      // 跳转到练习页面
      window.location.href = '/practice/session';
    } catch (error) {
      console.error('启动分类练习失败:', error);
      alert('启动练习失败，请稍后重试');
    }
  };

  // 开始智能推荐练习
  const startSmartPractice = () => {
    try {
      // 检查是否有测评数据
      let assessmentData = null;
      
      // 检查专用练习数据
      let stored = localStorage.getItem('assessment_result_for_practice');
      if (stored) {
        const data = JSON.parse(stored);
        const dataAge = new Date().getTime() - new Date(data.timestamp).getTime();
        if (dataAge < 24 * 60 * 60 * 1000) { // 24小时内有效
          assessmentData = data.result;
        }
      }
      
      // 如果没有专用数据，检查通用测评结果
      if (!assessmentData) {
        const latestResult = localStorage.getItem('latest_assessment_result');
        if (latestResult) {
          const resultData = JSON.parse(latestResult);
          assessmentData = resultData;
          
          // 保存为练习专用数据
          const practiceData = {
            result: resultData,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem('assessment_result_for_practice', JSON.stringify(practiceData));
        }
      }
      
      if (!assessmentData) {
        alert('请先完成能力测评，获得智能推荐！\n\n点击下方"📊 能力测评"按钮完成测评。');
        return;
      }
      
      const practiceConfig = {
        mode: 'smart',
        assessmentResult: assessmentData,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('practice_config', JSON.stringify(practiceConfig));
      window.location.href = '/practice/session';
    } catch (error) {
      console.error('启动智能练习失败:', error);
      alert('启动练习失败，请稍后重试');
    }
  };

  // 开始模拟考试
  const startMockExam = () => {
    try {
      const practiceConfig = {
        mode: 'mock_exam',
        timeLimit: 120, // 120分钟
        questionCount: 18, // 18道题
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('practice_config', JSON.stringify(practiceConfig));
      window.location.href = '/practice/session';
    } catch (error) {
      console.error('启动模拟考试失败:', error);
      alert('启动考试失败，请稍后重试');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          
          {/* 页面标题 */}
          <div className="text-center mb-12">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              📚 题库练习系统
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              {loading ? "加载中..." : questionStats ? `${questionStats.total_questions}道精选真题，全面覆盖公考各个题型` : "精选真题，全面覆盖公考各个题型"}
            </p>
            
            {/* 总体统计 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 max-w-2xl mx-auto">
              {loading ? (
                <div className="grid grid-cols-3 gap-6 text-center animate-pulse">
                  <div>
                    <div className="h-8 bg-gray-300 rounded mb-2"></div>
                    <div className="text-gray-600">总题数</div>
                  </div>
                  <div>
                    <div className="h-8 bg-gray-300 rounded mb-2"></div>
                    <div className="text-gray-600">题型分类</div>
                  </div>
                  <div>
                    <div className="h-8 bg-gray-300 rounded mb-2"></div>
                    <div className="text-gray-600">文档提取</div>
                  </div>
                </div>
              ) : questionStats ? (
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-3xl font-bold text-blue-600 mb-1">{questionStats.total_questions}</div>
                    <div className="text-gray-600">总题数</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-green-600 mb-1">{questionStats.type_distribution?.length || 0}</div>
                    <div className="text-gray-600">题型分类</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-purple-600 mb-1">{questionStats.total_extractions}</div>
                    <div className="text-gray-600">文档提取</div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">加载统计数据失败</div>
              )}
            </div>
          </div>

          {/* 题型分类卡片 */}
          <div id="category-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {loading ? (
              // 加载中的骨架屏
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-16 h-16 bg-gray-300 rounded-full"></div>
                      <div className="text-right">
                        <div className="h-8 bg-gray-300 rounded w-12 mb-1"></div>
                        <div className="h-4 bg-gray-300 rounded w-16"></div>
                      </div>
                    </div>
                    <div className="h-5 bg-gray-300 rounded w-20 mb-2"></div>
                    <div className="h-4 bg-gray-300 rounded w-32 mb-4"></div>
                    <div className="flex items-center justify-between">
                      <div className="h-3 bg-gray-300 rounded w-16"></div>
                      <div className="w-5 h-5 bg-gray-300 rounded"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : questionStats?.type_distribution ? (
              questionStats.type_distribution.map((category, index) => {
                const typeInfo = getTypeInfo(category.type);
                return (
                <div key={index} className="group cursor-pointer" onClick={() => startCategoryPractice(category.type)}>
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transform transition-all duration-300 hover:scale-105">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${typeInfo.color} flex items-center justify-center text-2xl shadow-lg`}>
                        {typeInfo.icon}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-800">{category.count}</div>
                        <div className="text-sm text-gray-500">道题目</div>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">{typeInfo.displayName}</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      来自真实题库，覆盖考试重点
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">点击开始练习</span>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-500">暂无题型数据</div>
              </div>
            )}
          </div>

          {/* 练习模式选择 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">选择练习模式</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div 
                onClick={startSmartPractice}
                className="text-center p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all cursor-pointer group"
              >
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">智能练习</h3>
                <p className="text-gray-600 text-sm mb-4">
                  基于测评结果，AI推荐最适合的题目
                </p>
                <span className="inline-block bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full group-hover:bg-green-200">智能推荐</span>
              </div>
              
              <div 
                onClick={() => {
                  const categorySection = document.getElementById('category-section');
                  if (categorySection) {
                    categorySection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="text-center p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group"
              >
                <div className="text-4xl mb-4">📖</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">分类练习</h3>
                <p className="text-gray-600 text-sm mb-4">
                  按题型分类练习，针对性提升专项能力
                </p>
                <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full group-hover:bg-blue-200">经典模式</span>
              </div>
              
              <div 
                onClick={startMockExam}
                className="text-center p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer group"
              >
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">模拟考试</h3>
                <p className="text-gray-600 text-sm mb-4">
                  限时模拟考试环境，检验真实水平
                </p>
                <span className="inline-block bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full group-hover:bg-purple-200">挑战模式</span>
              </div>
            </div>
          </div>

          {/* 快速入口 */}
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">快速入口</h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/assessment"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105"
              >
                📊 能力测评
              </Link>
              <Link 
                href="/api/v1/questions/admin/dashboard"
                target="_blank"
                className="bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50 font-semibold py-3 px-8 rounded-xl shadow-md hover:shadow-lg transform transition-all duration-200 hover:scale-105"
              >
                🔧 题库管理后台
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
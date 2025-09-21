"use client";

import { useState, useEffect } from 'react';
import Navigation from '../../components/Navigation';
import Link from 'next/link';
import { MiniRadarChart } from '../../components/RadarChart';

interface AssessmentResult {
  session_id: string;
  total_score: number;
  dimension_scores: { [key: string]: number };
  completed_at: string;
}

// 维度名称映射
const dimensionNames: { [key: string]: { name: string; icon: string; color: string } } = {
  comprehension: { name: '理解能力', icon: '🧠', color: 'text-blue-600' },
  analysis: { name: '分析能力', icon: '🔍', color: 'text-green-600' },
  expression: { name: '表达能力', icon: '✍️', color: 'text-purple-600' },
  logic: { name: '逻辑推理', icon: '🎯', color: 'text-orange-600' },
  application: { name: '应用能力', icon: '⚡', color: 'text-red-600' },
  innovation: { name: '创新思维', icon: '💡', color: 'text-yellow-600' }
};

export default function ProfilePage() {
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    // 尝试从localStorage获取最新的测评结果
    try {
      const stored = localStorage.getItem('latest_assessment_result');
      if (stored) {
        const result = JSON.parse(stored);
        setAssessmentResult(result);
      }
    } catch (error) {
      console.log('无法获取测评结果:', error);
    }
  }, []);
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="bg-gradient-to-br from-purple-50 to-pink-100 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          
          {/* 页面标题 */}
          <div className="text-center mb-12">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-xl">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              👤 个人学习档案
            </h1>
            <p className="text-xl text-gray-600">
              追踪学习进度，见证能力成长
            </p>
          </div>

          {/* 功能预览卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            
            {/* 能力雷达图 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">能力雷达图</h3>
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              
              {/* 模拟雷达图占位 */}
              <div className="relative w-32 h-32 mx-auto mb-4">
                <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center">
                  <div className="text-4xl">📊</div>
                </div>
              </div>
              
              <p className="text-gray-600 text-sm text-center">
                六维能力可视化展示，清晰了解个人优劣势
              </p>
              
              {/* 能力雷达图或提示信息 */}
              <div className="mt-4 text-center">
                {assessmentResult ? (
                  <div>
                    <MiniRadarChart 
                      data={assessmentResult.dimension_scores}
                      dimensions={dimensionNames}
                      size={180}
                      className="mx-auto mb-4"
                    />
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-800 mb-1">
                        综合评分：{assessmentResult.total_score}分
                      </div>
                      <div className="text-xs text-gray-500">
                        测评时间：{new Date(assessmentResult.completed_at).toLocaleDateString()}
                      </div>
                      <Link 
                        href="/assessment"
                        className="inline-block mt-2 text-blue-600 text-sm hover:text-blue-800 transition-colors"
                      >
                        重新测评 →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <svg className="w-12 h-12 text-blue-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-blue-700 font-medium mb-2">暂无能力数据</p>
                    <p className="text-blue-600 text-sm">请先完成能力测评生成您的专属雷达图</p>
                    <Link 
                      href="/assessment"
                      className="inline-block mt-3 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors"
                    >
                      开始测评
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* 学习统计 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">学习统计</h3>
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              
              <div className="text-center">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">开始您的学习之旅</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    完成申论练习后，这里将显示您的学习统计数据
                  </p>
                  <Link 
                    href="/essay"
                    className="inline-block bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 transition-colors"
                  >
                    开始申论练习
                  </Link>
                </div>
              </div>
            </div>

            {/* 学习计划 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">学习计划</h3>
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              
              <div className="text-center">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                  <svg className="w-16 h-16 text-orange-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">个性化学习计划</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    完成能力测评后，系统将为您制定专属学习计划
                  </p>
                  <Link 
                    href="/assessment"
                    className="inline-block bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 transition-colors"
                  >
                    开始测评
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* 进步时间线 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">学习进步时间线</h2>
            
            <div className="text-center py-12">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-3">您的学习历程即将开始</h3>
              <p className="text-gray-600 mb-6">
                完成申论练习和能力测评后，这里将记录您的每一次进步
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link 
                  href="/assessment"
                  className="bg-blue-500 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors"
                >
                  开始能力测评
                </Link>
                <Link 
                  href="/essay"
                  className="bg-green-500 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-600 transition-colors"
                >
                  申论练习
                </Link>
              </div>
            </div>
          </div>

          {/* 行动建议 */}
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">开始建立您的学习档案</h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/assessment"
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105"
              >
                🎯 完成能力测评
              </Link>
              <Link 
                href="/"
                className="bg-white border-2 border-purple-500 text-purple-600 hover:bg-purple-50 font-semibold py-3 px-8 rounded-xl shadow-md hover:shadow-lg transform transition-all duration-200 hover:scale-105"
              >
                ✏️ 开始申论练习
              </Link>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              开始使用平台功能，建立您的专属学习档案
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

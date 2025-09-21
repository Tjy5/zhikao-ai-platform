"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navigation from '../components/Navigation';
import { API_BASE_URL } from '../config/api';

export default function HomePage() {
  const [realStats, setRealStats] = useState({
    totalQuestions: 0,
    totalExtractions: 0,
    loading: true
  });

  // 获取真实的后端数据
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/questions/stats`);
        if (response.ok) {
          const data = await response.json();
          setRealStats({
            totalQuestions: data.total_questions || 0,
            totalExtractions: data.total_extractions || 0,
            loading: false
          });
        }
      } catch (error) {
        console.log('获取统计数据失败:', error);
        setRealStats({
          totalQuestions: 135, // 备用数据
          totalExtractions: 1,
          loading: false
        });
      }
    };
    
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-xl mb-6">
              <span className="text-white text-3xl font-bold">智</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              AI公考智能学习平台
          </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              专业的申论智能批改系统，个性化能力测评，精选题库练习，助力您的公考之路
          </p>
        </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/essay"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 text-lg"
            >
              🚀 开始申论批改
            </Link>
            <Link 
              href="/assessment"
              className="bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50 font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 text-lg"
            >
              📊 能力测评 <span className="ml-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">NEW</span>
            </Link>
        </div>

          {/* Platform Real Stats */}
          {!realStats.loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="text-3xl font-bold text-blue-600 mb-2">{realStats.totalQuestions}</div>
                <div className="text-gray-600">精选题目</div>
                <div className="text-xs text-gray-400 mt-1">来自真题库</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="text-3xl font-bold text-green-600 mb-2">6</div>
                <div className="text-gray-600">题型分类</div>
                <div className="text-xs text-gray-400 mt-1">完整覆盖</div>
              </div>
            </div>
                )}
              </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">核心功能特色</h2>
            <p className="text-xl text-gray-600">AI驱动的智能学习体验，助您高效提升申论水平</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group cursor-pointer">
              <Link href="/essay" className="block">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transform transition-all duration-300 hover:scale-105">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">智能申论批改</h3>
                  <p className="text-gray-600 mb-4">
                    AI专家级批改，四维度评分体系，渐进式反馈，让您的每一次练习都有价值
                  </p>
                  <div className="text-blue-600 font-semibold group-hover:text-indigo-600 transition-colors">
                    立即体验 →
                  </div>
                </div>
              </Link>
                      </div>

            {/* Feature 2 */}
            <div className="group cursor-pointer">
              <Link href="/assessment" className="block">
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transform transition-all duration-300 hover:scale-105">
                  <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-6 shadow-lg relative">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-xs px-2 py-1 rounded-full font-bold">NEW</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">能力测评系统</h3>
                  <p className="text-gray-600 mb-4">
                    基于真题题库，每个题型深度测评，六维能力诊断，个性化学习路径推荐
                  </p>
                  <div className="text-green-600 font-semibold group-hover:text-emerald-600 transition-colors">
                    开始测评 →
                  </div>
                      </div>
              </Link>
                    </div>

            {/* Feature 3 */}
            <div className="group cursor-pointer">
              <Link href="/practice" className="block">
                <div className="bg-gradient-to-br from-purple-50 to-pink-100 rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transform transition-all duration-300 hover:scale-105">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">精选题库练习</h3>
                  <p className="text-gray-600 mb-4">
                    135道公考真题，6大题型完整覆盖，智能推题匹配，系统性提升解题能力
                  </p>
                  <div className="text-purple-600 font-semibold group-hover:text-pink-600 transition-colors">
                    开始练习 →
                  </div>
                </div>
              </Link>
                    </div>

            {/* Feature 4 */}
            <div className="group cursor-pointer">
              <Link href="/profile" className="block">
                <div className="bg-gradient-to-br from-orange-50 to-red-100 rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transform transition-all duration-300 hover:scale-105">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">学习档案管理</h3>
                  <p className="text-gray-600 mb-4">
                    个人进步追踪，学习数据分析，成长轨迹可视化，见证您的每一次提升
                  </p>
                  <div className="text-orange-600 font-semibold group-hover:text-red-600 transition-colors">
                    查看档案 →
                  </div>
                </div>
              </Link>
                </div>

            {/* Feature 5 */}
            <div className="group cursor-pointer">
              <Link href="/history" className="block">
                <div className="bg-gradient-to-br from-cyan-50 to-blue-100 rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transform transition-all duration-300 hover:scale-105">
                  <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">历史记录管理</h3>
                  <p className="text-gray-600 mb-4">
                    完整的练习历史，详细的批改记录，随时回顾学习轨迹，总结经验教训
                  </p>
                  <div className="text-cyan-600 font-semibold group-hover:text-blue-600 transition-colors">
                    查看历史 →
                  </div>
                </div>
              </Link>
              </div>

            {/* Feature 6 */}
            <div className="group cursor-pointer">
              <Link href="/api/v1/questions/admin/dashboard" target="_blank" className="block">
                <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transform transition-all duration-300 hover:scale-105">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-500 to-slate-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                                    </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">题库管理后台</h3>
                  <p className="text-gray-600 mb-4">
                    完整的题库管理系统，支持题目浏览、搜索、分类，管理135道精选题目
                  </p>
                  <div className="text-gray-600 font-semibold group-hover:text-slate-600 transition-colors">
                    访问后台 →
                    </div>
                </div>
              </Link>
                    </div>
                      </div>
                    </div>
      </section>

      {/* Process Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">学习流程</h2>
            <p className="text-xl text-gray-600">四步智能学习法，科学高效提升申论水平</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { 
                step: 1, 
                title: "能力测评", 
                desc: "AI诊断六维能力，识别优劣势", 
                icon: "📊",
                color: "from-green-500 to-emerald-600"
              },
              { 
                step: 2, 
                title: "智能练习", 
                desc: "个性化推题，针对性训练", 
                icon: "📚",
                color: "from-blue-500 to-indigo-600"
              },
              { 
                step: 3, 
                title: "专业批改", 
                desc: "渐进式AI批改，四维评分", 
                icon: "✏️",
                color: "from-purple-500 to-pink-600"
              },
              { 
                step: 4, 
                title: "进步追踪", 
                desc: "可视化成长，持续优化", 
                icon: "📈",
                color: "from-orange-500 to-red-600"
              },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${item.color} text-white flex items-center justify-center text-3xl shadow-lg`}>
                  {item.icon}
                </div>
                <div className="mb-2">
                  <span className="inline-block bg-white text-gray-700 text-sm px-3 py-1 rounded-full border border-gray-200 font-medium">
                    步骤 {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-4">开始您的AI学习之旅</h2>
          <p className="text-xl mb-8 opacity-90">
            体验AI驱动的智能申论批改，提升您的公考竞争力
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/assessment"
              className="bg-white text-blue-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 text-lg"
            >
              🎯 开始能力测评
            </Link>
            <Link 
              href="/essay"
              className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-600 font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 text-lg"
            >
              ✏️ 立即批改申论
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg mb-4">
              <span className="text-white text-xl font-bold">智</span>
            </div>
            <h3 className="text-xl font-bold mb-2">AI公考智能学习平台</h3>
            <p className="text-gray-400">专业 · 智能 · 高效</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-semibold mb-3">核心功能</h4>
              <ul className="space-y-2 text-gray-400">
                <li>申论智能批改</li>
                <li>能力测评系统</li>
                <li>题库练习</li>
                <li>学习档案</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">平台优势</h4>
              <ul className="space-y-2 text-gray-400">
                <li>AI专家级批改</li>
                <li>个性化学习路径</li>
                <li>实时进度追踪</li>
                <li>科学评分体系</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">技术特色</h4>
              <ul className="space-y-2 text-gray-400">
                <li>渐进式AI批改</li>
                <li>多维度评分体系</li>
                <li>智能题型识别</li>
                <li>个性化反馈建议</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-gray-400">
            <p>&copy; 2024 AI公考智能学习平台. 保留所有权利.</p>
        </div>
      </div>
      </footer>
    </div>
  );
}
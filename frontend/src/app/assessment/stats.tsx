"use client";

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

interface TypeInfo {
  type: string;
  available_questions: number;
  selected_per_assessment: number;
  sufficient: boolean;
}

interface AssessmentTypesData {
  total_questions_in_db: number;
  total_questions_per_assessment: number;
  assessment_config: TypeInfo[];
}

export default function AssessmentStats() {
  const [data, setData] = useState<AssessmentTypesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/assessment/types`);
        if (response.ok) {
          const result = await response.json();
          setData(result.data);
        }
      } catch (error) {
        console.error('获取测评统计信息失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-4 bg-gray-200 rounded w-3/4"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">题库配置详情</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">{data.total_questions_in_db}</div>
          <div className="text-gray-600">题库总题数</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">{data.total_questions_per_assessment}</div>
          <div className="text-gray-600">每次测评题数</div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">各题型配置</h3>
        {data.assessment_config.map((config, index) => (
          <div key={index} className={`border rounded-lg p-4 ${
            config.sufficient ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="font-semibold text-gray-800">{config.type}</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  config.sufficient ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {config.sufficient ? '充足' : '不足'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                可用: {config.available_questions} | 选用: {config.selected_per_assessment}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          ℹ️ 测评系统会从每个题型中随机选取3道题目，确保全面评估各项能力。
          题目基于真实考试题库，保证测评的专业性和准确性。
        </p>
      </div>
    </div>
  );
}

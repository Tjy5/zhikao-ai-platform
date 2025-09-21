"use client";

import { useEffect, useRef } from 'react';

interface RadarChartProps {
  data: { [key: string]: number }; // 各维度得分
  dimensions: { [key: string]: { name: string; icon: string; color: string } }; // 维度信息
  size?: number; // 图表大小
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

export default function RadarChart({ 
  data, 
  dimensions, 
  size = 300, 
  className = "" 
}: RadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置canvas大小
    canvas.width = size;
    canvas.height = size;

    // 清空画布
    ctx.clearRect(0, 0, size, size);

    // 计算中心点和半径
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = Math.min(centerX, centerY) - 60; // 留出边距显示标签

    // 获取所有维度（包括0分的维度）
    const dimensionKeys = Object.keys(data);
    const values = dimensionKeys.map(key => data[key]);
    const labels = dimensionKeys.map(key => dimensions[key]?.name || key);

    if (dimensionKeys.length === 0) {
      // 如果没有任何数据，显示提示信息
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('暂无测评数据', size/2, size/2);
      return;
    }

    // 计算每个角度
    const angleStep = (2 * Math.PI) / dimensionKeys.length;

    // 绘制背景网格
    const gridLevels = 5; // 5个等级圆圈
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    for (let level = 1; level <= gridLevels; level++) {
      const levelRadius = (radius * level) / gridLevels;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, levelRadius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // 绘制轴线
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;

    for (let i = 0; i < dimensionKeys.length; i++) {
      const angle = i * angleStep - Math.PI / 2; // 从顶部开始
      const endX = centerX + Math.cos(angle) * radius;
      const endY = centerY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    // 计算数据点位置
    const dataPoints: Point[] = [];
    for (let i = 0; i < dimensionKeys.length; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const value = Math.max(0, Math.min(100, values[i])); // 限制在0-100之间
      const pointRadius = (radius * value) / 100;
      const x = centerX + Math.cos(angle) * pointRadius;
      const y = centerY + Math.sin(angle) * pointRadius;
      dataPoints.push({ x, y });
    }

    // 绘制数据区域
    if (dataPoints.length > 0) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // 蓝色半透明
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(dataPoints[0].x, dataPoints[0].y);
      for (let i = 1; i < dataPoints.length; i++) {
        ctx.lineTo(dataPoints[i].x, dataPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 绘制数据点
    ctx.fillStyle = '#3b82f6';
    for (const point of dataPoints) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    // 绘制标签
    ctx.fillStyle = '#374151';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < dimensionKeys.length; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const labelRadius = radius + 30;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;

      // 绘制标签背景
      const label = labels[i];
      const metrics = ctx.measureText(label);
      const labelWidth = metrics.width + 8;
      const labelHeight = 20;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(x - labelWidth / 2, y - labelHeight / 2, labelWidth, labelHeight);

      // 绘制标签文字
      ctx.fillStyle = '#374151';
      ctx.fillText(label, x, y);

      // 绘制分数
      const score = values[i].toFixed(0);
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${score}分`, x, y + 15);
    }

    // 绘制中心分数等级圆圈
    const avgScore = values.reduce((sum, val) => sum + val, 0) / values.length;
    const centerCircleRadius = 25;
    
    // 确定等级颜色
    let levelColor, levelText;
    if (avgScore >= 90) {
      levelColor = '#10b981';
      levelText = '优秀';
    } else if (avgScore >= 80) {
      levelColor = '#3b82f6';
      levelText = '良好';
    } else if (avgScore >= 70) {
      levelColor = '#f59e0b';
      levelText = '中等';
    } else if (avgScore >= 60) {
      levelColor = '#f97316';
      levelText = '及格';
    } else {
      levelColor = '#ef4444';
      levelText = '需提升';
    }

    // 绘制中心圆圈
    ctx.fillStyle = levelColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, centerCircleRadius, 0, 2 * Math.PI);
    ctx.fill();

    // 绘制中心文字
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(levelText, centerX, centerY - 5);
    
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${avgScore.toFixed(0)}分`, centerX, centerY + 8);

  }, [data, dimensions, size]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <canvas 
        ref={canvasRef} 
        className="border border-gray-200 rounded-lg shadow-sm"
        style={{ width: size, height: size }}
      />
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">行测题型雷达图</p>
        <p className="text-xs text-gray-500 mt-1">
          外圈代表满分(100分)，内圈代表各题型得分
        </p>
      </div>
    </div>
  );
}

// 简化版雷达图组件（用于预览）
export function MiniRadarChart({ 
  data, 
  dimensions, 
  size = 120,
  className = "" 
}: RadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = Math.min(centerX, centerY) - 20;

    const dimensionKeys = Object.keys(data);
    const values = dimensionKeys.map(key => data[key]);

    if (dimensionKeys.length === 0) {
      // 如果没有数据，显示空状态
      ctx.fillStyle = '#ccc';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('无数据', size/2, size/2);
      return;
    }

    const angleStep = (2 * Math.PI) / dimensionKeys.length;

    // 绘制背景圆圈
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let level = 1; level <= 3; level++) {
      const levelRadius = (radius * level) / 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, levelRadius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // 计算数据点
    const dataPoints: Point[] = [];
    for (let i = 0; i < dimensionKeys.length; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const value = Math.max(0, Math.min(100, values[i]));
      const pointRadius = (radius * value) / 100;
      const x = centerX + Math.cos(angle) * pointRadius;
      const y = centerY + Math.sin(angle) * pointRadius;
      dataPoints.push({ x, y });
    }

    // 绘制数据区域
    if (dataPoints.length > 0) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(dataPoints[0].x, dataPoints[0].y);
      for (let i = 1; i < dataPoints.length; i++) {
        ctx.lineTo(dataPoints[i].x, dataPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 绘制数据点
    ctx.fillStyle = '#3b82f6';
    for (const point of dataPoints) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    }

  }, [data, dimensions, size]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`rounded-lg ${className}`}
      style={{ width: size, height: size }}
    />
  );
}


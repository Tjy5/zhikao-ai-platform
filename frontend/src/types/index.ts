/**
 * 共享类型定义
 * 包含应用中常用的接口和类型
 */

// 写作反馈相关类型
export interface ScoreDetail {
  item: string;
  fullScore: number;
  actualScore: number;
  description: string;
}

export interface GradingResult {
  score: number;
  feedback: string;
  suggestions: string[];
  scoreDetails?: ScoreDetail[];
  taskType?: string;
  taskTypeSource?: 'ai' | 'client' | string;
}

export interface RawWritingFeedbackResult {
  content: string;
  contentFormat: 'markdown' | string;
}

export interface RawWritingStreamEvent extends RawWritingFeedbackResult {
  stage?: number | string;
  progress?: number;
  partial?: boolean;
  status?: string;
  message?: string;
}

// 手风琴组件状态类型
export interface AccordionState {
  scoreDetails: boolean;
  feedback: boolean;
  suggestions: boolean;
}

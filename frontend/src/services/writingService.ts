import apiClient from './apiClient';
import type {
  WritingSubmission,
  RawWritingFeedbackResult,
  HistorySummaryResponse,
  HistoryDetail,
  HistoryClearResponse,
} from '../types/api';

export const writingService = {
  /**
   * Submit writing for grading (synchronous)
   */
  grade: async (data: WritingSubmission): Promise<RawWritingFeedbackResult> => {
    return apiClient.post<RawWritingFeedbackResult>('/api/v1/writings/grade', data);
  },

  /**
   * Submit writing for progressive grading (SSE)
   * Returns the SSE endpoint URL with submission data encoded
   */
  gradeProgressive: async (): Promise<{ url: string }> => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    // Return URL - the actual SSE connection will be handled by the grading page
    return { url: `${baseURL}/api/v1/writings/grade-progressive` };
  },

  /**
   * Get SSE URL for progressive grading
   */
  getProgressiveGradingUrl: (): string => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    return `${baseURL}/api/v1/writings/grade-progressive`;
  },

  /**
   * Get grading history list (newest first).
   * Omit `limit` to use the backend default (50, clamped 1..200).
   * NOTE: each item's `content` is the grading feedback (markdown),
   * NOT the user's original writing.
   */
  getHistory: async (limit?: number): Promise<HistorySummaryResponse> => {
    const path = limit
      ? `/api/v1/writings/history?limit=${limit}`
      : '/api/v1/writings/history';
    return apiClient.get<HistorySummaryResponse>(path);
  },

  /**
   * Get a single history record with original writing + full feedback.
   */
  getHistoryDetail: async (id: string): Promise<HistoryDetail> => {
    return apiClient.get<HistoryDetail>(
      `/api/v1/writings/history/${encodeURIComponent(id)}`
    );
  },

  /**
   * Clear ALL of the current user's history.
   * Returns `{ deleted: n }` where n is the count removed.
   */
  clearHistory: async (): Promise<HistoryClearResponse> => {
    return apiClient.delete<HistoryClearResponse>('/api/v1/writings/history');
  },

  /**
   * Delete a single history record by id.
   * Idempotent and user-scoped on the backend: returns `{ deleted: 1 }` if the
   * caller owned the record, otherwise `{ deleted: 0 }`.
   */
  deleteHistoryItem: async (id: string): Promise<HistoryClearResponse> => {
    return apiClient.delete<HistoryClearResponse>(
      '/api/v1/writings/history/' + encodeURIComponent(id)
    );
  },
};

export default writingService;

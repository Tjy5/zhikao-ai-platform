'use client';

import { useCallback, useState } from 'react';

import { useOptionalAuth } from '../../../auth/AuthContext';
import { useToast } from '../../../components/Toast';
import { useProgress } from '../../../hooks';
import type { RawWritingFeedbackResult } from '../../../types';
import { writingApi } from '../../../utils/apiClient';
import { publishWritingHistoryRefresh } from '../../../utils/writingHistoryRefresh';
import { debugError, debugWarn } from '../../../utils/logger';
import {
  buildWritingContent,
  isFinalGradingPayload,
  isFinalStreamPayload,
  type WritingStreamEvent,
  normalizeFinalStreamResult,
  normalizeGradingResult,
} from '../utils/grading';

class WritingStreamAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WritingStreamAiError';
  }
}

export const useWritingGrading = () => {
  const toast = useToast();
  const auth = useOptionalAuth();
  const userId = auth?.user?.id ?? null;
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [myAnswer, setMyAnswer] = useState('');
  const [gradingResult, setGradingResult] = useState<RawWritingFeedbackResult | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  const {
    progress,
    statusText,
    setStatusText,
    startProgress,
    finishProgress,
    stopProgress,
  } = useProgress();

  const handleStreamEvent = useCallback(
    async (event: WritingStreamEvent) => {
      const { stage } = event;

      if (stage === 'error') {
        throw new WritingStreamAiError(String(event.message ?? '评分失败'));
      }

      if (isFinalStreamPayload(event)) {
        setStatusText('完成评估');
        setGradingResult(normalizeFinalStreamResult(event));
        finishProgress();
        return true;
      }

      // Non-final events are status/progress only and MUST NOT be rendered
      // as completed grading results. Update status text without touching
      // gradingResult so the loading skeleton stays visible.
      if (typeof event.message === 'string' && event.message.trim() !== '') {
        setStatusText(event.message);
      }
      return false;
    },
    [finishProgress, setStatusText]
  );

  const processStreamResponse = useCallback(
    async (response: Response) => {
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('流式响应为空');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let receivedFinal = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;

          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;

          let event: WritingStreamEvent;
          try {
            event = JSON.parse(jsonStr) as WritingStreamEvent;
          } catch (err) {
            debugWarn('SSE chunk 解析失败', err);
            continue;
          }
          receivedFinal = (await handleStreamEvent(event)) || receivedFinal;
        }
      }

      if (!receivedFinal) {
        throw new Error('流式响应未返回最终结果');
      }
    },
    [handleStreamEvent]
  );

  const submitWriting = useCallback(async () => {
    if (!sourceMaterial.trim()) {
      toast.show('请先填写材料或要求', 'warning', 3000);
      return;
    }
    if (!myAnswer.trim()) {
      toast.show('请先填写你的作答', 'warning', 3000);
      return;
    }

    setIsLoading(true);
    setStatusText('初始化...');
    startProgress();

    const combinedContent = buildWritingContent(sourceMaterial, myAnswer);

    try {
      try {
        setStatusText('AI 批改进行中...');
        const response = await writingApi.gradeProgressive({
          content: combinedContent,
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        await processStreamResponse(response);
        publishWritingHistoryRefresh({ userId, trigger: 'writing-grading' });
        return;
      } catch (streamError) {
        if (streamError instanceof WritingStreamAiError) {
          throw streamError;
        }
        debugWarn('流式处理失败，回退到一次性处理:', streamError);
      }

      setStatusText('生成 Markdown 批改结果...');
      const rawData = (await writingApi.grade({
        content: combinedContent,
      })) as RawWritingFeedbackResult;
      if (!isFinalGradingPayload(rawData)) {
        throw new Error('AI评分结果格式异常');
      }
      setGradingResult(normalizeGradingResult(rawData));
      setStatusText('完成评估');
      finishProgress();
      publishWritingHistoryRefresh({ userId, trigger: 'writing-grading' });
    } catch (error) {
      debugError('评分失败:', error);
      setGradingResult(null);
      toast.show('评分失败：请检查网络或稍后重试', 'error', 4000);
    } finally {
      stopProgress();
      setIsLoading(false);
    }
  }, [
    finishProgress,
    myAnswer,
    processStreamResponse,
    sourceMaterial,
    setStatusText,
    startProgress,
    stopProgress,
    toast,
    userId,
  ]);

  return {
    sourceMaterial,
    myAnswer,
    gradingResult,
    isLoading,
    progress,
    statusText,
    setSourceMaterial,
    setMyAnswer,
    submitWriting,
  };
};

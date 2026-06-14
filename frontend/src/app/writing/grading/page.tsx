import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSSE } from '../../../hooks/useSSE';
import { writingService } from '../../../services/writingService';
import { Button } from '../../../components/ui/Button';
import { MarkdownRenderer } from '../../../components/ui/MarkdownRenderer';
import { Toast } from '../../../components/ui/Toast';
import type { SSEProgressEvent } from '../../../types/api';

export default function GradingPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get content from navigation state
  const content = location.state?.content as string | undefined;

  // SSE state
  const [stage, setStage] = useState<number | 'error'>(1);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('准备中...');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<{
    classification?: string;
    retryable?: boolean;
  } | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Redirect if no content
  useEffect(() => {
    if (!content) {
      navigate('/app/writing', { replace: true });
    }
  }, [content, navigate]);

  const handleSSEMessage = useCallback((data: SSEProgressEvent) => {
    // Debug logging only in development
    if (import.meta.env.DEV) {
      console.log('SSE event received:', data);
    }

    if (data.stage === 'error') {
      setHasError(true);
      setStage('error');
      setStatus(data.status || '评分失败');
      setMessage(data.message || '发生未知错误');
      setErrorInfo({
        classification: data.classification,
        retryable: data.retryable,
      });
    } else if (typeof data.stage === 'number') {
      setStage(data.stage);
      setProgress(data.progress || 0);
      setStatus(data.status || '处理中...');
      setMessage(data.message || '');

      // Check if complete
      if (data.stage === 2 && data.progress === 100 && data.content) {
        setResult(data.content);
        setIsComplete(true);
      }
    }
  }, []);

  const handleSSEError = useCallback((event: Event) => {
    // Debug logging only in development
    if (import.meta.env.DEV) {
      console.error('SSE connection error:', event);
    }
    setHasError(true);
    setStatus('连接中断');
    setMessage('与服务器的连接已中断，请刷新页面重试');
  }, []);

  // Get JWT token for authorization
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const { isConnected } = useSSE<SSEProgressEvent>(
    content ? writingService.getProgressiveGradingUrl() : null,
    {
      onMessage: handleSSEMessage,
      onError: handleSSEError,
      reconnect: false,
      headers,
      body: { content },
      method: 'POST',
    }
  );

  const handleRetry = () => {
    navigate('/app/writing', { state: { content } });
  };

  const handleNewWriting = () => {
    navigate('/app/writing');
  };

  const handleViewHistory = () => {
    navigate('/app/history');
  };

  if (!content) {
    return null; // Will redirect via useEffect
  }

  return (
    <main id="main-content" className="min-h-screen bg-paper-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-display text-deep-ink mb-2">AI 批改中</h1>
          <p className="text-slate-gray">
            {isComplete
              ? '批改已完成'
              : hasError
              ? '批改过程中出现错误'
              : '正在分析您的写作内容...'}
          </p>
        </div>

        {/* Progress Section */}
        {!isComplete && !hasError && (
          <div className="bg-card-cream rounded-lg p-6 border border-slate-gray/20 mb-6">
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-deep-ink">{status}</span>
                <span className="text-sm font-medium text-vermilion">{progress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-gray/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-vermilion transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Stage Indicator */}
            <div className="flex items-center gap-4 mb-4">
              <div
                className={`flex items-center gap-2 ${
                  typeof stage === 'number' && stage >= 1 ? 'text-vermilion' : 'text-slate-gray'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    typeof stage === 'number' && stage >= 1 ? 'bg-vermilion text-paper-white' : 'bg-slate-gray/20'
                  }`}
                >
                  1
                </div>
                <span className="text-sm font-medium">内容分析</span>
              </div>

              <div className="flex-1 h-px bg-slate-gray/20" />

              <div
                className={`flex items-center gap-2 ${
                  typeof stage === 'number' && stage >= 2 ? 'text-vermilion' : 'text-slate-gray'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    typeof stage === 'number' && stage >= 2 ? 'bg-vermilion text-paper-white' : 'bg-slate-gray/20'
                  }`}
                >
                  2
                </div>
                <span className="text-sm font-medium">AI 评分</span>
              </div>
            </div>

            {/* Status Message */}
            {message && (
              <p className="text-sm text-slate-gray mt-4 p-3 bg-paper-white rounded-md">
                {message}
              </p>
            )}

            {/* Connection Status */}
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-gray">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-success-ink' : 'bg-warning-amber'
                }`}
              />
              {isConnected ? '已连接' : '连接中...'}
            </div>
          </div>
        )}

        {/* Error Section */}
        {hasError && (
          <div className="bg-error-crimson/10 rounded-lg p-6 border border-error-crimson/30 mb-6">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-error-crimson flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-error-crimson mb-2">{status}</h2>
                <p className="text-sm text-deep-ink mb-3">{message}</p>
                {errorInfo?.classification && (
                  <p className="text-xs text-slate-gray mb-2">
                    错误类型: {errorInfo.classification}
                  </p>
                )}
                {errorInfo?.retryable && (
                  <p className="text-xs text-success-ink">
                    ✓ 此错误可以重试
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              {errorInfo?.retryable && (
                <Button onClick={handleRetry} variant="primary">
                  重新批改
                </Button>
              )}
              <Button onClick={handleNewWriting} variant="secondary">
                返回写作页
              </Button>
            </div>
          </div>
        )}

        {/* Result Section */}
        {isComplete && result && (
          <div className="space-y-6">
            <div className="bg-card-cream rounded-lg p-6 border border-slate-gray/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-deep-ink">批改结果</h2>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success-ink/10 text-success-ink">
                  ✓ 已完成
                </span>
              </div>

              {/* Markdown Content */}
              <MarkdownRenderer>{result}</MarkdownRenderer>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleNewWriting} variant="primary">
                继续练习
              </Button>
              <Button onClick={handleViewHistory} variant="secondary">
                查看历史记录
              </Button>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(result);
                  setToastMessage('批改结果已复制到剪贴板');
                }}
                variant="ghost"
              >
                复制结果
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setToastMessage(null)}
        />
      )}
    </main>
  );
}

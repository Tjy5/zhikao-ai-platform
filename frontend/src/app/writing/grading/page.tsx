import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSSE, type SSEErrorEvent } from '../../../hooks/useSSE';
import { apiClient } from '../../../services/apiClient';
import { writingService } from '../../../services/writingService';
import { Button } from '../../../components/ui/Button';
import { StageTrace } from '../../../components/grading/StageTrace';
import { GradingReport } from '../../../components/grading/GradingReport';
import type { SSEProgressEvent } from '../../../types/api';
import type { WritingDeskState } from '../page';

/**
 * GradingConsole — /app/writing/grading. design.md §10.5.
 *
 * Drives the SSE grading flow:
 *   WritingDesk submit → navigate here with location.state { content, taskType }
 *   → open SSE (fetch + ReadableStream, POST — NOT EventSource) to
 *   /api/v1/writings/grade-progressive → render StageTrace while waiting → on
 *   the terminal event, render GradingReport (success) or a classified error
 *   (manual retry only).
 *
 * Correctness anchors (design.md §8 / §10.5):
 *  - The grading stream is POST + body, so `useSSE` uses fetch+ReadableStream.
 *  - NO automatic reconnect — reconnect == re-submit == duplicate LLM billing.
 *    `reconnect: false` is passed explicitly and is also the hook default.
 *  - On unmount the in-flight request is aborted via the hook's AbortController
 *    (the hook sets isMounted=false before aborting, so no post-unmount state).
 *
 * The backend emits exactly ONE terminal SSE event (success with stage 2 +
 * content, or an error with classification + retryable). There are no
 * intermediate stage events, so the StageTrace advances CLIENT-SIDE on timers
 * to communicate "AI is working through stages" — this is a visual
 * representation, not literal server-side stage reporting.
 *
 * Refresh loses the essay (location.state is transient) — accepted trade-off
 * per design.md §10.5 (one-shot flow); we redirect to the writing desk.
 *
 * Timing: the run start is stamped in a mount EFFECT inside GradingRun (not
 * during render), and the duration is computed in the success callback. This
 * keeps all Date.now()/ref access out of the render path (React 19 purity).
 */

interface ErrorInfo {
  /** Friendly Chinese title, e.g. "请求超时". */
  status: string;
  /** User-facing message (from the backend's AiClassification.userMessage, or a
   * client-side message for network errors). */
  message: string;
  /** Backend classification value (unavailable / timeout / …), or 'network'. */
  classification?: string;
  retryable: boolean;
}

interface GradingResult {
  content: string;
  contentFormat?: string;
  /** ISO timestamp captured on completion (for the report header). */
  completedAt: string;
  /** Client-measured grading duration in ms. */
  durationMs: number;
}

type Phase = 'running' | 'complete' | 'error';

/** Backend AiClassification value → friendly Chinese title. */
const CLASSIFICATION_LABELS: Record<string, string> = {
  unavailable: 'AI 未配置',
  authentication: '鉴权失败',
  timeout: '请求超时',
  rate_limit: '请求过于频繁',
  refusal: 'AI 拒绝处理',
  malformed_output: '结果格式异常',
  provider_error: 'AI 服务错误',
  unknown: 'AI 调用失败',
};

const STAGE_LABELS = ['正在分析题意', '正在多维评价', '正在生成报告'];

// --- Child: owns the SSE connection for one grading attempt. ---

interface GradingRunProps {
  content: string;
  taskType?: string;
  onComplete: (result: GradingResult) => void;
  onError: (info: ErrorInfo) => void;
}

function GradingRun({ content, taskType, onComplete, onError }: GradingRunProps) {
  const [activeStep, setActiveStep] = useState(0);
  // Guards / timing live in refs — only touched inside effects + callbacks,
  // NEVER during render (React 19 purity / ref rules).
  const completedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  // Stable auth headers via a lazy useState initializer (sanctioned one-time
  // read). Keeps useSSE's serialized headersKey stable so the effect never
  // reconnects (reconnect == re-bill).
  const [headers] = useState<Record<string, string>>(() => {
    const token =
      localStorage.getItem('token') || sessionStorage.getItem('token');
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  });

  // Stamp the run start on mount (effect, not render) and advance the trace.
  useEffect(() => {
    startedAtRef.current = Date.now();
    const t1 = setTimeout(() => setActiveStep(1), 3500);
    const t2 = setTimeout(() => setActiveStep(2), 8000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      startedAtRef.current = null;
    };
  }, []);

  // Stable callbacks so useSSE's effect deps don't churn. Both gate on
  // completedRef so a late duplicate event can't flip the view after completion.
  const handleMessage = useCallback(
    (data: SSEProgressEvent) => {
      if (completedRef.current) return;

      if (data.stage === 'error') {
        completedRef.current = true;
        const classification = data.classification ?? 'unknown';
        onError({
          status:
            CLASSIFICATION_LABELS[classification] ?? data.status ?? '评分失败',
          message: data.message || 'AI 批改失败，请稍后重试',
          classification,
          retryable: data.retryable !== false, // backend default for unknown is retryable
        });
        return;
      }

      // Success: the backend sends stage 2 + progress 100 + content.
      if (typeof data.stage === 'number' && data.content) {
        completedRef.current = true;
        const now = Date.now();
        const durationMs =
          startedAtRef.current != null ? now - startedAtRef.current : 0;
        onComplete({
          content: data.content,
          contentFormat: data.contentFormat,
          completedAt: new Date(now).toISOString(),
          durationMs,
        });
      }
      // Non-terminal numeric stages without content are ignored — the backend
      // never sends them today, and partial streaming is out of scope.
    },
    [onComplete, onError]
  );

  const handleError = useCallback(
    (event: SSEErrorEvent) => {
      if (completedRef.current) return;

      // Phase 8 SSE-401 cross-layer fix. The grading stream issues its own
      // fetch (useSSE POST branch) and bypasses apiClient.request, so a 401
      // (token expired mid-stream) used to surface as a generic "网络连接失败".
      // Route it through the SAME clear-auth + navigate-/login path the rest
      // of the app uses, via apiClient.notifyUnauthorized() (mirrors
      // handleResponse's 401 branch). Mark complete first so a late duplicate
      // event can't flip the view after the redirect.
      if (event.status === 401) {
        completedRef.current = true;
        apiClient.notifyUnauthorized();
        return;
      }

      completedRef.current = true;
      // Transport-level failure (DNS / offline / CORS / non-2xx other than
      // 401). `status` is undefined for genuine transport errors. Always
      // retryable — the user can re-submit.
      onError({
        status: '网络连接失败',
        message: '无法连接到服务器，请检查网络后重试。',
        classification: 'network',
        retryable: true,
      });
    },
    [onError]
  );

  useSSE<SSEProgressEvent>(writingService.getProgressiveGradingUrl(), {
    onMessage: handleMessage,
    onError: handleError,
    reconnect: false, // NEVER auto-reconnect (billing-correctness, design.md §8).
    headers,
    body: { content, task_type: taskType },
    method: 'POST',
  });

  return (
    <div className="space-y-5">
      {/* Heading */}
      <div>
        <h1 className="text-[24px] md:text-[28px] font-semibold tracking-tight text-ink">
          正在批阅
        </h1>
        <p className="text-[13px] text-mute mt-1 leading-relaxed">
          AI 正在分析你的作答，通常 10–20 秒。请勿离开本页——关闭会中断批改。
        </p>
      </div>

      {/* Stage trace (design.md §10.5 signature). */}
      <div className="rounded-lg border border-line bg-panel/50 px-4 py-4">
        <StageTrace activeStep={activeStep} />
        <p
          className="mt-3 text-[12.5px] text-mute"
          aria-live="polite"
          aria-atomic="true"
        >
          {STAGE_LABELS[activeStep] ?? '处理中'}……
        </p>
      </div>

      {/* Skeleton of the incoming report so the layout doesn't jump on completion. */}
      <div
        className="rounded-lg border border-line bg-paper overflow-hidden divide-y divide-line"
        aria-hidden="true"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-5 md:px-6 py-4">
            <div className="h-3 w-24 rounded bg-panel animate-pulse mb-2.5" />
            <div className="h-3 w-full rounded bg-panel animate-pulse mb-1.5" />
            <div className="h-3 w-5/6 rounded bg-panel animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Child: error view with classification + manual retry. ---

interface ErrorViewProps {
  info: ErrorInfo;
  onRetry: () => void;
  onBackToWriting: () => void;
}

function ErrorView({ info, onRetry, onBackToWriting }: ErrorViewProps) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] md:text-[28px] font-semibold tracking-tight text-mark">
          {info.status}
        </h1>
        <p className="text-[13px] text-mute mt-1 leading-relaxed">
          {info.message}
        </p>
        {info.classification && info.classification !== 'network' && (
          <p className="text-[11px] font-mono text-faint mt-1.5">
            分类：{info.classification}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-mark/30 bg-mark-soft/40 p-4">
        <p className="text-[12.5px] text-ink leading-relaxed">
          {info.retryable
            ? '可以重试本次批改。重试会重新调用 AI 服务。'
            : '本次错误不可重试。请检查 AI 配置（如 API key）后再试。'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {info.retryable && <Button onClick={onRetry}>重新批改</Button>}
          <Button onClick={onBackToWriting} variant="outline">
            返回写作台
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Page: owns phase + retry state, mounts a fresh GradingRun per attempt. ---

export default function GradingPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as WritingDeskState | null;
  const content = state?.content;
  const taskType = state?.taskType;

  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState<Phase>('running');
  const [result, setResult] = useState<GradingResult | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  // No essay (direct nav / refresh) → back to the writing desk. design.md §10.5:
  // refresh-loses-state is an accepted one-shot-flow trade-off.
  useEffect(() => {
    if (!content) {
      navigate('/app/writing', { replace: true });
    }
  }, [content, navigate]);

  const handleComplete = useCallback((r: GradingResult) => {
    setResult(r);
    setPhase('complete');
  }, []);

  const handleError = useCallback((info: ErrorInfo) => {
    setErrorInfo(info);
    setPhase('error');
  }, []);

  // Retry: reset state, bump runId so <GradingRun key=…> remounts fresh — its
  // unmount aborts any residual connection, and the new mount opens a clean SSE.
  const handleRetry = () => {
    setResult(null);
    setErrorInfo(null);
    setPhase('running');
    setRunId((n) => n + 1);
  };

  const handlePracticeAgain = () => {
    // Carry the essay back so the user can revise + resubmit without re-pasting.
    navigate('/app/writing', {
      state: { content, taskType } as WritingDeskState,
    });
  };

  if (!content) {
    // Will redirect via the effect above.
    return null;
  }

  if (phase === 'complete' && result) {
    return (
      <main id="main-content">
        <GradingReport
          markdown={result.content}
          meta={{
            time: result.completedAt,
            durationMs: result.durationMs,
          }}
          onPracticeAgain={handlePracticeAgain}
        />
      </main>
    );
  }

  if (phase === 'error' && errorInfo) {
    return (
      <main id="main-content">
        <ErrorView
          info={errorInfo}
          onRetry={handleRetry}
          onBackToWriting={() => navigate('/app/writing')}
        />
      </main>
    );
  }

  return (
    <main id="main-content">
      <GradingRun
        key={runId}
        content={content}
        taskType={taskType}
        onComplete={handleComplete}
        onError={handleError}
      />
    </main>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Toast, type ToastType } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

/**
 * WritingDesk — /app/writing. design.md §10.4.
 *
 * Ruled "answer-sheet" editor (horizontal-line background) + sidebar with
 * real-time stats (字数 / 段落 / 预估批改时长 / 进度 vs 最低字数) and an empty
 * rubric-dimension preview (no scores — those only exist in the opt-in
 * structured view, which the backend does not yet produce).
 *
 * Submit validation: empty or below the minimum length disables the submit
 * button and shows an inline recovery hint. On submit, the essay (+ optional
 * task type) is passed to the grading console via `location.state` — the SSE
 * connection is opened there, not here.
 */

/** Minimum content length for meaningful 申论 feedback. */
const MIN_CONTENT_LENGTH = 200;

/**
 * Sidebar location.state passed to the grading console. Kept in a shared shape
 * so the console can re-read it on retry.
 */
export interface WritingDeskState {
  content: string;
  taskType?: string;
}

interface ToastState {
  show: boolean;
  message: string;
  type: ToastType;
}

/** Preview dimensions for the empty rubric bars (opt-in structured view). */
const DIMENSION_PREVIEW = ['论点', '论据', '结构', '语言'];

/**
 * Mixed word/character count: each CJK char counts as one, latin words count
 * by whitespace split. Mirrors the pre-rebuild behaviour but trimmed.
 */
function countWords(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  const cjkRe = /[㐀-鿿豈-﫿]/g;
  const cjk = trimmed.match(cjkRe);
  const cjkCount = cjk ? cjk.length : 0;
  const nonCjk = trimmed.replace(cjkRe, ' ').trim();
  const wordCount = nonCjk ? nonCjk.split(/\s+/).filter(Boolean).length : 0;
  return cjkCount + wordCount;
}

function countParagraphs(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\n{2,}/).filter((p) => p.trim()).length;
}

/** Rough client-side grading-time estimate (seconds), clamped to a sane band. */
function estimateGradingSeconds(charCount: number): number {
  if (charCount <= 0) return 0;
  return Math.min(60, Math.max(8, Math.ceil(charCount / 80)));
}

export default function WritingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Optional restore from the grading report's "用此题再练一次" action: the essay
  // is passed back so the user can revise and re-submit without re-pasting.
  // Read once on mount; transient navigation state, not persisted.
  const restored = location.state as
    | { content?: string; taskType?: string }
    | null;

  const [content, setContent] = useState(restored?.content ?? '');
  const [taskType, setTaskType] = useState(restored?.taskType ?? '');
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'info',
  });
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Auto-grow the textarea so the ruled background tiles naturally and the
  // editor never shows an internal scrollbar for moderate-length essays.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 420)}px`;
  }, [content]);

  const charCount = content.length;
  const wordCount = useMemo(() => countWords(content), [content]);
  const paragraphCount = useMemo(() => countParagraphs(content), [content]);
  const estimatedSeconds = estimateGradingSeconds(charCount);
  const progress = Math.min(100, (charCount / MIN_CONTENT_LENGTH) * 100);

  const trimmed = content.trim();
  const isEmpty = trimmed.length === 0;
  const tooShort = !isEmpty && trimmed.length < MIN_CONTENT_LENGTH;
  const canSubmit = !isEmpty && !tooShort;

  const validationError = isEmpty
    ? '请输入写作内容'
    : tooShort
    ? `内容过短，建议至少 ${MIN_CONTENT_LENGTH} 字以获得有效批阅（当前 ${trimmed.length} 字）`
    : null;

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      showToast(validationError ?? '请输入写作内容', 'warning');
      return;
    }
    const state: WritingDeskState = {
      content: trimmed,
      taskType: taskType.trim() || undefined,
    };
    navigate('/app/writing/grading', { state });
  };

  return (
    <main id="main-content" className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-[24px] md:text-[28px] font-semibold tracking-tight text-ink">
          申论写作台
        </h1>
        <p className="text-[13px] text-mute mt-1 leading-relaxed max-w-[72ch]">
          粘贴作答或直接写，提交后给出结构化批阅报告：任务类型判断、综合评价、亮点、改进建议与参考优化。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* ===== Editor (ruled answer-sheet) ===== */}
        <div className="min-w-0">
          <label htmlFor="writing-content" className="sr-only">
            申论作答
          </label>
          <textarea
            ref={textareaRef}
            id="writing-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="把申论作答粘进来，或直接写……"
            aria-describedby="writing-validation"
            aria-invalid={validationError ? 'true' : undefined}
            className={[
              'ruled w-full min-h-[420px] resize-none overflow-hidden',
              'px-4 py-3 rounded-lg border bg-paper text-ink',
              'placeholder:text-faint',
              'focus:outline-none focus-visible:border-ink',
              validationError ? 'border-mark/50' : 'border-line',
            ].join(' ')}
          />

          {/* Inline validation / recovery hint */}
          <div
            id="writing-validation"
            className="mt-2 min-h-[20px] text-[12.5px] leading-relaxed"
            aria-live="polite"
          >
            {validationError ? (
              <span className="text-mark">{validationError}</span>
            ) : (
              <span className="text-mute">
                已写 {charCount} 字 · 进度 {Math.round(progress)}%
              </span>
            )}
          </div>
        </div>

        {/* ===== Sidebar: stats + dimension preview + submit ===== */}
        <aside className="space-y-4">
          {/* Real-time stats — inline strip, NOT big-number cards (design.md §10.4). */}
          <div className="rounded-lg border border-line bg-panel/50 p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
              <div>
                <div className="text-mute">字数</div>
                <div className="text-[18px] font-semibold text-ink leading-tight mt-0.5">
                  {wordCount}
                </div>
              </div>
              <div>
                <div className="text-mute">字符</div>
                <div className="text-[18px] font-semibold text-ink leading-tight mt-0.5">
                  {charCount}
                </div>
              </div>
              <div>
                <div className="text-mute">段落</div>
                <div className="text-[18px] font-semibold text-ink leading-tight mt-0.5">
                  {paragraphCount}
                </div>
              </div>
              <div>
                <div className="text-mute">预估批改</div>
                <div className="text-[18px] font-semibold text-ink leading-tight mt-0.5">
                  {estimatedSeconds > 0 ? `约 ${estimatedSeconds}s` : '—'}
                </div>
              </div>
            </div>

            {/* Progress vs minimum */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-mute mb-1">
                <span>最低 {MIN_CONTENT_LENGTH} 字</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-line overflow-hidden">
                <div
                  className="h-full bg-mark transition-ui"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Optional task type (backend supports it; improves grading). */}
          <div className="rounded-lg border border-line bg-paper p-4">
            <label
              htmlFor="writing-task-type"
              className="block text-[11px] font-medium text-mute mb-1.5"
            >
              任务类型（可选）
            </label>
            <input
              id="writing-task-type"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              placeholder="如：综合分析"
              className="w-full h-9 px-3 rounded-md border border-line bg-paper text-[13px] text-ink placeholder:text-faint focus:outline-none focus-visible:border-ink"
            />
          </div>

          {/* Rubric-dimension preview — EMPTY bars, no scores (no fake data). */}
          <div className="rounded-lg border border-line bg-paper p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-mute">
                评分维度预览
              </span>
              <span className="text-[10.5px] font-mono text-mute">
                批改后展示
              </span>
            </div>
            <ul className="space-y-2">
              {DIMENSION_PREVIEW.map((dim) => (
                <li key={dim} className="flex items-center gap-2.5">
                  <span className="text-[12px] text-mute w-8 shrink-0">
                    {dim}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-line" />
                  <span className="text-[11px] font-mono text-mute w-6 text-right">
                    —
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Submit + secondary actions */}
          <div className="space-y-2">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              size="lg"
              className="w-full"
            >
              开始批改
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
            <button
              type="button"
              onClick={() => {
                if (trimmed) setShowClearConfirm(true);
              }}
              disabled={!trimmed}
              className="w-full text-[12.5px] text-mute hover:text-ink px-3 py-2 rounded-md border border-line hover:bg-panel transition-ui disabled:opacity-40 disabled:pointer-events-none"
            >
              清空内容
            </button>
          </div>
        </aside>
      </div>

      {/* Toast */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((t) => ({ ...t, show: false }))}
        />
      )}

      {/* Clear confirmation */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="清空内容"
        message="确定要清空当前作答吗？此操作无法撤销。"
        confirmText="清空"
        cancelText="取消"
        variant="danger"
        onConfirm={() => {
          setContent('');
          setTaskType('');
          setShowClearConfirm(false);
          showToast('内容已清空', 'success');
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </main>
  );
}

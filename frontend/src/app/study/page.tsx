import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Toast, type ToastType } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { SectionView } from '../../components/study/SectionView';
import { SectionEditor } from '../../components/study/SectionEditor';
import { RevisionHistory } from '../../components/study/RevisionHistory';
import { AdminReviewQueue } from '../../components/study/AdminReviewQueue';
import { useAuth } from '../../hooks/useAuth';
import { useStudySections } from '../../hooks/useStudySections';
import { studyService } from '../../services/studyService';
import { AppError, ErrorType } from '../../types/domain';
import {
  BASELINE_SECTIONS,
  SECTION_ORDER,
} from './baseline';
import type { SectionKey } from '../../types/api';

// Re-export so callers can import the packed fallback from the page module
// (design contract: page.tsx exports BASELINE_SECTIONS).
export { BASELINE_SECTIONS };

/**
 * /app/study — 申论学习 read+edit view. design.md (study-read-page) §3 + parent
 * design.md §5/§6/§10/§12 + child-4 (study-edit-ui) design.md.
 *
 * Read path: `useStudySections()` is API-first with a packed-baseline fallback
 * — the page is NEVER blank. On API failure/empty it renders the baseline
 * content normally and shows a small mono note; edit/history/review controls
 * are hidden in that state (no API = no writes).
 *
 * Edit path (child-4): per-section controls gated on `useAuth().isAdmin`:
 *  - user  → 「提交修改建议」(propose; read page unchanged, toast on submit)
 *  - admin → 「编辑」(direct_edit; immediate) + 「历史」(revisions drawer)
 *  - admin → page-head 「审核队列」entry (GET /proposals; approve/reject)
 *
 * Anti-pattern compliance (design.md §12) is preserved verbatim from child-1:
 * inline mono stat strip (not big-number cards), gap-px divider grids for real
 * sequences only, inline SVG (no icon library), all sans, OKLCH tokens only.
 */

// ----------------------------------------------------------------------------
// Inline SVG icon — design.md §2 (no icon library). Hero CTA chevron only.
// ----------------------------------------------------------------------------

function ArrowRight({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

// ----------------------------------------------------------------------------
// Error mapping — 403 special-case for study write actions (design.md §2).
// ----------------------------------------------------------------------------

function studyWriteMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    const status = (error.details as { status?: number } | undefined)?.status;
    // apiClient maps 403 → ErrorType.AUTH, which the generic helper would render
    // as "登录已过期" — misleading for an admin-gated study write. Show the real
    // cause instead. (Admin controls are client-gated by isAdmin, so this is a
    // safety net for stale role state.)
    if (status === 403) return '需要管理员权限才能执行此操作';
    if (error.type === ErrorType.AUTH) return '登录已过期，请重新登录';
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

// ----------------------------------------------------------------------------
// Editor overlay (modal) — wraps SectionEditor.
// ----------------------------------------------------------------------------

interface EditorState {
  key: SectionKey;
  mode: 'propose' | 'edit';
}

function EditorOverlay({
  editor,
  initialContent,
  isSubmitting,
  onSubmit,
  onClose,
}: {
  editor: EditorState;
  initialContent: unknown;
  isSubmitting: boolean;
  onSubmit: (payload: {
    contentJson: unknown;
    changeSummary?: string;
  }) => void;
  onClose: () => void;
}) {
  // Escape to close (not while submitting).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isSubmitting, onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-ink/50 backdrop-blur-sm px-4 py-8 overflow-y-auto"
      onClick={() => !isSubmitting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-editor-title"
    >
      <div
        className="bg-paper rounded-lg shadow-[0_10px_30px_-12px_oklch(0.24_0.02_262/0.30)] max-w-3xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <span id="section-editor-title" className="sr-only">
          编辑学习内容
        </span>
        <SectionEditor
          sectionKey={editor.key}
          initialContent={initialContent}
          mode={editor.mode}
          onSubmit={onSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------

export default function StudyPage() {
  const { isAdmin } = useAuth();
  const { phase, sections, error, reload } = useStudySections();

  // Overlays.
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [historyKey, setHistoryKey] = useState<SectionKey | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast.
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: ToastType;
  }>({ show: false, message: '', type: 'info' });
  const showToast = useCallback(
    (message: string, type: ToastType = 'info') =>
      setToast({ show: true, message, type }),
    []
  );

  // Pending-proposal count for the admin badge. Fetched only when admin AND the
  // sections API is reachable (phase==='ready'); re-fetched when the review
  // drawer closes (approvals may have changed it).
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const countReqIdRef = useRef(0);
  const fetchPendingCount = useCallback(() => {
    if (!isAdmin) return;
    const reqId = ++countReqIdRef.current;
    studyService
      .getProposals({ limit: 1, offset: 0 })
      .then((resp) => {
        if (reqId !== countReqIdRef.current) return;
        setPendingCount(resp?.total ?? 0);
      })
      .catch(() => {
        if (reqId !== countReqIdRef.current) return;
        setPendingCount(null);
      });
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && phase === 'ready') fetchPendingCount();
  }, [isAdmin, phase, fetchPendingCount]);

  // ----- Submit handler (propose / edit) with 403 special-case -----
  const handleSubmit = useCallback(
    async (payload: { contentJson: unknown; changeSummary?: string }) => {
      if (!editor) return;
      try {
        setIsSubmitting(true);
        if (editor.mode === 'edit') {
          await studyService.edit(editor.key, {
            content_json: payload.contentJson,
            change_summary: payload.changeSummary,
          });
          showToast('已保存，即时生效', 'success');
          reload(); // live content updated
        } else {
          await studyService.propose(editor.key, {
            content_json: payload.contentJson,
            change_summary: payload.changeSummary,
          });
          showToast('已提交修改建议，待管理员审核', 'success');
          // Read page unchanged; refresh the admin badge in case the actor is
          // an admin proposing (rare but possible).
          if (isAdmin) fetchPendingCount();
        }
        setEditor(null);
      } catch (err) {
        showToast(studyWriteMessage(err, '提交失败，请重试'), 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [editor, showToast, reload, isAdmin, fetchPendingCount]
  );

  // Controls are visible only when the API is reachable (phase==='ready'). In
  // fallback there is no API to write to, so hide edit/history/review.
  const showControls = phase === 'ready';

  const renderSectionActions = (key: SectionKey): ReactNode => {
    if (!showControls) return undefined;
    if (isAdmin) {
      return (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditor({ key, mode: 'edit' })}
          >
            编辑
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setHistoryKey(key)}>
            历史
          </Button>
        </>
      );
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setEditor({ key, mode: 'propose' })}
      >
        提交修改建议
      </Button>
    );
  };

  return (
    <div className="space-y-14 md:space-y-20">
      {/* ===== HERO — page head + inline mono stat strip + dual CTA
              (byte-identical to child-1; admin review entry appended) ===== */}
      <section aria-labelledby="study-hero-title">
        <div className="text-[11px] font-semibold tracking-[0.02em] text-oxblood">
          申论学习 · 知识地图
        </div>
        <h1
          id="study-hero-title"
          className="mt-2 text-[28px] md:text-[34px] font-semibold tracking-tight text-ink leading-[1.2]"
          style={{ textWrap: 'balance' }}
        >
          一张申论卷，拆成九个可训练模块
        </h1>
        <p className="mt-4 max-w-[65ch] text-[15px] text-mute leading-[1.85]">
          申论学习不是背模板，而是建立稳定流程：先看全卷作答要求，审清范围、内容、要求，再把材料层次转成题型需要的答案结构。
        </p>

        {/* Inline mono stat strip — explicitly NOT big-number cards (§12). */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] font-mono text-mute pb-5 border-b border-line">
          <span>
            原始转写 <b className="text-ink font-semibold">19</b> 份
          </span>
          <span className="text-faint" aria-hidden="true">
            ·
          </span>
          <span>
            知识模块 <b className="text-ink font-semibold">9</b>
          </span>
          <span className="text-faint" aria-hidden="true">
            ·
          </span>
          <span>
            题型细分 <b className="text-ink font-semibold">18+</b>
          </span>
          <span className="text-faint" aria-hidden="true">
            ·
          </span>
          <span>
            训练路径 <b className="text-ink font-semibold">4</b> 周
          </span>
        </div>

        {/* Dual CTAs + admin-only review queue entry. */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to="/app/writing"
            className="inline-flex items-center gap-2 text-[14px] font-medium bg-oxblood text-white px-5 py-2.5 rounded-lg hover:bg-oxblood-ink transition-ui"
          >
            去写作台
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/app/history"
            className="inline-flex items-center gap-2 text-[14px] font-medium border border-ink text-ink px-5 py-2.5 rounded-lg hover:bg-panel transition-ui"
          >
            看批改历史
          </Link>
          {isAdmin && showControls && (
            <Button
              variant="outline"
              size="md"
              className="ml-auto"
              onClick={() => setReviewOpen(true)}
            >
              审核队列
              {pendingCount !== null ? `（${pendingCount}）` : ''}
            </Button>
          )}
        </div>
      </section>

      {/* ===== Loading skeleton (brief; first fetch) ===== */}
      {phase === 'loading' && (
        <section aria-label="加载学习内容中" aria-busy="true">
          <div className="space-y-4">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-line rounded-xl overflow-hidden border border-line">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-paper p-5 space-y-3">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== Sections (ready OR fallback — both render content) ===== */}
      {(phase === 'ready' || phase === 'fallback') && (
        <>
          {phase === 'fallback' && (
            <div
              role="status"
              className="rounded-md border border-line bg-panel/60 px-4 py-2.5 text-[11.5px] font-mono text-mute leading-relaxed"
            >
              内容来自本地缓存{error ? '（无法连接服务器）' : '（暂无在线内容）'}。
              编辑、历史与审核功能在连接恢复后可用。
            </div>
          )}
          {SECTION_ORDER.map((key) => (
            <SectionView
              key={key}
              sectionKey={key}
              content={sections[key]}
              actions={renderSectionActions(key)}
            />
          ))}
        </>
      )}

      {/* ===== Editor overlay ===== */}
      {editor && (
        <EditorOverlay
          editor={editor}
          initialContent={sections[editor.key]}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onClose={() => !isSubmitting && setEditor(null)}
        />
      )}

      {/* ===== Revision history drawer (admin entry via per-section 历史) ===== */}
      <RevisionHistory
        sectionKey={historyKey ?? 'study-route'}
        isOpen={historyKey !== null}
        onClose={() => setHistoryKey(null)}
        isAdmin={isAdmin}
        onReverted={reload}
      />

      {/* ===== Admin review queue ===== */}
      <AdminReviewQueue
        isOpen={reviewOpen}
        onClose={() => {
          setReviewOpen(false);
          // Refresh the badge count after closing (approvals may have changed).
          fetchPendingCount();
        }}
        onApproveApplied={reload}
      />

      {/* ===== Toast ===== */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((t) => ({ ...t, show: false }))}
        />
      )}
    </div>
  );
}

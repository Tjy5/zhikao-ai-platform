import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Toast, type ToastType } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { SectionView } from '../../components/study/SectionView';
import { SectionEditor } from '../../components/study/SectionEditor';
import { StudyNav } from '../../components/study/StudyNav';
import { useAuth } from '../../hooks/useAuth';
import { useOperationPolicy } from '../../hooks/useOperationPolicy';
import { useStudySections } from '../../hooks/useStudySections';
import { useScrollSpy } from '../../hooks/useScrollSpy';
import { studyService } from '../../services/studyService';
import { AppError, ErrorType } from '../../types/domain';
import {
  BASELINE_SECTIONS,
  SECTION_LABELS,
  SECTION_ORDER,
} from './baseline';
import { sectionOutline, pointIdFor } from './sectionOutline';
import type { SectionKey } from '../../types/api';

// Re-export so callers can import the packed fallback from the page module
// (design contract: page.tsx exports BASELINE_SECTIONS).
export { BASELINE_SECTIONS };

/**
 * /app/study — learner-facing 申论学习 read + proposal view, restructured as a
 * focused single-module reader with a two-level in-page navigation rail
 * (design.md for this task).
 *
 * Layout (design.md §2):
 *  - HERO (page identity + stat strip + CTAs + admin links + proposal notice)
 *    on EVERY module view;
 *  - desktop: persistent two-level rail (sticky under the CommandBar) + a
 *    focused `<article>` rendering ONE module in full + a prev/next module
 *    pager;
 *  - mobile/tablet (`< lg`): the same rail lives in a slide-in drawer opened
 *    from a top bar;
 *  - selecting a knowledge point scrolls to its in-page anchor + highlights it
 *    (scroll-spy reflects the active point in the rail).
 *
 * Read path: `useStudySections()` is API-first with a packed-baseline fallback
 * — the page is NEVER blank. On API failure/empty it renders the baseline
 * content normally and shows a small mono note; proposal controls are hidden in
 * that state (no API = no writes).
 *
 * Proposal path: normal users can submit suggestions only when the operation
 * policy allows content proposals. Admin governance lives under `/admin/study/*`;
 * this learner page only links admins there.
 *
 * Anti-pattern compliance (design.md §12) is preserved: inline mono stat strip
 * (not big-number cards), gap-px divider grids via SectionView for real
 * sequences only, inline SVG (no icon library), all sans, OKLCH tokens only.
 * The in-page left rail is the documented scoped §12 exception (design.md §1.7)
 * — it does not replace the top CommandBar.
 */

const ANCHOR_PREFIX = 'study';

// ----------------------------------------------------------------------------
// Inline SVG icons — design.md §2 (no icon library). currentColor, aria-hidden.
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

function ArrowLeft({ className = '' }: { className?: string }) {
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
        d="M19 12H5M11 6l-6 6 6 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

// ----------------------------------------------------------------------------
// Error mapping — 403 special-case for study write actions (design.md §2).
// ----------------------------------------------------------------------------

function studyWriteMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    const status = (error.details as { status?: number } | undefined)?.status;
    if (status === 403) return '当前已关闭内容提案提交';
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
  mode: 'propose';
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
  const { phase, sections, error } = useStudySections();
  const {
    phase: policyPhase,
    policy,
    error: policyError,
    reload: reloadPolicy,
  } = useOperationPolicy();

  // Active module from the URL. Bare `/app/study` is redirected in App.tsx to
  // `/app/study/study-route`; an unknown key here is also redirected below.
  const { sectionKey: rawSectionKey } = useParams<{ sectionKey: string }>();
  const activeKey = useMemo(
    () =>
      rawSectionKey && (SECTION_ORDER as string[]).includes(rawSectionKey)
        ? (rawSectionKey as SectionKey)
        : null,
    [rawSectionKey]
  );

  // Overlays.
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mobile drawer open state (design.md §2.2). Desktop rail is always visible.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerPanelRef = useRef<HTMLDivElement | null>(null);
  const [manualPoint, setManualPoint] = useState<{
    key: SectionKey;
    index: number;
  } | null>(null);
  const manualPointResetRef = useRef<number | null>(null);

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

  // ----- Submit handler with 403 policy special-case -----
  const handleSubmit = useCallback(
    async (payload: { contentJson: unknown; changeSummary?: string }) => {
      if (!editor) return;
      if (policyPhase !== 'ready' || !policy?.content_proposals_enabled) {
        showToast('当前暂不可提交修改建议', 'warning');
        return;
      }
      try {
        setIsSubmitting(true);
        await studyService.propose(editor.key, {
          content_json: payload.contentJson,
          change_summary: payload.changeSummary,
        });
        showToast('已提交修改建议，待管理员审核', 'success');
        setEditor(null);
      } catch (err) {
        showToast(studyWriteMessage(err, '提交失败，请重试'), 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [editor, policyPhase, policy?.content_proposals_enabled, showToast]
  );

  // Controls are visible only when the sections API is reachable. In fallback
  // there is no API to write to, so hide proposal/admin-link affordances.
  const showControls = phase === 'ready';
  const proposalsEnabled =
    policyPhase === 'ready' && !!policy?.content_proposals_enabled;

  const proposalUnavailableCopy =
    policyPhase === 'loading'
      ? '正在确认修改建议开放状态'
      : policyPhase === 'error'
        ? '暂时无法读取提案策略，修改建议入口暂不可用'
        : '修改建议暂未开放';

  const renderSectionActions = (key: SectionKey): ReactNode => {
    if (!showControls) return undefined;
    if (isAdmin) {
      return (
        <Link
          to={`/admin/study/sections/${key}`}
          className="inline-flex h-9 items-center justify-center rounded-md border border-ink px-3 text-[13px] font-medium text-ink transition-ui hover:bg-panel"
        >
          治理此区段
        </Link>
      );
    }
    if (!proposalsEnabled) {
      return (
        <span className="max-w-[16rem] text-right text-[12px] text-mute leading-relaxed">
          {proposalUnavailableCopy}
        </span>
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

  const showProposalNotice =
    showControls && !isAdmin && policyPhase !== 'loading' && !proposalsEnabled;

  // ----- Two-level outline for the active module (data-driven, same source
  //       SectionView reads, so rail labels and rendered items never drift). -----
  const activeContent = activeKey ? sections[activeKey] : undefined;
  const points = useMemo(
    () => (activeKey ? sectionOutline(activeKey, activeContent) : []),
    [activeKey, activeContent]
  );
  // Stable point-id list for scroll-spy (same formula SectionView renders).
  const pointIds = useMemo(
    () => points.map((_, i) => pointIdFor(ANCHOR_PREFIX, i)),
    [points]
  );

  // Scroll-spy runs only for the focused reader (ready|fallback), never on a
  // loading skeleton or while the drawer is mid-open.
  const spyEnabled = phase === 'ready' || phase === 'fallback';
  const spyPoint = useScrollSpy(pointIds, spyEnabled);
  const manualActivePoint =
    manualPoint?.key === activeKey && manualPoint.index < points.length
      ? manualPoint.index
      : null;
  const activePoint =
    manualActivePoint ?? spyPoint;

  // Scroll a selected knowledge point into view + give immediate rail feedback
  // (the spy re-affirms on scroll settle). Closes the mobile drawer.
  const selectPoint = useCallback(
    (i: number) => {
      if (!activeKey) return;
      const el = document.getElementById(pointIdFor(ANCHOR_PREFIX, i));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setManualPoint({ key: activeKey, index: i });
      if (manualPointResetRef.current !== null) {
        window.clearTimeout(manualPointResetRef.current);
      }
      manualPointResetRef.current = window.setTimeout(() => {
        setManualPoint(null);
        manualPointResetRef.current = null;
      }, 1200);
      setDrawerOpen(false);
    },
    [activeKey]
  );

  useEffect(() => {
    return () => {
      if (manualPointResetRef.current !== null) {
        window.clearTimeout(manualPointResetRef.current);
      }
    };
  }, []);

  // Prev / next module for the pager (design.md §9).
  const activeIndex = activeKey
    ? SECTION_ORDER.indexOf(activeKey)
    : -1;
  const prevKey =
    activeKey && activeIndex > 0 ? SECTION_ORDER[activeIndex - 1] : null;
  const nextKey =
    activeKey && activeIndex >= 0 && activeIndex < SECTION_ORDER.length - 1
      ? SECTION_ORDER[activeIndex + 1]
      : null;

  // Mobile drawer focus: move focus into the dialog while open, close on Escape,
  // and return focus to the trigger on close.
  useEffect(() => {
    if (!drawerOpen) return;
    const trigger = drawerTriggerRef.current;
    const frame = window.requestAnimationFrame(() => {
      drawerPanelRef.current?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
  }, [drawerOpen]);

  // ----- Route guard: unknown / missing :sectionKey → overview module. This
  //       Navigate runs AFTER every hook above, so the hook order is stable. -----
  if (!activeKey) {
    return <Navigate to="/app/study/study-route" replace />;
  }

  return (
    <div className="space-y-10 md:space-y-12">
      {/* ===== HERO — page head + inline mono stat strip + learner CTAs =====
          Renders above the active module on EVERY module view (decision 6) so
          page identity + CTAs + proposal notice stay consistent. */}
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
            <div className="flex flex-wrap items-center gap-2 md:ml-auto">
              <Link
                to="/admin/study"
                className="inline-flex h-10 items-center justify-center rounded-md border border-ink px-4 text-[13px] font-medium text-ink transition-ui hover:bg-panel"
              >
                内容治理
              </Link>
              <Link
                to="/admin/study/reviews"
                className="inline-flex h-10 items-center justify-center rounded-md border border-line px-4 text-[13px] font-medium text-ink transition-ui hover:bg-panel"
              >
                审核队列
              </Link>
            </div>
          )}
        </div>

        {showProposalNotice && (
          <div
            role="status"
            className="mt-4 rounded-md border border-line bg-panel/60 px-4 py-2.5 text-[12.5px] text-mute leading-relaxed"
          >
            {policyPhase === 'error' ? (
              <>
                {policyError || '暂时无法读取提案策略'}，修改建议入口暂不可用。
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={reloadPolicy}
                >
                  重试
                </Button>
              </>
            ) : (
              '当前平台已关闭学习内容修改建议，学习内容仍可正常阅读。'
            )}
          </div>
        )}
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

      {/* ===== Focused single-module reader (ready OR fallback — both render
            content). The rail + pager wrap a single SectionView. ===== */}
      {(phase === 'ready' || phase === 'fallback') && (
        <>
          {phase === 'fallback' && (
            <div
              role="status"
              className="rounded-md border border-line bg-panel/60 px-4 py-2.5 text-[11.5px] font-mono text-mute leading-relaxed"
            >
              内容来自本地缓存{error ? '（无法连接服务器）' : '（暂无在线内容）'}。
              修改建议入口会在连接恢复且平台开放提案后可用。
            </div>
          )}

          {/* Mobile drawer trigger bar — only below lg. Shows the active module
              label so the reader always knows where they are. */}
          <div className="lg:hidden -mx-4 px-4 sticky top-14 z-10 bg-paper/95 backdrop-blur-sm border-b border-line py-2.5 flex items-center justify-between gap-3">
            <button
              ref={drawerTriggerRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="study-nav-drawer"
              className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-ink transition-ui hover:bg-panel"
            >
              <MenuIcon className="w-4 h-4" />
              模块
            </button>
            <span className="text-[12.5px] text-mute truncate">
              {SECTION_LABELS[activeKey]}
            </span>
          </div>

          <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)] gap-8 items-start">
            {/* Desktop rail — sticky under the CommandBar (top-20 = 5rem,
                coupled with the scroll-margin-top in globals.css). */}
            <aside className="hidden lg:block">
              <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
                <StudyNav
                  active={activeKey}
                  activePoint={activePoint}
                  points={points}
                  onSelectPoint={selectPoint}
                />
              </div>
            </aside>

            {/* Focused active module (whole-module render; point selection
                scrolls + highlights, never filters the content). */}
            <article className="min-w-0">
              <SectionView
                sectionKey={activeKey}
                content={sections[activeKey]}
                actions={renderSectionActions(activeKey)}
                anchorIdPrefix={ANCHOR_PREFIX}
              />

              {/* Prev / next module pager (design.md §9) — not in the HERO so
                  the HERO stays stable across modules. Missing side is simply
                  omitted (no greyed control). */}
              <nav
                aria-label="模块切换"
                className="mt-12 pt-6 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {prevKey ? (
                  <Link
                    to={`/app/study/${prevKey}`}
                    className="group flex items-start gap-3 rounded-lg border border-line bg-paper px-4 py-3 transition-ui hover:bg-panel"
                  >
                    <ArrowLeft className="mt-0.5 w-4 h-4 text-mute shrink-0 group-hover:text-ink transition-ui" />
                    <span className="min-w-0">
                      <span className="block text-[11px] font-mono text-mute">
                        上一模块
                      </span>
                      <span className="block text-[13.5px] font-medium text-ink truncate">
                        {SECTION_LABELS[prevKey]}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <span aria-hidden="true" className="hidden sm:block" />
                )}
                {nextKey ? (
                  <Link
                    to={`/app/study/${nextKey}`}
                    className="group flex items-start justify-end gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-right transition-ui hover:bg-panel sm:col-start-2"
                  >
                    <span className="min-w-0">
                      <span className="block text-[11px] font-mono text-mute">
                        下一模块
                      </span>
                      <span className="block text-[13.5px] font-medium text-ink truncate">
                        {SECTION_LABELS[nextKey]}
                      </span>
                    </span>
                    <ArrowRight className="mt-0.5 w-4 h-4 text-mute shrink-0 group-hover:text-ink transition-ui" />
                  </Link>
                ) : (
                  <span aria-hidden="true" className="hidden sm:block" />
                )}
              </nav>
            </article>
          </div>
        </>
      )}

      {/* ===== Mobile drawer — slide-in panel reusing StudyNav (no markup
            duplication). Backdrop + Escape close; selecting any item closes. ===== */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            ref={drawerPanelRef}
            id="study-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="申论学习模块导航"
            tabIndex={-1}
            className="absolute left-0 top-0 h-full w-[80%] max-w-[20rem] bg-paper shadow-[0_10px_30px_-12px_oklch(0.24_0.02_262/0.30)] overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-semibold text-ink">
                申论学习模块
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="关闭模块导航"
                className="grid place-items-center w-9 h-9 rounded-md text-mute transition-ui hover:bg-panel hover:text-ink"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            {/* The Link onSelectPoint handler closes the drawer (selectPoint
                also closes it for point buttons); module links navigate, which
                unmounts the drawer anyway. */}
            <div onClick={() => setDrawerOpen(false)} className="[&_a]:cursor-pointer">
              <StudyNav
                active={activeKey}
                activePoint={activePoint}
                points={points}
                onSelectPoint={selectPoint}
              />
            </div>
          </div>
        </div>
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

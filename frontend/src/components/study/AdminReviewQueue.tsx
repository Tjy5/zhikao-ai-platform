import { useCallback, useEffect, useRef, useState } from 'react';
import { studyService } from '../../services/studyService';
import { Button } from '../ui/Button';
import { Pin } from '../ui/Pin';
import { Toast, type ToastType } from '../ui/Toast';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { SectionView } from './SectionView';
import { SECTION_LABELS } from '../../app/study/baseline';
import { formatRelativeTimeShort, isWithinDay } from '../../utils/formatRelativeTime';
import { AppError, ErrorType } from '../../types/domain';
import type {
  SectionKey,
  StudyRevisionSummary,
  StudyRevision,
} from '../../types/api';

/**
 * AdminReviewQueue — cross-section pending-proposal queue (design.md §8).
 * Admin-only surface; the parent gates entry on `isAdmin`.
 *
 * `GET /proposals` (4-state) → list of `proposed` rows. Selecting one fetches
 * its snapshot (`GET /revisions/{id}`) and shows 通过 / 驳回 controls.
 *  - 通过 → `POST /revisions/{id}/approve` → toast + parent refresh + list refresh.
 *  - 驳回 → inline note dialog → `POST /revisions/{id}/reject { review_note }`.
 *
 * 403 special-case (design.md §2): approve/reject are admin-only; if a 403
 * leaks through, show "需要管理员权限" rather than the generic AUTH message.
 */

function studyWriteMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    const status = (error.details as { status?: number } | undefined)?.status;
    if (status === 403) return '需要管理员权限才能执行此操作';
    if (error.type === ErrorType.AUTH) return '登录已过期，请重新登录';
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function friendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    if (error.type === ErrorType.AUTH) return '登录已过期，请重新登录';
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

const INPUT_BASE =
  'w-full px-3 py-2 rounded-md border bg-paper text-ink text-[13px] ' +
  'placeholder:text-faint transition-ui border-line focus:border-ink focus:outline-none';

export interface AdminReviewQueueProps {
  isOpen: boolean;
  onClose: () => void;
  /** Notify parent to re-fetch live sections after approve. */
  onApproveApplied?: () => void;
}

export function AdminReviewQueue({
  isOpen,
  onClose,
  onApproveApplied,
}: AdminReviewQueueProps) {
  const [items, setItems] = useState<StudyRevisionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [listPhase, setListPhase] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [listError, setListError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<StudyRevision | null>(null);
  const [snapshotPhase, setSnapshotPhase] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const [acting, setActing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<StudyRevisionSummary | null>(
    null
  );
  const [rejectNote, setRejectNote] = useState('');

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

  // Stale-guards — SEPARATE counters for list vs snapshot so a row-select
  // (snapshot fetch) can't invalidate an in-flight list fetch, and vice versa.
  const listReqIdRef = useRef(0);
  const snapshotReqIdRef = useRef(0);

  // ----- Load proposals -----
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const reqId = ++listReqIdRef.current;
    void (async () => {
      try {
        setListPhase('loading');
        setListError(null);
        const resp = await studyService.getProposals({ limit: 50, offset: 0 });
        if (cancelled || reqId !== listReqIdRef.current) return;
        setItems(resp?.proposals ?? []);
        setTotal(resp?.total ?? 0);
        setListPhase('ready');
      } catch (err) {
        if (cancelled || reqId !== listReqIdRef.current) return;
        setListError(friendlyMessage(err, '加载审核队列失败'));
        setListPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, reloadTick]);

  // ----- Load snapshot -----
  const selectRow = useCallback(
    (id: number) => {
      if (selectedId === id) return;
      setSelectedId(id);
      setSnapshot(null);
      setSnapshotError(null);
      setSnapshotPhase('loading');
      const reqId = ++snapshotReqIdRef.current;
      studyService
        .getRevision(id)
        .then((data) => {
          if (reqId !== snapshotReqIdRef.current) return;
          setSnapshot(data);
          setSnapshotPhase('ready');
        })
        .catch((err) => {
          if (reqId !== snapshotReqIdRef.current) return;
          setSnapshotError(friendlyMessage(err, '加载提案快照失败'));
          setSnapshotPhase('error');
        });
    },
    [selectedId]
  );

  // ----- Approve -----
  const handleApprove = useCallback(async () => {
    if (!snapshot || acting) return;
    try {
      setActing(true);
      await studyService.approve(snapshot.id);
      showToast(`已通过「${SECTION_LABELS[snapshot.section_key]}」的提案`, 'success');
      onApproveApplied?.();
      setSelectedId(null);
      setSnapshot(null);
      setSnapshotPhase('idle');
      setReloadTick((t) => t + 1);
    } catch (err) {
      showToast(studyWriteMessage(err, '通过提案失败'), 'error');
    } finally {
      setActing(false);
    }
  }, [snapshot, acting, showToast, onApproveApplied]);

  // ----- Reject (with note) -----
  const openReject = useCallback(() => {
    if (!snapshot) return;
    setRejectTarget(snapshot);
    setRejectNote('');
  }, [snapshot]);

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectTarget || acting) return;
    try {
      setActing(true);
      await studyService.reject(rejectTarget.id, {
        review_note: rejectNote.trim() || undefined,
      });
      showToast('已驳回该提案', 'info');
      setRejectTarget(null);
      setRejectNote('');
      if (selectedId === rejectTarget.id) {
        setSelectedId(null);
        setSnapshot(null);
        setSnapshotPhase('idle');
      }
      setReloadTick((t) => t + 1);
    } catch (err) {
      showToast(studyWriteMessage(err, '驳回提案失败'), 'error');
    } finally {
      setActing(false);
    }
  }, [rejectTarget, acting, rejectNote, showToast, selectedId]);

  // ----- Escape to close -----
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !rejectTarget) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, rejectTarget]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-ink/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-review-title"
    >
      <div
        className="bg-paper w-full max-w-5xl h-full overflow-y-auto shadow-[0_10px_30px_-12px_oklch(0.24_0.02_262/0.30)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur-sm border-b border-line px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.02em] text-oxblood">
              审核队列
            </div>
            <h2
              id="admin-review-title"
              className="mt-0.5 text-[18px] font-semibold tracking-tight text-ink"
            >
              待审核的修改提案{total > 0 ? `（${total}）` : ''}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-md text-mute hover:text-ink hover:bg-panel transition-ui flex items-center justify-center"
            aria-label="关闭审核队列"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
          {/* ===== LIST ===== */}
          <div>
            {listPhase === 'loading' && (
              <div aria-busy="true" aria-label="加载审核队列中">
                <div className="rounded-lg border border-line bg-paper overflow-hidden divide-y divide-line">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                      <Skeleton className="h-5 w-10 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {listPhase === 'error' && (
              <div
                role="alert"
                className="rounded-lg border border-mark/30 bg-mark-soft/40 p-4"
              >
                <p className="text-[13px] text-mark leading-relaxed">{listError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setReloadTick((t) => t + 1)}
                >
                  重试
                </Button>
              </div>
            )}

            {listPhase === 'ready' && items.length === 0 && (
              <EmptyState
                title="没有待审核的提案"
                description="用户提交的修改建议会出现在这里；通过后即时生效，驳回（含理由）不生效。"
              />
            )}

            {listPhase === 'ready' && items.length > 0 && (
              <ul className="rounded-lg border border-line bg-paper overflow-hidden divide-y divide-line">
                {items.map((rev) => {
                  const isActive = rev.id === selectedId;
                  const fresh = isWithinDay(rev.created_at);
                  const label =
                    SECTION_LABELS[rev.section_key as SectionKey] ?? rev.section_key;
                  return (
                    <li key={rev.id}>
                      <button
                        type="button"
                        onClick={() => selectRow(rev.id)}
                        aria-current={isActive ? 'true' : undefined}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3.5 transition-ui ${
                          isActive ? 'bg-mark-soft/40' : 'hover:bg-panel/60'
                        }`}
                      >
                        <Pin
                          tone={fresh ? 'mark' : 'ok'}
                          className="mt-0.5 shrink-0"
                        >
                          {formatRelativeTimeShort(rev.created_at)}
                        </Pin>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-medium text-ink">
                              {label}
                            </span>
                            <span className="text-[11.5px] text-mute truncate">
                              {rev.author_username || '匿名'}
                            </span>
                          </div>
                          {rev.change_summary && (
                            <p className="mt-1 text-[12px] text-mute leading-relaxed line-clamp-2">
                              {rev.change_summary}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ===== SNAPSHOT + ACTIONS ===== */}
          <div>
            {selectedId === null && snapshotPhase !== 'loading' && (
              <EmptyState
                title="选择一条提案查看内容"
                description="查看提案的完整内容快照，决定通过（即时生效）或驳回（填写理由，不生效）。"
                className="min-h-[280px]"
              />
            )}

            {snapshotPhase === 'loading' && (
              <div
                aria-busy="true"
                aria-label="加载提案快照中"
                className="rounded-lg border border-line bg-paper p-5 space-y-3"
              >
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-24" />
                <div className="pt-3 border-t border-line space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            )}

            {snapshotPhase === 'error' && (
              <div
                role="alert"
                className="rounded-lg border border-mark/30 bg-mark-soft/40 p-4"
              >
                <p className="text-[13px] text-mark leading-relaxed">
                  {snapshotError}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => selectedId !== null && selectRow(selectedId)}
                >
                  重试
                </Button>
              </div>
            )}

            {snapshotPhase === 'ready' && snapshot && (
              <div className="space-y-4">
                <div className="rounded-lg border border-line bg-panel/60 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[12px] text-mute leading-relaxed">
                    <span className="font-medium text-ink">
                      {SECTION_LABELS[snapshot.section_key as SectionKey] ??
                        snapshot.section_key}
                    </span>
                    {' · '}
                    {snapshot.author_username || '匿名'}
                    {' · '}
                    {new Date(snapshot.created_at).toLocaleString('zh-CN')}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openReject}
                      disabled={acting}
                    >
                      驳回
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleApprove}
                      isLoading={acting}
                    >
                      通过
                    </Button>
                  </div>
                </div>
                {snapshot.change_summary && (
                  <div className="rounded-md border border-line bg-paper px-3.5 py-2.5">
                    <div className="text-[11px] font-semibold tracking-[0.02em] text-mute">
                      变更摘要
                    </div>
                    <p className="mt-1 text-[13px] text-ink leading-relaxed">
                      {snapshot.change_summary}
                    </p>
                  </div>
                )}
                <SectionView
                  sectionKey={snapshot.section_key as SectionKey}
                  content={snapshot.content_json}
                  hideHead
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject note dialog */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4"
          onClick={() => !acting && setRejectTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-dialog-title"
        >
          <div
            className="bg-paper rounded-lg shadow-[0_10px_30px_-12px_oklch(0.24_0.02_262/0.30)] max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reject-dialog-title" className="text-[16px] font-semibold text-ink">
              驳回这条提案
            </h3>
            <p className="mt-2 text-[13px] text-mute leading-relaxed">
              驳回后该提案不会生效。填写理由可以帮助提交者改进（可选）。
            </p>
            <label className="block mt-4">
              <span className="block text-[12px] font-medium text-mute mb-1">
                驳回理由（可选）
              </span>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                placeholder="例如：要点与材料范围不符"
                className={`${INPUT_BASE} resize-y min-h-[72px]`}
              />
            </label>
            <div className="flex items-center justify-end gap-2 mt-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => !acting && setRejectTarget(null)}
                disabled={acting}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRejectConfirm}
                isLoading={acting}
              >
                确认驳回
              </Button>
            </div>
          </div>
        </div>
      )}

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

export default AdminReviewQueue;

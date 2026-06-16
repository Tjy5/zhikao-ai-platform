import { useCallback, useEffect, useRef, useState } from 'react';
import { studyService } from '../../services/studyService';
import { Button } from '../ui/Button';
import { Pin } from '../ui/Pin';
import { Toast, type ToastType } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
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
 * RevisionHistory — per-section version drawer (design.md §7).
 *
 * `GET /sections/{key}/revisions` (4-state) → list of rows (relative-time Pin +
 * author + action-中文 + status badge + change_summary + reviewer). Clicking a
 * row fetches `GET /revisions/{id}` and renders the snapshot read-only via
 * `<SectionView hideHead>` (the drawer header already names the section).
 *
 * Admin affordance: each selected historical row has 「恢复到此版本」→
 * ConfirmDialog (variant warning; copy explicitly states history is NOT
 * deleted) → `POST /sections/{key}/revert` → toast + parent refresh.
 *
 * 403 special-case (design.md §2): the apiClient maps 403 → ErrorType.AUTH,
 * which the generic `friendlyMessage` would render as "登录已过期" — misleading
 * for a study write. We detect `details?.status === 403` and show "需要管理员权限"
 * instead.
 */

const ACTION_LABELS: Record<string, string> = {
  propose: '提案',
  direct_edit: '直改',
  approve: '审批',
  revert: '回滚',
  reject: '驳回',
  seed: '初始',
};

const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  proposed: {
    label: '待审',
    className: 'border-warn/40 text-warn',
  },
  published: {
    label: '已发布',
    className: 'border-ok/40 text-ok',
  },
  rejected: {
    label: '已驳回',
    className: 'border-mark/40 text-mark',
  },
  superseded: {
    label: '已归档',
    className: 'border-line text-mute',
  },
};

/** 403-aware friendly message for study write actions. */
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

export interface RevisionHistoryProps {
  sectionKey: SectionKey;
  surface?: 'drawer' | 'page';
  isOpen?: boolean;
  onClose?: () => void;
  isAdmin: boolean;
  revertEnabled?: boolean;
  /** Notify parent to re-fetch live sections after a revert. */
  onReverted?: () => void;
}

export function RevisionHistory({
  sectionKey,
  surface = 'drawer',
  isOpen = true,
  onClose,
  isAdmin,
  revertEnabled = true,
  onReverted,
}: RevisionHistoryProps) {
  const isDrawer = surface === 'drawer';
  const isActive = isDrawer ? isOpen : true;
  const sectionLabel = SECTION_LABELS[sectionKey];

  const [items, setItems] = useState<StudyRevisionSummary[]>([]);
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

  const [revertTarget, setRevertTarget] = useState<StudyRevisionSummary | null>(
    null
  );
  const [isReverting, setIsReverting] = useState(false);

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

  // ----- Load revision list -----
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const reqId = ++listReqIdRef.current;
    void (async () => {
      try {
        setListPhase('loading');
        setListError(null);
        const resp = await studyService.getRevisions(sectionKey, {
          limit: 50,
          offset: 0,
        });
        if (cancelled || reqId !== listReqIdRef.current) return;
        setItems(resp?.revisions ?? []);
        setListPhase('ready');
      } catch (err) {
        if (cancelled || reqId !== listReqIdRef.current) return;
        setListError(friendlyMessage(err, '加载版本历史失败'));
        setListPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, sectionKey, reloadTick]);

  // ----- Load snapshot on row select -----
  const selectRow = useCallback(
    (id: number, forceReload = false) => {
      if (!forceReload && selectedId === id) return;
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
          setSnapshotError(friendlyMessage(err, '加载版本快照失败'));
          setSnapshotPhase('error');
        });
    },
    [selectedId]
  );

  // ----- Revert (admin) -----
  const handleRevert = useCallback(async () => {
    if (!revertTarget || isReverting) return;
    if (!revertEnabled) {
      showToast('当前策略已关闭内容回滚', 'warning');
      setRevertTarget(null);
      return;
    }
    try {
      setIsReverting(true);
      await studyService.revert(sectionKey, {
        target_revision_id: revertTarget.id,
      });
      setRevertTarget(null);
      showToast(`已恢复至「${revertTarget.change_summary || '选定版本'}」`, 'success');
      onReverted?.();
      // Refresh this drawer's list so the new revert row appears.
      setReloadTick((t) => t + 1);
      setSelectedId(null);
      setSnapshot(null);
      setSnapshotPhase('idle');
    } catch (err) {
      showToast(studyWriteMessage(err, '恢复版本失败'), 'error');
    } finally {
      setIsReverting(false);
    }
  }, [
    revertTarget,
    isReverting,
    revertEnabled,
    sectionKey,
    showToast,
    onReverted,
  ]);

  // ----- Escape to close (overlay click also closes via onClose) -----
  useEffect(() => {
    if (!isDrawer || !isOpen || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !revertTarget) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isDrawer, isOpen, onClose, revertTarget]);

  if (!isActive) return null;

  const content = (
    <>
      <div className={`${isDrawer ? 'sticky top-0 z-10' : ''} bg-paper/95 backdrop-blur-sm border-b border-line px-5 py-4 flex items-center justify-between gap-3`}>
        <div>
          <div className="text-[11px] font-semibold tracking-[0.02em] text-oxblood">
            版本历史
          </div>
          <h2
            id="revision-history-title"
            className="mt-0.5 text-[18px] font-semibold tracking-tight text-ink"
          >
            {sectionLabel}
          </h2>
        </div>
        {isDrawer && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-md text-mute hover:text-ink hover:bg-panel transition-ui flex items-center justify-center"
            aria-label="关闭版本历史"
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
        )}
      </div>

      <div className="px-5 py-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
        {/* ===== LIST ===== */}
        <div>
          {listPhase === 'loading' && (
            <div aria-busy="true" aria-label="加载版本历史中">
              <div className="rounded-lg border border-line bg-paper overflow-hidden divide-y divide-line">
                {[0, 1, 2, 3].map((i) => (
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
              title="还没有版本记录"
              description="该节的初始版本由系统写入；产生提案、直改或回滚后会出现在这里。"
            />
          )}

          {listPhase === 'ready' && items.length > 0 && (
            <ul className="rounded-lg border border-line bg-paper overflow-hidden divide-y divide-line">
              {items.map((rev) => {
                const isActiveRow = rev.id === selectedId;
                const fresh = isWithinDay(rev.created_at);
                const action = ACTION_LABELS[rev.action] ?? rev.action;
                const badge = STATUS_BADGE[rev.status] ?? {
                  label: rev.status,
                  className: 'border-line text-mute',
                };
                return (
                  <li key={rev.id}>
                    <button
                      type="button"
                      onClick={() => selectRow(rev.id)}
                      aria-current={isActiveRow ? 'true' : undefined}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3.5 transition-ui ${
                        isActiveRow ? 'bg-mark-soft/40' : 'hover:bg-panel/60'
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
                            {action}
                          </span>
                          <span
                            className={`text-[10.5px] font-mono px-1.5 py-0.5 rounded border bg-paper ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[11.5px] text-mute truncate">
                            {rev.author_username || '系统'}
                          </span>
                        </div>
                        {rev.change_summary && (
                          <p className="mt-1 text-[12px] text-mute leading-relaxed line-clamp-2">
                            {rev.change_summary}
                          </p>
                        )}
                        {rev.reviewer_username && (
                          <p className="mt-0.5 text-[11px] font-mono text-mute">
                            审核人 {rev.reviewer_username}
                            {rev.review_note ? ` · ${rev.review_note}` : ''}
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

        {/* ===== SNAPSHOT ===== */}
        <div>
          {selectedId === null && snapshotPhase !== 'loading' && (
            <EmptyState
              title="选择一个版本查看快照"
              description="点击左侧任意版本，查看当时的完整内容。管理员可将其恢复为当前版本。"
              className="min-h-[280px]"
            />
          )}

          {snapshotPhase === 'loading' && (
            <div
              aria-busy="true"
              aria-label="加载版本快照中"
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
                onClick={() => selectedId !== null && selectRow(selectedId, true)}
              >
                重试
              </Button>
            </div>
          )}

          {snapshotPhase === 'ready' && snapshot && (
            <div className="space-y-4">
              <div className="rounded-lg border border-line bg-panel/60 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[12px] text-mute leading-relaxed">
                  <span className="font-mono text-ink">
                    #{snapshot.id}
                  </span>
                  {' · '}
                  {ACTION_LABELS[snapshot.action] ?? snapshot.action}
                  {' · '}
                  {snapshot.author_username || '系统'}
                  {' · '}
                  {new Date(snapshot.created_at).toLocaleString('zh-CN')}
                </div>
                {isAdmin && revertEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRevertTarget(snapshot)}
                  >
                    恢复到此版本
                  </Button>
                )}
                {isAdmin && !revertEnabled && (
                  <span className="text-[12px] text-mute">
                    内容回滚已被策略关闭
                  </span>
                )}
              </div>
              <SectionView
                sectionKey={sectionKey}
                content={snapshot.content_json}
                hideHead
              />
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div
      className={
        isDrawer
          ? 'fixed inset-0 z-40 flex items-stretch justify-end bg-ink/50 backdrop-blur-sm'
          : 'rounded-lg border border-line bg-paper overflow-hidden'
      }
      onClick={isDrawer ? onClose : undefined}
      role={isDrawer ? 'dialog' : 'region'}
      aria-modal={isDrawer ? 'true' : undefined}
      aria-labelledby="revision-history-title"
    >
      <div
        className={
          isDrawer
            ? 'bg-paper w-full max-w-5xl h-full overflow-y-auto shadow-[0_10px_30px_-12px_oklch(0.24_0.02_262/0.30)]'
            : 'w-full'
        }
        onClick={isDrawer ? (e) => e.stopPropagation() : undefined}
      >
        {content}
      </div>

      {/* Revert confirmation */}
      <ConfirmDialog
        isOpen={revertTarget !== null}
        title="恢复到此版本"
        message={`将把「${sectionLabel}」的内容恢复至该版本，并产生一条新的版本记录（回滚）。历史不会被删除，仍可在列表中查看。`}
        confirmText="确认恢复"
        variant="warning"
        onConfirm={handleRevert}
        onCancel={() => !isReverting && setRevertTarget(null)}
      />

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

export default RevisionHistory;

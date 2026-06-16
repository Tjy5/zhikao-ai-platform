import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SectionEditor } from '../../../../components/study/SectionEditor';
import { RevisionHistory } from '../../../../components/study/RevisionHistory';
import { SectionView } from '../../../../components/study/SectionView';
import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { Toast, type ToastType } from '../../../../components/ui/Toast';
import { useAdminOperationPolicy } from '../../../../hooks/useAdminOperationPolicy';
import { studyService } from '../../../../services/studyService';
import { AppError, ErrorType } from '../../../../types/domain';
import type { StudySection } from '../../../../types/api';
import {
  SECTION_LABELS,
  SECTION_META,
  SECTION_ORDER,
} from '../../../study/baseline';

type Phase = 'loading' | 'error' | 'empty' | 'ready';

function studyWriteMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    const status = (error.details as { status?: number } | undefined)?.status;
    if (status === 403) return '需要管理员权限才能执行此操作';
    if (error.type === ErrorType.AUTH) return '登录已过期，请重新登录';
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function readMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    if (error.type === ErrorType.AUTH) return '登录已过期，请重新登录';
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function AdminStudySectionPage() {
  const { key } = useParams<{ key: string }>();
  const sectionKey = useMemo(
    () => SECTION_ORDER.find((candidate) => candidate === key) ?? null,
    [key]
  );
  const [phase, setPhase] = useState<Phase>(sectionKey ? 'loading' : 'empty');
  const [section, setSection] = useState<StudySection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestIdRef = useRef(0);

  const {
    phase: policyPhase,
    policy,
    error: policyError,
    reload: reloadPolicy,
  } = useAdminOperationPolicy();

  const canDirectPublish =
    policyPhase === 'ready' && !!policy?.admin_direct_publish_enabled;
  const canRevert = policyPhase === 'ready' && !!policy?.content_revert_enabled;

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: ToastType;
  }>({ show: false, message: '', type: 'info' });

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
  }, []);

  const reloadSection = useCallback(() => {
    setPhase('loading');
    setReloadTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const reqId = ++requestIdRef.current;
    void (async () => {
      await Promise.resolve();
      if (cancelled || reqId !== requestIdRef.current) return;
      if (!sectionKey) {
        setSection(null);
        setPhase('empty');
        return;
      }
      setPhase('loading');
      setError(null);
      try {
        const result = await studyService.getSection(sectionKey);
        if (cancelled || reqId !== requestIdRef.current) return;
        setSection(result);
        setError(null);
        setPhase('ready');
      } catch (err) {
        if (cancelled || reqId !== requestIdRef.current) return;
        setError(readMessage(err, '加载区段内容失败'));
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sectionKey, reloadTick]);

  const handleSubmit = useCallback(
    async (payload: { contentJson: unknown; changeSummary?: string }) => {
      if (!sectionKey || isSubmitting) return;
      if (!canDirectPublish) {
        showToast('当前策略已关闭管理员直改发布', 'warning');
        return;
      }
      try {
        setIsSubmitting(true);
        await studyService.edit(sectionKey, {
          content_json: payload.contentJson,
          change_summary: payload.changeSummary,
        });
        setIsEditing(false);
        showToast('已保存，即时生效', 'success');
        reloadSection();
      } catch (err) {
        showToast(studyWriteMessage(err, '保存区段内容失败'), 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      sectionKey,
      isSubmitting,
      canDirectPublish,
      showToast,
      reloadSection,
    ]
  );

  if (!sectionKey) {
    return (
      <EmptyState
        title="未知区段"
        description="当前区段标识不在学习内容治理范围内，请从内容治理页重新选择。"
        action={
          <Link
            to="/admin/study"
            className="inline-flex h-10 items-center justify-center rounded-md border border-ink px-4 text-sm font-medium text-ink transition-ui hover:bg-panel"
          >
            返回内容治理
          </Link>
        }
      />
    );
  }

  const meta = SECTION_META[sectionKey];

  if (phase === 'loading') {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="加载区段治理中">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div role="alert" className="rounded-lg border border-mark/30 bg-mark-soft/40 p-5">
        <h1 className="text-[18px] font-semibold text-ink">区段内容加载失败</h1>
        <p className="mt-2 text-[13px] text-mute leading-relaxed">
          {error || '无法读取当前区段，请稍后重试。'}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={reloadSection}>
          重试
        </Button>
      </div>
    );
  }

  if (phase === 'empty' || !section) {
    return (
      <EmptyState
        title="区段内容尚未初始化"
        description="后端没有返回该区段内容，请确认 study baseline 已完成初始化。"
        action={
          <Button variant="outline" onClick={reloadSection}>
            重新加载
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.02em] text-oxblood">
            {meta.eyebrow}
          </div>
          <h1 className="mt-1 text-[26px] md:text-[30px] font-semibold text-ink leading-tight">
            {SECTION_LABELS[sectionKey]}
          </h1>
          <p className="mt-2 text-[14px] text-mute leading-relaxed max-w-[72ch]">
            {meta.desc}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/study"
            className="inline-flex h-9 items-center justify-center rounded-md border border-ink px-3 text-[13px] font-medium text-ink transition-ui hover:bg-panel"
          >
            返回内容治理
          </Link>
          <Button
            variant="primary"
            size="sm"
            disabled={!canDirectPublish}
            onClick={() => setIsEditing(true)}
            title={
              canDirectPublish
                ? '直接编辑并发布当前区段'
                : '当前策略未允许管理员直改发布'
            }
          >
            直接编辑
          </Button>
        </div>
      </section>

      {policyPhase === 'loading' && (
        <div
          className="rounded-lg border border-line bg-panel/60 px-4 py-3"
          aria-busy="true"
          aria-label="加载运营策略中"
        >
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      )}

      {policyPhase === 'error' && (
        <div
          role="alert"
          className="rounded-lg border border-warn/30 bg-warn/10 p-4"
        >
          <p className="text-[13px] text-ink leading-relaxed">
            无法读取运营策略：{policyError || '未知错误'}。直改与回滚入口会保持关闭，避免绕过平台策略。
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={reloadPolicy}
          >
            重试策略加载
          </Button>
        </div>
      )}

      {policyPhase === 'ready' && policy && (
        <div className="rounded-lg border border-line bg-panel/60 px-4 py-3 text-[13px] text-mute">
          管理员直改：{policy.admin_direct_publish_enabled ? '开启' : '关闭'}；
          内容回滚：{policy.content_revert_enabled ? '开启' : '关闭'}。
        </div>
      )}

      {isEditing && (
        <section className="rounded-lg border border-line bg-paper p-5">
          <SectionEditor
            sectionKey={sectionKey}
            initialContent={section.content_json}
            mode="edit"
            onSubmit={handleSubmit}
            onCancel={() => !isSubmitting && setIsEditing(false)}
            isSubmitting={isSubmitting}
          />
        </section>
      )}

      <SectionView sectionKey={sectionKey} content={section.content_json} />

      <RevisionHistory
        key={sectionKey}
        surface="page"
        sectionKey={sectionKey}
        isAdmin
        revertEnabled={canRevert}
        onReverted={reloadSection}
      />

      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((current) => ({ ...current, show: false }))}
        />
      )}
    </div>
  );
}

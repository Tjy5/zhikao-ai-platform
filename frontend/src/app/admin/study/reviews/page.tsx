import { Link } from 'react-router-dom';
import { AdminReviewQueue } from '../../../../components/study/AdminReviewQueue';
import { Button } from '../../../../components/ui/Button';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { useAdminOperationPolicy } from '../../../../hooks/useAdminOperationPolicy';

export default function AdminStudyReviewsPage() {
  const { phase, policy, error, reload } = useAdminOperationPolicy();
  const rejectNoteRequired =
    phase === 'ready' ? !!policy?.reject_note_required : true;

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[26px] md:text-[30px] font-semibold text-ink leading-tight">
            审核队列
          </h1>
          <p className="mt-2 text-[14px] text-mute leading-relaxed max-w-[72ch]">
            集中处理所有待审核的学习内容提案。通过后会立即刷新队列；驳回理由按当前运营策略校验。
          </p>
        </div>
        <Link
          to="/admin/study"
          className="text-[13px] text-mute hover:text-ink transition-ui"
        >
          返回内容治理
        </Link>
      </section>

      {phase === 'loading' && (
        <div
          className="rounded-lg border border-line bg-paper p-4"
          aria-busy="true"
          aria-label="加载审核策略中"
        >
          <Skeleton className="h-4 w-56" />
        </div>
      )}

      {phase === 'error' && (
        <div
          role="alert"
          className="rounded-lg border border-warn/30 bg-warn/10 p-4"
        >
          <p className="text-[13px] text-ink leading-relaxed">
            无法读取运营策略：{error || '未知错误'}。为避免违反后端策略，驳回操作会暂时要求填写理由。
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
            重试策略加载
          </Button>
        </div>
      )}

      {phase === 'ready' && policy?.reject_note_required && (
        <div className="rounded-lg border border-line bg-panel/60 px-4 py-3 text-[13px] text-mute">
          当前策略要求驳回提案时填写说明。
        </div>
      )}

      <AdminReviewQueue
        surface="page"
        rejectNoteRequired={rejectNoteRequired}
      />
    </div>
  );
}

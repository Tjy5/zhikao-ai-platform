import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { studyService } from '../../../services/studyService';
import { useAdminOperationPolicy } from '../../../hooks/useAdminOperationPolicy';
import {
  SECTION_LABELS,
  SECTION_META,
  SECTION_ORDER,
} from '../../study/baseline';

type CountPhase = 'loading' | 'ready' | 'error';

export default function AdminStudyPage() {
  const [countPhase, setCountPhase] = useState<CountPhase>('loading');
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const countReqIdRef = useRef(0);
  const { phase: policyPhase, policy, error: policyError, reload } =
    useAdminOperationPolicy();

  useEffect(() => {
    let cancelled = false;
    const reqId = ++countReqIdRef.current;
    studyService
      .getProposals({ limit: 1, offset: 0 })
      .then((response) => {
        if (cancelled || reqId !== countReqIdRef.current) return;
        setPendingCount(response.total);
        setCountPhase('ready');
      })
      .catch(() => {
        if (cancelled || reqId !== countReqIdRef.current) return;
        setPendingCount(null);
        setCountPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-[26px] md:text-[30px] font-semibold text-ink leading-tight">
          内容治理
        </h1>
        <p className="mt-2 text-[14px] text-mute leading-relaxed max-w-[72ch]">
          集中管理申论学习内容的待审提案、区段直改、版本时间线和回滚操作。后台写入仍由后端权限与运营策略强制校验。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-line bg-paper p-5 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold text-ink">审核队列</h2>
              <p className="mt-1 text-[13px] text-mute leading-relaxed">
                审核用户提交的内容修改提案。通过后即时发布；驳回按平台策略要求填写说明。
              </p>
            </div>
            <Link
              to="/admin/study/reviews"
              className="inline-flex h-10 items-center justify-center rounded-md bg-oxblood px-4 text-sm font-medium text-white transition-ui hover:bg-oxblood-ink"
            >
              查看队列
              {countPhase === 'ready' && pendingCount !== null
                ? `（${pendingCount}）`
                : ''}
            </Link>
          </div>
          {countPhase === 'loading' && (
            <div className="mt-4" aria-busy="true" aria-label="加载审核数量中">
              <Skeleton className="h-4 w-36" />
            </div>
          )}
          {countPhase === 'error' && (
            <p className="mt-4 text-[12px] text-mute">
              暂时无法读取待审数量；进入队列后可重试加载。
            </p>
          )}
        </div>

        <div className="rounded-lg border border-line bg-paper p-5">
          <h2 className="text-[16px] font-semibold text-ink">运营策略</h2>
          {policyPhase === 'loading' && (
            <div className="mt-4 space-y-2" aria-busy="true" aria-label="加载运营策略中">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )}
          {policyPhase === 'error' && (
            <div className="mt-3">
              <p className="text-[12.5px] text-mute leading-relaxed">
                {policyError || '无法读取运营策略'}。写入入口会在具体页面保持保守关闭。
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
                重试
              </Button>
            </div>
          )}
          {policyPhase === 'ready' && policy && (
            <dl className="mt-3 space-y-2 text-[12.5px]">
              <PolicyItem label="驳回说明" enabled={policy.reject_note_required} />
              <PolicyItem
                label="管理员直改"
                enabled={policy.admin_direct_publish_enabled}
              />
              <PolicyItem label="内容回滚" enabled={policy.content_revert_enabled} />
            </dl>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-paper p-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-ink">区段治理</h2>
            <p className="mt-1 text-[13px] text-mute leading-relaxed">
              进入任一区段查看当前线上内容、执行管理员直改，并检查完整版本时间线。
            </p>
          </div>
          <Link
            to="/app/study"
            className="text-[13px] text-mute hover:text-ink transition-ui"
          >
            查看用户学习页
          </Link>
        </div>

        <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
          {SECTION_ORDER.map((sectionKey) => (
            <Link
              key={sectionKey}
              to={`/admin/study/sections/${sectionKey}`}
              className="bg-paper p-4 hover:bg-panel/70 transition-ui"
            >
              <span className="text-[11px] font-semibold tracking-[0.02em] text-oxblood">
                {SECTION_META[sectionKey].eyebrow}
              </span>
              <span className="mt-1 block text-[14px] font-semibold text-ink">
                {SECTION_LABELS[sectionKey]}
              </span>
              <span className="mt-1 block text-[12.5px] text-mute leading-relaxed line-clamp-2">
                {SECTION_META[sectionKey].desc}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function PolicyItem({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-mute">{label}</dt>
      <dd className={enabled ? 'text-ok' : 'text-warn'}>
        {enabled ? '开启' : '关闭'}
      </dd>
    </div>
  );
}

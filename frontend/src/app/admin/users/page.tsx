import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import adminUserService from '../../../services/adminUserService';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Toast, type ToastType } from '../../../components/ui/Toast';
import { useAuth } from '../../../hooks/useAuth';
import { AppError, ErrorType } from '../../../types/domain';
import type {
  AdminUserListParams,
  AdminUserRole,
  AdminUserSummary,
} from '../../../types/api';

type Phase = 'loading' | 'error' | 'empty' | 'ready' | 'forbidden';

type RoleFilter = 'all' | AdminUserRole;
type ActiveFilter = 'all' | 'active' | 'inactive';

type PendingAction =
  | {
      kind: 'role';
      user: AdminUserSummary;
      role: AdminUserRole;
    }
  | {
      kind: 'active';
      user: AdminUserSummary;
      active: boolean;
    };

interface ToastState {
  show: boolean;
  message: string;
  type: ToastType;
}

const PAGE_SIZE = 10;

function friendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    if (error.type === ErrorType.AUTH) return error.message || '没有权限访问用户管理';
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function statusOf(error: unknown): number | null {
  if (!(error instanceof AppError)) return null;
  if (!error.details || typeof error.details !== 'object') return null;
  const status = (error.details as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}

function roleLabel(role: AdminUserRole): string {
  return role === 'admin' ? '管理员' : '普通用户';
}

function activeLabel(active: boolean): string {
  return active ? '启用' : '停用';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [phase, setPhase] = useState<Phase>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [page, setPage] = useState(0);
  const [error, setError] = useState<AppError | Error | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'info',
  });

  const params = useMemo<AdminUserListParams>(() => {
    return {
      q: query || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      active:
        activeFilter === 'all' ? undefined : activeFilter === 'active',
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
  }, [activeFilter, page, query, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const currentEnd = Math.min(total, page * PAGE_SIZE + users.length);
  const hasFilters = !!query || roleFilter !== 'all' || activeFilter !== 'all';

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
  }, []);

  const loadUsers = useCallback(() => {
    let cancelled = false;
    adminUserService
      .listUsers(params)
      .then((result) => {
        if (cancelled) return;
        setUsers(result.users);
        setTotal(result.total);
        setError(null);
        setPhase(result.total === 0 ? 'empty' : 'ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('加载用户列表失败'));
        setPhase(statusOf(err) === 403 ? 'forbidden' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => loadUsers(), [loadUsers, retryCount]);

  const refresh = useCallback(() => {
    setPhase('loading');
    setRetryCount((count) => count + 1);
  }, []);

  const applySearch = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      setPhase('loading');
      setPage(0);
      setQuery(searchInput.trim());
      setRetryCount((count) => count + 1);
    },
    [searchInput]
  );

  const resetFilters = useCallback(() => {
    setPhase('loading');
    setSearchInput('');
    setQuery('');
    setRoleFilter('all');
    setActiveFilter('all');
    setPage(0);
    setRetryCount((count) => count + 1);
  }, []);

  const updateUserInList = useCallback((updated: AdminUserSummary) => {
    setUsers((current) =>
      current.map((item) => (item.id === updated.id ? updated : item))
    );
  }, []);

  const confirmPendingAction = useCallback(async () => {
    if (!pendingAction) return;
    try {
      setIsMutating(true);
      const updated =
        pendingAction.kind === 'role'
          ? await adminUserService.updateRole(pendingAction.user.id, {
              role: pendingAction.role,
            })
          : await adminUserService.updateActive(pendingAction.user.id, {
              is_active: pendingAction.active,
            });
      updateUserInList(updated);
      setPendingAction(null);
      showToast(
        pendingAction.kind === 'role'
          ? `已将 ${updated.username} 调整为${roleLabel(updated.role)}`
          : `已${activeLabel(updated.is_active)} ${updated.username}`,
        'success'
      );
    } catch (err) {
      showToast(friendlyMessage(err, '更新用户失败'), 'error');
    } finally {
      setIsMutating(false);
    }
  }, [pendingAction, showToast, updateUserInList]);

  const isSelf = useCallback(
    (target: AdminUserSummary) => currentUser?.id === target.id,
    [currentUser?.id]
  );

  if (phase === 'loading') {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="加载用户管理中">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="rounded-lg border border-line bg-paper overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[1.4fr_1fr_1fr] gap-4 border-b border-line px-4 py-4 last:border-b-0"
            >
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'forbidden') {
    return (
      <div role="alert" className="rounded-lg border border-mark/30 bg-mark-soft/40 p-5">
        <h1 className="text-[18px] font-semibold text-ink">没有用户管理权限</h1>
        <p className="mt-2 text-[13px] text-mute leading-relaxed">
          当前账号不能访问后台用户管理。请使用管理员账号重新登录。
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div role="alert" className="rounded-lg border border-mark/30 bg-mark-soft/40 p-5">
        <h1 className="text-[18px] font-semibold text-ink">用户列表加载失败</h1>
        <p className="mt-2 text-[13px] text-mute leading-relaxed">
          {friendlyMessage(error, '无法读取用户列表，请稍后重试。')}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-[24px] md:text-[28px] font-semibold tracking-tight text-ink">
            用户管理
          </h1>
          <p className="mt-1 text-[13px] text-mute leading-relaxed max-w-[78ch]">
            搜索账号、筛选角色与状态，并处理管理员权限和账号启停。后端会阻止当前管理员停用自己或移除自己的管理员权限。
          </p>
        </div>
        <div
          className="rounded-lg border border-line bg-paper px-4 py-3"
          aria-live="polite"
        >
          <p className="text-[12px] text-mute">当前结果</p>
          <p className="mt-0.5 text-[18px] font-semibold text-ink">
            {total} <span className="text-[12px] font-normal text-mute">个用户</span>
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-line bg-paper p-4 md:p-5">
        <form
          onSubmit={applySearch}
          className="grid grid-cols-1 lg:grid-cols-[minmax(220px,1fr)_160px_160px_auto] gap-3"
        >
          <Input
            label="搜索用户名或邮箱"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="输入关键词"
          />
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1.5">角色</span>
            <select
              value={roleFilter}
              onChange={(event) => {
                setPhase('loading');
                setRoleFilter(event.target.value as RoleFilter);
                setPage(0);
              }}
              className="w-full h-11 rounded-md border border-line bg-paper px-3 text-sm text-ink transition-ui"
            >
              <option value="all">全部角色</option>
              <option value="admin">管理员</option>
              <option value="user">普通用户</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1.5">状态</span>
            <select
              value={activeFilter}
              onChange={(event) => {
                setPhase('loading');
                setActiveFilter(event.target.value as ActiveFilter);
                setPage(0);
              }}
              className="w-full h-11 rounded-md border border-line bg-paper px-3 text-sm text-ink transition-ui"
            >
              <option value="all">全部状态</option>
              <option value="active">已启用</option>
              <option value="inactive">已停用</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" className="flex-1 lg:flex-none">
              搜索
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={resetFilters}
              disabled={!hasFilters && !searchInput}
            >
              重置
            </Button>
          </div>
        </form>
      </section>

      {phase === 'empty' ? (
        <EmptyState
          title={hasFilters ? '没有匹配当前条件的用户' : '还没有可管理的用户'}
          description={
            hasFilters
              ? '调整关键词、角色或状态筛选后重新搜索。'
              : '新用户注册后会出现在这里，管理员可以再调整角色和账号状态。'
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                清除筛选
              </Button>
            ) : (
              <Button variant="outline" onClick={refresh}>
                重新加载
              </Button>
            )
          }
        />
      ) : (
        <section className="rounded-lg border border-line bg-paper overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-left">
              <thead className="bg-panel/60 border-b border-line">
                <tr>
                  <Th>用户</Th>
                  <Th>角色</Th>
                  <Th>状态</Th>
                  <Th>创建时间</Th>
                  <Th>更新时间</Th>
                  <Th className="text-right">操作</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((item) => {
                  const self = isSelf(item);
                  return (
                    <tr key={item.id} className="hover:bg-panel/35 transition-ui">
                      <td className="px-4 py-3.5 align-top">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[14px] font-medium text-ink break-all">
                              {item.username}
                            </p>
                            {self && (
                              <span className="rounded bg-mark-soft px-2 py-0.5 text-[11px] font-medium text-mark">
                                当前账号
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[12.5px] text-mute break-all">
                            {item.email}
                          </p>
                          <p className="mt-1 text-[11px] text-mute font-mono">
                            ID {item.id}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <select
                          value={item.role}
                          disabled={self}
                          onChange={(event) =>
                            setPendingAction({
                              kind: 'role',
                              user: item,
                              role: event.target.value as AdminUserRole,
                            })
                          }
                          title={self ? '不能移除自己的管理员权限' : '调整用户角色'}
                          className="h-9 rounded-md border border-line bg-paper px-2.5 text-[13px] text-ink disabled:opacity-55 disabled:cursor-not-allowed"
                        >
                          <option value="user">普通用户</option>
                          <option value="admin">管理员</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <span
                          className={[
                            'inline-flex rounded px-2 py-1 text-[12px] font-medium',
                            item.is_active
                              ? 'bg-ok/10 text-ok'
                              : 'bg-warn/10 text-warn',
                          ].join(' ')}
                        >
                          {activeLabel(item.is_active)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-top text-[12.5px] text-mute">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-4 py-3.5 align-top text-[12.5px] text-mute">
                        {formatDate(item.updated_at)}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant={item.is_active ? 'outline' : 'primary'}
                            disabled={self}
                            title={self ? '不能停用自己的账号' : undefined}
                            onClick={() =>
                              setPendingAction({
                                kind: 'active',
                                user: item,
                                active: !item.is_active,
                              })
                            }
                          >
                            {item.is_active ? '停用' : '启用'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line px-4 py-3">
            <p className="text-[12.5px] text-mute">
              显示 {currentStart}-{currentEnd} / {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => {
                  setPhase('loading');
                  setPage((current) => Math.max(0, current - 1));
                }}
              >
                上一页
              </Button>
              <span className="min-w-16 text-center text-[12.5px] text-mute">
                {page + 1} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page + 1 >= totalPages}
                onClick={() => {
                  setPhase('loading');
                  setPage((current) => Math.min(totalPages - 1, current + 1));
                }}
              >
                下一页
              </Button>
            </div>
          </div>
        </section>
      )}

      <ConfirmDialog
        isOpen={!!pendingAction}
        title={confirmTitle(pendingAction)}
        message={confirmMessage(pendingAction)}
        confirmText={confirmText(pendingAction)}
        cancelText="取消"
        variant={pendingAction?.kind === 'active' && !pendingAction.active ? 'danger' : 'warning'}
        onConfirm={confirmPendingAction}
        onCancel={() => {
          if (!isMutating) setPendingAction(null);
        }}
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

function Th({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={[
        'px-4 py-2.5 text-[12px] font-semibold text-mute',
        className,
      ].join(' ')}
    >
      {children}
    </th>
  );
}

function confirmTitle(action: PendingAction | null): string {
  if (!action) return '确认操作';
  if (action.kind === 'role') return '确认调整角色';
  return action.active ? '确认启用账号' : '确认停用账号';
}

function confirmText(action: PendingAction | null): string {
  if (!action) return '确认';
  if (action.kind === 'role') return '确认调整';
  return action.active ? '启用账号' : '停用账号';
}

function confirmMessage(action: PendingAction | null): string {
  if (!action) return '';
  if (action.kind === 'role') {
    return `将 ${action.user.username} 调整为${roleLabel(action.role)}。管理员可以访问后台管理能力，请确认这是预期授权。`;
  }
  if (action.active) {
    return `启用 ${action.user.username} 后，该用户可重新登录并使用平台。`;
  }
  return `停用 ${action.user.username} 后，该用户将不能继续通过当前账号访问平台。`;
}

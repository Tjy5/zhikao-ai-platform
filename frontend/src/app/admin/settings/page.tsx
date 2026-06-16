import { useCallback, useEffect, useMemo, useState } from 'react';
import settingsService from '../../../services/settingsService';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Toast, type ToastType } from '../../../components/ui/Toast';
import { AppError, ErrorType } from '../../../types/domain';
import type {
  AdminSettingsResponse,
  AdminSettingsUpdate,
  OperationPolicySettings,
  ProviderModelsResponse,
  WritingAISettingsUpdate,
} from '../../../types/api';

type Phase = 'loading' | 'error' | 'empty' | 'ready';

interface ToastState {
  show: boolean;
  message: string;
  type: ToastType;
}

interface FormState {
  provider_name: string;
  base_url: string;
  model_name: string;
  api_key: string;
  json_fallback_enabled: boolean;
  operation_policy: OperationPolicySettings;
}

const DEFAULT_POLICY: OperationPolicySettings = {
  public_registration_enabled: true,
  content_proposals_enabled: true,
  reject_note_required: false,
  admin_direct_publish_enabled: true,
  content_revert_enabled: true,
};

const EMPTY_FORM: FormState = {
  provider_name: '',
  base_url: '',
  model_name: '',
  api_key: '',
  json_fallback_enabled: true,
  operation_policy: DEFAULT_POLICY,
};

const POLICY_ITEMS: Array<{
  key: keyof OperationPolicySettings;
  label: string;
  onText: string;
  offText: string;
  impact: string;
}> = [
  {
    key: 'public_registration_enabled',
    label: '公开注册',
    onText: '允许新用户注册',
    offText: '阻止新用户注册',
    impact: '关闭后 `/api/v1/auth/register` 会拒绝新账号；现有用户登录不受影响。',
  },
  {
    key: 'content_proposals_enabled',
    label: '学习内容提案',
    onText: '允许学员提交修改建议',
    offText: '阻止新的修改建议',
    impact: '关闭后后端会拒绝 stale 客户端继续提交 `/study/sections/{key}/propose`。',
  },
  {
    key: 'reject_note_required',
    label: '驳回说明',
    onText: '驳回必须填写说明',
    offText: '驳回说明可留空',
    impact: '开启后管理员驳回提案时，空白 `review_note` 会被后端拒绝。',
  },
  {
    key: 'admin_direct_publish_enabled',
    label: '管理员直改发布',
    onText: '允许管理员直接发布',
    offText: '阻止管理员直接发布',
    impact: '关闭后管理员不能绕过提案流直接编辑并发布学习内容。',
  },
  {
    key: 'content_revert_enabled',
    label: '内容回滚',
    onText: '允许回滚到历史版本',
    offText: '阻止内容回滚',
    impact: '关闭后 `/study/sections/{key}/revert` 会被后端拒绝，历史仍可查看。',
  },
];

function friendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    if (error.type === ErrorType.AUTH) return error.message || '没有权限访问系统设置';
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function toForm(settings: AdminSettingsResponse): FormState {
  return {
    provider_name: settings.writing_ai.provider_name ?? '',
    base_url: settings.writing_ai.base_url ?? '',
    model_name: settings.writing_ai.model_name ?? '',
    api_key: '',
    json_fallback_enabled: settings.writing_ai.json_fallback_enabled,
    operation_policy: settings.operation_policy,
  };
}

export default function AdminSettingsPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [settings, setSettings] = useState<AdminSettingsResponse | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<
    Partial<Record<keyof WritingAISettingsUpdate, string>>
  >({});
  const [error, setError] = useState<AppError | Error | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discovery, setDiscovery] = useState<ProviderModelsResponse | null>(
    null
  );
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'info',
  });

  const hasKey = !!settings?.writing_ai.has_api_key;
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
  }, []);

  useEffect(() => {
    let cancelled = false;
    settingsService
      .getAdminSettings()
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setSettings(null);
          setPhase('empty');
          return;
        }
        setSettings(result);
        setForm(toForm(result));
        setError(null);
        setPhase('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('加载系统设置失败'));
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const validate = useCallback((data: FormState): boolean => {
    const next: Partial<Record<keyof WritingAISettingsUpdate, string>> = {};
    if (!data.provider_name.trim()) next.provider_name = '请填写提供商名称';
    if (!data.base_url.trim()) {
      next.base_url = 'Base URL 不能为空';
    } else {
      try {
        const url = new URL(data.base_url);
        if (!/^https?:$/.test(url.protocol)) {
          next.base_url = 'Base URL 必须以 http:// 或 https:// 开头';
        }
      } catch {
        next.base_url = '请输入有效 URL，例如 https://api.openai.com/v1';
      }
    }
    if (!data.model_name.trim()) next.model_name = '模型名称不能为空';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, []);

  const payload = useMemo<AdminSettingsUpdate>(() => {
    return {
      writing_ai: {
        provider_name: form.provider_name.trim(),
        base_url: form.base_url.trim(),
        model_name: form.model_name.trim(),
        ...(form.api_key.trim() ? { api_key: form.api_key.trim() } : {}),
        json_fallback_enabled: form.json_fallback_enabled,
      },
      operation_policy: form.operation_policy,
    };
  }, [form]);

  const handleSave = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!validate(form)) {
        showToast('请先修正表单中的错误', 'error');
        return;
      }
      try {
        setIsSaving(true);
        const updated = await settingsService.updateAdminSettings(payload);
        setSettings(updated);
        setForm(toForm(updated));
        setDiscovery(null);
        showToast('系统设置已保存', 'success');
      } catch (err) {
        showToast(friendlyMessage(err, '保存系统设置失败'), 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [form, payload, showToast, validate]
  );

  const handleTest = useCallback(async () => {
    try {
      setIsTesting(true);
      const result = await settingsService.testAdminConnection();
      if (result.status === 'succeeded') {
        showToast('全局写作 AI 连接成功', 'success');
      } else {
        showToast(
          result.last_failure_classification
            ? `连接失败：${result.last_failure_classification}`
            : result.message || '连接失败',
          'error'
        );
      }
    } catch (err) {
      showToast(friendlyMessage(err, '测试连接失败'), 'error');
    } finally {
      setIsTesting(false);
    }
  }, [showToast]);

  const handleDiscover = useCallback(async () => {
    try {
      setIsDiscovering(true);
      const result = await settingsService.discoverAdminModels(
        form.api_key.trim() || form.base_url.trim()
          ? {
              base_url: form.base_url.trim() || undefined,
              api_key: form.api_key.trim() || undefined,
            }
          : undefined
      );
      setDiscovery(result);
      if (result.status === 'succeeded') {
        showToast(`发现 ${result.model_count} 个模型`, 'success');
      } else if (result.status === 'unavailable') {
        showToast('请先配置并保存全局 API Key', 'warning');
      } else {
        showToast(
          result.last_failure_classification
            ? `发现失败：${result.last_failure_classification}`
            : '发现模型失败',
          'error'
        );
      }
    } catch (err) {
      showToast(friendlyMessage(err, '发现模型失败'), 'error');
    } finally {
      setIsDiscovering(false);
    }
  }, [form.api_key, form.base_url, showToast]);

  const updatePolicy = useCallback(
    (key: keyof OperationPolicySettings, value: boolean) => {
      setForm((prev) => ({
        ...prev,
        operation_policy: {
          ...prev.operation_policy,
          [key]: value,
        },
      }));
    },
    []
  );

  if (phase === 'loading') {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="加载系统设置中">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div role="alert" className="rounded-lg border border-mark/30 bg-mark-soft/40 p-5">
        <h1 className="text-[18px] font-semibold text-ink">系统设置加载失败</h1>
        <p className="mt-2 text-[13px] text-mute leading-relaxed">
          {friendlyMessage(error, '无法读取系统设置，请稍后重试。')}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            setPhase('loading');
            setRetryCount((count) => count + 1);
          }}
        >
          重试
        </Button>
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <EmptyState
        title="系统设置尚未初始化"
        description="后端没有返回平台设置记录，请重新初始化默认配置。"
        action={
          <Button
            onClick={() => {
              setPhase('loading');
              setRetryCount((count) => count + 1);
            }}
          >
            重新加载
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] md:text-[28px] font-semibold tracking-tight text-ink">
          系统设置
        </h1>
        <p className="mt-1 text-[13px] text-mute leading-relaxed max-w-[78ch]">
          维护全局写作 AI 默认配置和平台运营策略。个人 AI 配置仍独立保存；用户有个人配置时优先使用个人配置，没有个人配置时继承这里的全局默认值。
        </p>
      </div>

      {settings && (
        <section className="rounded-lg border border-line bg-paper p-5">
          <h2 className="text-[15px] font-semibold text-ink">当前全局 AI 状态</h2>
          <dl className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatusItem label="提供商" value={settings.writing_ai.provider_name} />
            <StatusItem label="模型" value={settings.writing_ai.model_name} />
            <StatusItem
              label="API Key"
              value={
                hasKey
                  ? `已配置${settings.writing_ai.api_key_hint ? ` ${settings.writing_ai.api_key_hint}` : ''}`
                  : '未配置'
              }
            />
            <StatusItem
              label="上次测试"
              value={
                settings.writing_ai.last_test_status === 'succeeded'
                  ? '成功'
                  : settings.writing_ai.last_test_status === 'failed'
                    ? `失败 ${settings.writing_ai.last_failure_classification ?? ''}`.trim()
                    : '尚未测试'
              }
            />
            <div className="md:col-span-4">
              <dt className="text-[12px] text-mute">Base URL</dt>
              <dd className="mt-0.5 text-[13px] text-ink font-mono break-all">
                {settings.writing_ai.base_url}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="rounded-lg border border-line bg-paper p-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">全局写作 AI 默认值</h2>
              <p className="mt-1 text-[12.5px] text-mute leading-relaxed max-w-[68ch]">
                这些值会作为未配置个人 AI 的用户默认 provider。API Key 加密保存，接口只返回脱敏提示；密钥输入框留空会保留现有密钥。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscover}
                isLoading={isDiscovering}
              >
                发现模型
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTest}
                isLoading={isTesting}
                disabled={!hasKey}
                title={!hasKey ? '请先配置并保存全局 API Key' : '测试已保存的全局配置'}
              >
                测试连接
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="提供商名称"
              value={form.provider_name}
              placeholder="openai-compatible"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, provider_name: event.target.value }))
              }
              error={errors.provider_name}
              required
            />
            <Input
              label="模型名称"
              value={form.model_name}
              placeholder="gpt-4o-mini"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, model_name: event.target.value }))
              }
              error={errors.model_name}
              required
            />
            <div className="md:col-span-2">
              <Input
                label="Base URL"
                type="url"
                value={form.base_url}
                placeholder="https://api.openai.com/v1"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, base_url: event.target.value }))
                }
                helperText="OpenAI 兼容服务的 API 基础地址。"
                error={errors.base_url}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label="全局 API Key"
                type={showApiKey ? 'text' : 'password'}
                value={form.api_key}
                placeholder={hasKey ? '留空表示保持现有密钥不变' : '输入全局 API Key'}
                autoComplete="off"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, api_key: event.target.value }))
                }
                helperText={
                  hasKey
                    ? '留空会保留当前加密密钥；输入新值会覆盖全局密钥。'
                    : '未配置个人密钥的用户会使用这个全局密钥发起写作批改。'
                }
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowApiKey((value) => !value)}
                    className="grid place-items-center w-8 h-8 rounded text-mute hover:text-ink transition-ui"
                    aria-label={showApiKey ? '隐藏密钥' : '显示密钥'}
                  >
                    {showApiKey ? '藏' : '看'}
                  </button>
                }
              />
            </div>
          </div>

          <label
            htmlFor="admin-json-fallback"
            className="mt-4 flex items-start gap-2.5 cursor-pointer select-none"
          >
            <input
              id="admin-json-fallback"
              type="checkbox"
              checked={form.json_fallback_enabled}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  json_fallback_enabled: event.target.checked,
                }))
              }
              className="mt-0.5 w-4 h-4 rounded border-line text-mark focus:ring-mark cursor-pointer accent-mark"
            />
            <span className="text-[13.5px] text-ink leading-relaxed">
              启用 JSON 降级模式
              <span className="block text-[12px] text-mute mt-0.5">
                当 provider 的 JSON 模式不稳定时，后端可回退到原始 Markdown 批改输出。
              </span>
            </span>
          </label>

          <DiscoveryPanel
            discovery={discovery}
            isDiscovering={isDiscovering}
            onSelect={(modelId) => {
              setForm((prev) => ({ ...prev, model_name: modelId }));
              showToast(`已填入模型：${modelId}`, 'info');
            }}
          />
        </section>

        <section className="rounded-lg border border-line bg-paper p-5">
          <h2 className="text-[15px] font-semibold text-ink">平台运营策略</h2>
          <p className="mt-1 text-[12.5px] text-mute leading-relaxed max-w-[78ch]">
            这些开关由后端强制执行。即使旧页面或 stale 客户端仍显示入口，对应 API 也会按策略拒绝写入。
          </p>

          <div className="mt-5 divide-y divide-line">
            {POLICY_ITEMS.map((item) => {
              const checked = form.operation_policy[item.key];
              return (
                <div
                  key={item.key}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center gap-3 md:gap-5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-ink">
                        {item.label}
                      </h3>
                      <span
                        className={[
                          'inline-flex rounded px-2 py-0.5 text-[11px] font-medium',
                          checked ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn',
                        ].join(' ')}
                      >
                        {checked ? item.onText : item.offText}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-mute leading-relaxed">
                      {item.impact}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={checked}
                    onChange={(next) => updatePolicy(item.key, next)}
                    ariaLabel={`${item.label}开关`}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" isLoading={isSaving}>
            保存系统设置
          </Button>
          <p className="text-[12px] text-mute">
            保存后，新策略立即在后端写路径生效。
          </p>
        </div>
      </form>

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

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-mute">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-ink font-mono break-all">
        {value || '未配置'}
      </dd>
    </div>
  );
}

function DiscoveryPanel({
  discovery,
  isDiscovering,
  onSelect,
}: {
  discovery: ProviderModelsResponse | null;
  isDiscovering: boolean;
  onSelect: (modelId: string) => void;
}) {
  if (isDiscovering) {
    return (
      <div className="mt-4 rounded-md border border-line bg-panel/50 px-3 py-2 text-[12.5px] text-mute">
        正在发现模型...
      </div>
    );
  }
  if (!discovery) return null;
  if (discovery.status === 'unavailable') {
    return (
      <div className="mt-4 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-[12.5px] text-ink">
        全局 API Key 未配置，无法发现模型。
      </div>
    );
  }
  if (discovery.status === 'failed') {
    return (
      <div className="mt-4 rounded-md border border-mark/30 bg-mark-soft/40 px-3 py-2">
        <p className="text-[12.5px] text-ink">
          发现模型失败
          {discovery.last_failure_classification
            ? `：${discovery.last_failure_classification}`
            : ''}
        </p>
        {discovery.message && (
          <p className="mt-1 text-[12px] text-mute">{discovery.message}</p>
        )}
      </div>
    );
  }
  if (discovery.model_count === 0) {
    return (
      <div className="mt-4 rounded-md border border-line bg-panel/50 px-3 py-2 text-[12.5px] text-mute">
        未发现可用模型。
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-md border border-line bg-panel/30 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-line text-[11px] font-mono text-mute">
        发现 {discovery.model_count} 个模型，点击填入模型名称
      </div>
      <ul className="max-h-[220px] overflow-y-auto divide-y divide-line">
        {discovery.models.map((model) => (
          <li key={model.id}>
            <button
              type="button"
              onClick={() => onSelect(model.id)}
              className="w-full text-left px-3 py-2 hover:bg-panel transition-ui"
            >
              <span className="block text-[13px] font-mono text-ink break-all">
                {model.id}
              </span>
              {model.owned_by && (
                <span className="mt-0.5 block text-[11px] text-mute">
                  提供者：{model.owned_by}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={[
        'shrink-0 w-11 h-6 rounded-full transition-ui relative cursor-pointer',
        checked ? 'bg-ok' : 'bg-line',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-paper border border-line shadow-sm transition-ui',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
        aria-hidden="true"
      />
    </button>
  );
}

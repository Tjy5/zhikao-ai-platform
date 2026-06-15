import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Toast, type ToastType } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  getStructuredScoringPref,
  setStructuredScoringPref,
} from '../../utils/structuredScoringPref';
import { AppError, ErrorType } from '../../types/domain';
import type {
  WritingAISettingsUpdate,
  ProviderModelsResponse,
} from '../../types/api';

/**
 * /app/settings — SettingsConsole. design.md §10.10.
 *
 * Composes four regions:
 *  1. Current-configuration status (masked API key + last-test outcome).
 *  2. Configuration form (provider / base_url / model / api_key / json_fallback).
 *  3. Model discovery (3 states: no key / success list / classified failure).
 *  4. Opt-in "结构化评分输出" toggle (client-side persisted; grading effect
 *     DORMANT until the backend supports structured JSON — see
 *     utils/structuredScoringPref.ts).
 *
 * State strategy:
 *  - Canonical settings come from SettingsContext (5-min TTL cache, shared with
 *    CommandBar + dashboard so save/test instantly propagate everywhere).
 *  - The form holds LOCAL field state. It is populated ONCE from the cached
 *    settings on first arrival; it is re-populated after a successful save
 *    (which is an explicit user action — clobbering the api_key field to empty
 *    is the desired "leave blank to keep existing key" reset). Test does NOT
 *    re-populate the form (test runs against the SAVED config; the user may
 *    have unsaved edits they intend to save next).
 *
 * Backend status values are the source of truth (SettingsService.java):
 *  - ProviderModelsResponse.status: "unavailable" | "succeeded" | "failed"
 *  - ProviderTestResponse.status:    "unavailable" | "succeeded" | "failed"
 *  - last_test_status:               "succeeded" | "failed" | null
 * (NB: the backend uses "succeeded", NOT "success".)
 */

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
}

const EMPTY_FORM: FormState = {
  provider_name: '',
  base_url: '',
  model_name: '',
  api_key: '',
  json_fallback_enabled: false,
};

function friendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    if (error.type === ErrorType.AUTH) return '登录已过期，请重新登录';
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const {
    settings,
    isLoading,
    error: settingsError,
    ensureSettings,
    updateSettings,
    testConnection,
    discoverModels,
  } = useSettings();

  // ----- Form state -----
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<
    Partial<Record<keyof WritingAISettingsUpdate, string>>
  >({});
  const populatedRef = useRef(false);

  // ----- UI state -----
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discovery, setDiscovery] = useState<ProviderModelsResponse | null>(
    null
  );
  const [structuredOn, setStructuredOn] = useState<boolean>(
    // Lazy initializer: read the persisted pref once on mount (sanctioned
    // one-time read, no effect needed).
    () => getStructuredScoringPref()
  );
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'info',
  });

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
  }, []);

  // ----- Load settings (lazy via context; 5-min TTL). -----
  useEffect(() => {
    ensureSettings();
  }, [ensureSettings]);

  // ----- Populate the form from cached settings ONCE on first arrival. -----
  useEffect(() => {
    if (!settings || populatedRef.current) return;
    populatedRef.current = true;
    setForm({
      provider_name: settings.provider_name ?? '',
      base_url: settings.base_url ?? '',
      model_name: settings.model_name ?? '',
      api_key: '', // Never pre-fill the key.
      json_fallback_enabled: settings.json_fallback_enabled,
    });
  }, [settings]);

  // ----- Validation -----
  const validate = useCallback((data: FormState): boolean => {
    const next: Partial<Record<keyof WritingAISettingsUpdate, string>> = {};
    if (!data.provider_name.trim())
      next.provider_name = '请填写提供商名称（例如 openai-compatible）';
    if (!data.base_url.trim()) {
      next.base_url = 'Base URL 不能为空';
    } else {
      try {
        const url = new URL(data.base_url);
        if (!/^https?:$/.test(url.protocol)) {
          next.base_url = 'Base URL 必须以 http:// 或 https:// 开头';
        }
      } catch {
        next.base_url = '请输入有效的 URL，例如 https://api.openai.com/v1';
      }
    }
    if (!data.model_name.trim()) next.model_name = '模型名称不能为空';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, []);

  // ----- Save (PUT). Re-populates the form from the returned settings. -----
  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate(form)) {
        showToast('请先修正表单中的错误', 'error');
        return;
      }
      try {
        setIsSaving(true);
        const payload: WritingAISettingsUpdate = {
          provider_name: form.provider_name.trim(),
          base_url: form.base_url.trim(),
          model_name: form.model_name.trim(),
          // Only send api_key when the user typed a new one. Empty = keep old.
          ...(form.api_key.trim()
            ? { api_key: form.api_key.trim() }
            : {}),
          json_fallback_enabled: form.json_fallback_enabled,
        };
        const updated = await updateSettings(payload);
        // Re-populate from the authoritative response: clears the api_key field
        // and reflects the saved json_fallback flag exactly.
        setForm({
          provider_name: updated.provider_name ?? '',
          base_url: updated.base_url ?? '',
          model_name: updated.model_name ?? '',
          api_key: '',
          json_fallback_enabled: updated.json_fallback_enabled,
        });
        showToast('配置已保存', 'success');
      } catch (error) {
        showToast(friendlyMessage(error, '保存配置失败'), 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [form, validate, updateSettings, showToast]
  );

  // ----- Test connection (POST /test). Tests the SAVED config; does not
  // touch the form so unsaved edits survive. -----
  const handleTest = useCallback(async () => {
    try {
      setIsTesting(true);
      const result = await testConnection();
      if (result.status === 'succeeded') {
        showToast(
          result.last_successful_mode
            ? `连接成功（${result.last_successful_mode}）`
            : '连接成功',
          'success'
        );
      } else {
        const classification = result.last_failure_classification || '';
        showToast(
          classification
            ? `连接失败：${classification}`
            : '连接失败，请检查配置',
          'error'
        );
      }
    } catch (error) {
      showToast(friendlyMessage(error, '测试连接失败'), 'error');
    } finally {
      setIsTesting(false);
    }
  }, [testConnection, showToast]);

  // ----- Model discovery (POST /models). Three states. -----
  const handleDiscover = useCallback(async () => {
    try {
      setIsDiscovering(true);
      // If the user typed a new key + base_url in the form, use those so they
      // can discover BEFORE saving. Otherwise fall back to the saved config.
      const payload =
        form.api_key.trim() || form.base_url.trim()
          ? {
              base_url: form.base_url.trim() || undefined,
              api_key: form.api_key.trim() || undefined,
            }
          : undefined;
      const result = await discoverModels(payload);
      setDiscovery(result);
      if (result.status === 'succeeded') {
        if (result.model_count === 0) {
          showToast('未发现可用模型', 'info');
        } else {
          showToast(`发现 ${result.model_count} 个模型`, 'success');
        }
      } else if (result.status === 'unavailable') {
        showToast('请先配置 API Key 并保存', 'warning');
      } else {
        // failed — classification shown inline; also toast.
        showToast(
          result.last_failure_classification
            ? `发现失败：${result.last_failure_classification}`
            : '发现模型失败',
          'error'
        );
      }
    } catch (error) {
      showToast(friendlyMessage(error, '发现模型失败'), 'error');
    } finally {
      setIsDiscovering(false);
    }
  }, [form.api_key, form.base_url, discoverModels, showToast]);

  const selectDiscoveredModel = useCallback(
    (modelId: string) => {
      setForm((prev) => ({ ...prev, model_name: modelId }));
      showToast(`已填入模型：${modelId}`, 'info');
    },
    [showToast]
  );

  // ----- Structured-scoring toggle (client-side; dormant grading effect). -----
  const handleToggleStructured = useCallback((enabled: boolean) => {
    setStructuredOn(enabled);
    setStructuredScoringPref(enabled);
    // No API call: the effect on grading is dormant until the backend supports
    // structured JSON output (see utils/structuredScoringPref.ts).
  }, []);

  // ----- Render helpers -----
  const hasKey = !!settings?.has_api_key;
  const apiKeyPlaceholder = hasKey
    ? '留空表示保持现有密钥不变'
    : '输入 OpenAI 兼容服务的 API Key';

  // Initial load (no cached settings yet).
  if (isLoading && !settings) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="加载 AI 配置中">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }

  // Load error with no cached data.
  if (settingsError && !settings) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-mark/30 bg-mark-soft/40 p-5"
      >
        <p className="text-[14px] text-mark leading-relaxed">
          {friendlyMessage(settingsError, '加载 AI 配置失败')}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => ensureSettings()}
        >
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[24px] md:text-[28px] font-semibold tracking-tight text-ink">
          AI 配置
        </h1>
        <p className="text-[13px] text-mute mt-1 leading-relaxed">
          配置写作批改使用的 OpenAI 兼容服务。密钥加密存储，仅返回脱敏提示。
        </p>
      </div>

      {/* ===== Current configuration status ===== */}
      {settings && (
        <section className="rounded-lg border border-line bg-paper p-5">
          <h2 className="text-[15px] font-semibold text-ink mb-4">
            当前配置状态
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-[12px] text-mute">提供商</dt>
              <dd className="text-[14px] text-ink font-medium font-mono break-all mt-0.5">
                {settings.provider_name || '未配置'}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-mute">模型</dt>
              <dd className="text-[14px] text-ink font-medium font-mono break-all mt-0.5">
                {settings.model_name || '未配置'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[12px] text-mute">Base URL</dt>
              <dd className="text-[13px] text-ink font-mono break-all mt-0.5">
                {settings.base_url || '未配置'}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-mute">API Key</dt>
              <dd className="mt-0.5">
                {hasKey ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-ok/10 text-ok">
                      已配置
                    </span>
                    {settings.api_key_hint && (
                      <span className="text-[12px] text-mute font-mono">
                        {settings.api_key_hint}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-warn/10 text-warn">
                    未配置
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-mute">JSON 降级</dt>
              <dd className="text-[13px] text-ink mt-0.5">
                {settings.json_fallback_enabled ? '已启用' : '未启用'}
              </dd>
            </div>
          </dl>

          {/* Last test outcome */}
          <div className="mt-4 pt-4 border-t border-line">
            <dt className="text-[12px] text-mute">上次连接测试</dt>
            <dd className="mt-1">
              {settings.last_tested_at ? (
                <span className="inline-flex items-center gap-2 flex-wrap">
                  {settings.last_test_status === 'succeeded' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-ok/10 text-ok">
                      成功
                    </span>
                  ) : settings.last_test_status === 'failed' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-mark/10 text-mark">
                      失败
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-panel text-mute">
                      {settings.last_test_status || '未知'}
                    </span>
                  )}
                  {settings.last_successful_mode && (
                    <span className="text-[12px] text-mute font-mono">
                      {settings.last_successful_mode}
                    </span>
                  )}
                  {settings.last_failure_classification && (
                    <span className="text-[12px] text-mark">
                      {settings.last_failure_classification}
                    </span>
                  )}
                  <span className="text-[12px] text-mute">
                    {new Date(settings.last_tested_at).toLocaleString('zh-CN')}
                  </span>
                </span>
              ) : (
                <span className="text-[12px] text-mute">尚未测试</span>
              )}
            </dd>
          </div>
        </section>
      )}

      {/* ===== Configuration form ===== */}
      <form
        onSubmit={handleSave}
        className="rounded-lg border border-line bg-paper p-5"
      >
        <h2 className="text-[15px] font-semibold text-ink mb-5">更新配置</h2>

        <div className="space-y-4">
          <Input
            label="提供商名称"
            placeholder="例如：openai-compatible、deepseek"
            value={form.provider_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, provider_name: e.target.value }))
            }
            error={errors.provider_name}
            required
          />

          <Input
            label="Base URL"
            type="url"
            placeholder="https://api.openai.com/v1"
            value={form.base_url}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, base_url: e.target.value }))
            }
            error={errors.base_url}
            helperText="OpenAI 兼容服务的 API 基础地址。"
            required
          />

          <div>
            <Input
              label="模型名称"
              placeholder="例如：gpt-4o-mini、deepseek-chat"
              value={form.model_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, model_name: e.target.value }))
              }
              error={errors.model_name}
              required
            />
            {/* Discovery panel (inline, 3 states). */}
            <DiscoveryPanel
              discovery={discovery}
              isDiscovering={isDiscovering}
              onSelect={selectDiscoveredModel}
            />
          </div>

          <Input
            label="API Key"
            type={showApiKey ? 'text' : 'password'}
            placeholder={apiKeyPlaceholder}
            value={form.api_key}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, api_key: e.target.value }))
            }
            helperText={
              hasKey
                ? '留空表示保持现有密钥不变；输入新值会覆盖。'
                : '用于访问 AI 服务的密钥，加密存储。'
            }
            autoComplete="off"
            trailing={
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="grid place-items-center w-8 h-8 rounded text-faint hover:text-ink transition-ui"
                aria-label={showApiKey ? '隐藏密钥' : '显示密钥'}
              >
                {showApiKey ? (
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            }
          />

          {/* json_fallback checkbox */}
          <label
            htmlFor="json-fallback"
            className="flex items-start gap-2.5 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              id="json-fallback"
              checked={form.json_fallback_enabled}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  json_fallback_enabled: e.target.checked,
                }))
              }
              className="mt-0.5 w-4 h-4 rounded border-line text-mark focus:ring-mark cursor-pointer accent-mark"
            />
            <span className="text-[13.5px] text-ink leading-relaxed">
              启用 JSON 降级模式
              <span className="block text-[12px] text-mute mt-0.5">
                部分 OpenAI 兼容服务对 JSON 模式支持不稳；启用后 provider 会回退到更稳的输出方式。
              </span>
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="submit" isLoading={isSaving}>
            保存配置
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            isLoading={isTesting}
            disabled={!hasKey}
            title={
              !hasKey ? '请先配置并保存 API Key' : '测试已保存的配置'
            }
          >
            测试连接
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleDiscover}
            isLoading={isDiscovering}
          >
            发现模型
          </Button>
        </div>

        <p className="mt-3 text-[12px] text-mute leading-relaxed">
          「测试连接」与「发现模型」基于<b className="text-mute">已保存</b>的配置运行；如刚修改了表单，请先「保存配置」。
        </p>
      </form>

      {/* ===== Opt-in structured-scoring toggle (dormant) ===== */}
      <section className="rounded-lg border border-line bg-paper p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-semibold text-ink">
              结构化评分输出
              <span className="ml-2 text-[11px] font-mono text-mute align-middle">
                实验性
              </span>
            </h2>
            <p className="text-[12.5px] text-mute mt-1 leading-relaxed">
              开启后，当后端支持结构化 JSON 输出时，批阅将附带维度雷达与逐条摘录批注。当前后端仅返回 Markdown 报告，<b className="text-ink">开启不影响批改结果</b>；未开启、或 provider JSON 不稳定自动回退时，仍显示默认 5 段报告。
            </p>
          </div>
          <ToggleSwitch
            checked={structuredOn}
            onChange={handleToggleStructured}
            ariaLabel="结构化评分输出开关"
          />
        </div>
      </section>

      {/* Unconfigured nudge: when no key, link writing still works but grading won't. */}
      {!hasKey && (
        <div className="rounded-lg border border-warn/30 bg-warn/10 p-4">
          <p className="text-[13px] text-ink leading-relaxed">
            尚未配置 API Key，写作台仍可使用，但提交批改会返回「AI 未配置」。配置并测试通过后即可开始批改。
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => navigate('/app/writing')}
          >
            先去写作台
          </Button>
        </div>
      )}

      {/* Toast */}
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

/**
 * DiscoveryPanel — inline render of the model-discovery result. Three states:
 *  - unavailable: no API key → prompt to configure first.
 *  - succeeded: list of models, click to fill the model field.
 *  - failed: classification + provider message.
 */
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
      <div
        className="mt-2 rounded-md border border-line bg-panel/50 px-3 py-2 text-[12.5px] text-mute"
        aria-live="polite"
      >
        正在发现模型…
      </div>
    );
  }
  if (!discovery) return null;

  if (discovery.status === 'unavailable') {
    return (
      <div className="mt-2 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-[12.5px] text-ink leading-relaxed">
        未配置 API Key，无法发现模型。请先填写并保存 API Key。
      </div>
    );
  }

  if (discovery.status === 'failed') {
    return (
      <div className="mt-2 rounded-md border border-mark/30 bg-mark-soft/40 px-3 py-2 text-[12.5px]">
        <p className="text-ink leading-relaxed">
          发现模型失败{discovery.last_failure_classification ? `：${discovery.last_failure_classification}` : ''}
        </p>
        {discovery.message && (
          <p className="text-mute mt-0.5">{discovery.message}</p>
        )}
      </div>
    );
  }

  // succeeded
  if (discovery.model_count === 0) {
    return (
      <div className="mt-2 rounded-md border border-line bg-panel/50 px-3 py-2 text-[12.5px] text-mute">
        未发现可用模型。
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-line bg-panel/30 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-line text-[11px] font-mono text-mute">
        发现 {discovery.model_count} 个模型 · 点击填入
      </div>
      <ul className="max-h-[220px] overflow-y-auto divide-y divide-line">
        {discovery.models.map((model) => (
          <li key={model.id}>
            <button
              type="button"
              onClick={() => onSelect(model.id)}
              className="w-full text-left px-3 py-2 hover:bg-panel transition-ui"
            >
              <div className="text-[13px] font-mono text-ink">{model.id}</div>
              {model.owned_by && (
                <div className="text-[11px] text-mute mt-0.5">
                  提供者：{model.owned_by}
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ToggleSwitch — accessible on/off switch (role=switch). design.md §10 (inputs):
 * focus ring via the global :focus-visible rule. Used for the dormant
 * structured-scoring opt-in.
 */
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
        'shrink-0 mt-1 w-11 h-6 rounded-full transition-ui relative cursor-pointer',
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

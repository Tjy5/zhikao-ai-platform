import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  KeyRound,
  Loader2,
  LogOut,
  PlugZap,
  Save,
  Search,
} from 'lucide-react';

import { useAuth } from '../../auth/AuthContext';
import InkWashShell from '../../components/InkWashShell';
import { settingsApi } from '../../utils/apiClient';
import type {
  WritingAIModelDiscoveryRequest,
  WritingAISettings,
  WritingAISettingsUpdate,
  ProviderModelInfo,
  ProviderTestResponse,
} from '../../types/settings';

const emptyForm = {
  base_url: 'https://api.openai.com/v1',
  model_name: 'gpt-4o-mini',
  json_fallback_enabled: true,
};

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<WritingAISettings | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<ProviderModelInfo[]>(
    []
  );
  const [testResult, setTestResult] = useState<ProviderTestResponse | null>(
    null
  );

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.get();
      setSettings(data);
      setForm({
        base_url: data.base_url,
        model_name: data.model_name,
        json_fallback_enabled: data.json_fallback_enabled,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    setDiscoveredModels([]);
    setDiscoveryMessage(null);
  }, [form.base_url, apiKey]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload: WritingAISettingsUpdate = {
        provider_name: 'openai-compatible',
        base_url: form.base_url,
        model_name: form.model_name,
        json_fallback_enabled: form.json_fallback_enabled,
      };
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }
      const data = await settingsApi.save(payload);
      setSettings(data);
      setApiKey('');
      setMessage('设置已保存');
    } catch {
      setMessage('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const result = await settingsApi.test();
      setTestResult(result);
      await loadSettings();
    } catch {
      setMessage('测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleDiscoverModels = async () => {
    setDiscovering(true);
    setMessage(null);
    setDiscoveryMessage(null);
    try {
      const payload: WritingAIModelDiscoveryRequest = {
        base_url: form.base_url,
      };
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }
      const result = await settingsApi.discoverModels(payload);
      if (result.status === 'succeeded') {
        setDiscoveredModels(result.models);
        setDiscoveryMessage(
          result.models.length > 0
            ? `已获取 ${result.models.length} 个模型`
            : '未找到可用模型'
        );
        return;
      }
      setDiscoveredModels([]);
      if (result.status === 'unavailable') {
        setDiscoveryMessage('请先填写 API 密钥，或使用已保存的密钥');
      } else {
        const detail = result.last_failure_classification || result.message;
        setDiscoveryMessage(
          detail ? `获取模型失败：${detail}` : '获取模型失败'
        );
      }
    } catch {
      setDiscoveredModels([]);
      setDiscoveryMessage('获取模型失败');
    } finally {
      setDiscovering(false);
    }
  };

  const handleSelectModel = (modelId: string) => {
    setForm(value => ({ ...value, model_name: modelId }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const keyStatus = settings?.has_api_key
    ? settings.api_key_hint || '已保存'
    : '未配置';

  return (
    <InkWashShell
      tone='form'
      title='设置'
      context='设置'
      description='保存当前账号的 OpenAI 兼容模型配置，并查看最近一次能力状态。'
    >
      <div className='mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'>
        <form onSubmit={handleSave} className='retained-form-card p-6 sm:p-7'>
          <div className='grid gap-5'>
            <label className='grid gap-2 font-kaishu text-sm text-ink'>
              服务地址
              <input
                value={form.base_url}
                onChange={event =>
                  setForm(value => ({ ...value, base_url: event.target.value }))
                }
                className='retained-input rounded-[6px] px-4 py-3 font-sans text-base outline-none'
                required
              />
            </label>
            <div className='grid gap-2 font-kaishu text-sm text-ink'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <label htmlFor='model-name'>模型名称</label>
                <button
                  type='button'
                  onClick={handleDiscoverModels}
                  disabled={loading || discovering || !form.base_url.trim()}
                  className='inline-flex items-center justify-center gap-2 rounded-[6px] border border-ink-light/20 bg-paper-rice/82 px-3 py-2 text-sm text-ink transition hover:bg-paper disabled:opacity-60'
                >
                  {discovering ? (
                    <Loader2
                      className='h-4 w-4 animate-spin'
                      aria-hidden='true'
                    />
                  ) : (
                    <Search className='h-4 w-4' aria-hidden='true' />
                  )}
                  {discovering ? '获取中' : '获取模型'}
                </button>
              </div>
              <input
                id='model-name'
                value={form.model_name}
                onChange={event =>
                  setForm(value => ({
                    ...value,
                    model_name: event.target.value,
                  }))
                }
                className='retained-input rounded-[6px] px-4 py-3 font-sans text-base outline-none'
                required
              />
              {discoveryMessage && (
                <p
                  aria-live='polite'
                  className='font-kaishu text-sm text-ink-wash'
                >
                  {discoveryMessage}
                </p>
              )}
              {discoveredModels.length > 0 && (
                <div className='grid max-h-64 gap-2 overflow-y-auto rounded-[4px] border border-ink-light/15 bg-paper/70 p-3'>
                  {discoveredModels.map(model => {
                    const selected = form.model_name === model.id;
                    return (
                      <button
                        key={model.id}
                        type='button'
                        onClick={() => handleSelectModel(model.id)}
                        className={`flex min-h-12 items-center justify-between gap-3 rounded-[4px] border px-3 py-2 text-left transition ${
                          selected
                            ? 'border-seal-red bg-seal-red/5'
                            : 'border-ink-light/10 bg-paper hover:bg-paper-rice'
                        }`}
                      >
                        <span className='min-w-0'>
                          <span className='block truncate font-sans text-sm text-ink'>
                            {model.id}
                          </span>
                          {model.owned_by && (
                            <span className='block truncate font-sans text-xs text-ink-light'>
                              {model.owned_by}
                            </span>
                          )}
                        </span>
                        <span className='inline-flex shrink-0 items-center gap-1 font-kaishu text-xs text-ink-wash'>
                          {selected && (
                            <Check className='h-4 w-4' aria-hidden='true' />
                          )}
                          {selected ? '已选中' : '使用'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <label className='flex items-center justify-between gap-4 rounded-[4px] border border-ink-light/15 bg-paper/70 px-4 py-3 font-kaishu text-sm text-ink'>
              JSON 兜底
              <input
                type='checkbox'
                checked={form.json_fallback_enabled}
                onChange={event =>
                  setForm(value => ({
                    ...value,
                    json_fallback_enabled: event.target.checked,
                  }))
                }
                className='h-5 w-5 accent-seal-red'
              />
            </label>
            <label className='grid gap-2 font-kaishu text-sm text-ink'>
              API 密钥
              <input
                type='password'
                value={apiKey}
                onChange={event => setApiKey(event.target.value)}
                className='retained-input rounded-[6px] px-4 py-3 font-sans text-base outline-none'
                autoComplete='new-password'
              />
            </label>
            {message && (
              <p className='font-kaishu text-sm text-ink-wash'>{message}</p>
            )}
            <div className='flex flex-wrap gap-3'>
              <button
                type='submit'
                disabled={loading || saving}
                className='ink-hover inline-flex items-center justify-center gap-2 rounded-[6px] border border-ink bg-ink px-5 py-3 font-kaishu text-base text-paper transition hover:bg-ink-light disabled:opacity-60'
              >
                <Save className='h-4 w-4' aria-hidden='true' />
                {saving ? '保存中' : '保存'}
              </button>
              <button
                type='button'
                onClick={handleTest}
                disabled={loading || testing}
                className='ink-hover inline-flex items-center justify-center gap-2 rounded-[6px] border border-ink-light/20 bg-paper-rice/82 px-5 py-3 font-kaishu text-base text-ink transition hover:bg-paper disabled:opacity-60'
              >
                <PlugZap className='h-4 w-4' aria-hidden='true' />
                {testing ? '测试中' : '测试'}
              </button>
            </div>
          </div>
        </form>

        <aside className='retained-form-card p-6 sm:p-7'>
          <div className='mb-5 flex items-center justify-between gap-3'>
            <h2 className='font-running-script text-2xl font-normal text-ink'>
              账号状态
            </h2>
            <span className='rounded-[4px] border border-ink-light/12 bg-paper-rice/72 px-2 py-0.5 font-kaishu text-xs text-ink'>
              {user?.username || '--'}
            </span>
          </div>
          <dl className='grid gap-3 font-kaishu text-sm text-ink'>
            <div className='flex items-center justify-between gap-4 border-b border-ink-light/10 pb-3'>
              <dt className='inline-flex items-center gap-2'>
                <KeyRound className='h-4 w-4' aria-hidden='true' />
                API 密钥
              </dt>
              <dd>{keyStatus}</dd>
            </div>
            <div className='flex items-center justify-between gap-4 border-b border-ink-light/10 pb-3'>
              <dt>成功模式</dt>
              <dd>{settings?.last_successful_mode || '--'}</dd>
            </div>
            <div className='flex items-center justify-between gap-4 border-b border-ink-light/10 pb-3'>
              <dt>失败分类</dt>
              <dd>{settings?.last_failure_classification || '--'}</dd>
            </div>
            <div className='flex items-center justify-between gap-4'>
              <dt>测试状态</dt>
              <dd>
                {testResult?.status || settings?.last_test_status || '--'}
              </dd>
            </div>
          </dl>
          <button
            type='button'
            onClick={handleLogout}
            className='mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[6px] border border-ink-light/25 bg-paper px-5 py-3 font-kaishu text-base text-ink transition hover:bg-paper-rice'
          >
            <LogOut className='h-4 w-4' aria-hidden='true' />
            退出登录
          </button>
        </aside>
      </div>
    </InkWashShell>
  );
}

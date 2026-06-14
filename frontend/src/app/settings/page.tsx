import { useState, useEffect, useCallback } from 'react';
import { settingsService } from '../../services/settingsService';
import type {
  WritingAISettingsResponse,
  WritingAISettingsUpdate,
  ProviderModelsResponse,
  ProviderTestResponse,
} from '../../types/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Toast, type ToastType } from '../../components/ui/Toast';

interface ToastState {
  show: boolean;
  message: string;
  type: ToastType;
}

export default function SettingsPage() {
  // Current settings state
  const [currentSettings, setCurrentSettings] = useState<WritingAISettingsResponse | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Form state
  const [formData, setFormData] = useState<WritingAISettingsUpdate>({
    provider_name: '',
    base_url: '',
    model_name: '',
    api_key: '',
    json_fallback_enabled: false,
  });

  // UI state
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' });
  const [discoveredModels, setDiscoveredModels] = useState<ProviderModelsResponse | null>(null);
  const [showModelsModal, setShowModelsModal] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof WritingAISettingsUpdate, string>>>({});

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
  }, []);

  const loadSettings = useCallback(async () => {
    // Used by retry handlers (event callbacks), where synchronous setState is
    // allowed. The mount effect uses an inlined copy instead (see below) so the
    // set-state-in-effect rule stays satisfied on initial load.
    try {
      setIsLoadingSettings(true);
      const settings = await settingsService.getSettings();
      setCurrentSettings(settings);

      // Populate form with current settings
      setFormData({
        provider_name: settings.provider_name,
        base_url: settings.base_url,
        model_name: settings.model_name,
        api_key: '', // Never pre-fill API key
        json_fallback_enabled: settings.json_fallback_enabled,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载设置失败', 'error');
    } finally {
      setIsLoadingSettings(false);
    }
  }, [showToast]);

  // Load current settings on mount. The async fetch is inlined directly in the
  // effect body so every setState runs after an `await` (asynchronous), which
  // keeps react-hooks/set-state-in-effect satisfied. `loadSettings` (above) is
  // still used by the retry handlers in event callbacks.
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const settings = await settingsService.getSettings();
        if (!isMounted) return;
        setCurrentSettings(settings);

        // Populate form with current settings
        setFormData({
          provider_name: settings.provider_name,
          base_url: settings.base_url,
          model_name: settings.model_name,
          api_key: '', // Never pre-fill API key
          json_fallback_enabled: settings.json_fallback_enabled,
        });
      } catch (error) {
        if (!isMounted) return;
        showToast(error instanceof Error ? error.message : '加载设置失败', 'error');
      } finally {
        if (isMounted) {
          setIsLoadingSettings(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof WritingAISettingsUpdate, string>> = {};

    if (!formData.provider_name.trim()) {
      newErrors.provider_name = '提供商名称不能为空';
    }

    if (!formData.base_url.trim()) {
      newErrors.base_url = 'Base URL 不能为空';
    } else {
      try {
        new URL(formData.base_url);
      } catch {
        newErrors.base_url = '请输入有效的 URL';
      }
    }

    if (!formData.model_name.trim()) {
      newErrors.model_name = '模型名称不能为空';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('请修正表单错误', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      // Only send api_key if it's been modified (non-empty)
      const updateData: WritingAISettingsUpdate = {
        provider_name: formData.provider_name,
        base_url: formData.base_url,
        model_name: formData.model_name,
        json_fallback_enabled: formData.json_fallback_enabled,
      };

      if (formData.api_key && formData.api_key.trim()) {
        updateData.api_key = formData.api_key;
      }

      const updatedSettings = await settingsService.updateSettings(updateData);
      setCurrentSettings(updatedSettings);

      // Clear API key field after successful update
      setFormData((prev) => ({ ...prev, api_key: '' }));

      showToast('设置已保存', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存设置失败', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      const result: ProviderTestResponse = await settingsService.testConnection();

      if (result.status === 'success') {
        showToast(`连接测试成功！模式: ${result.last_successful_mode || '未知'}`, 'success');
        // Reload settings to get updated test status. loadSettings (called in
        // this event handler) sets isLoadingSettings itself.
        await loadSettings();
      } else {
        const classification = result.last_failure_classification || '未知错误';
        showToast(`连接测试失败: ${classification}`, 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '测试连接失败', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDiscoverModels = async () => {
    try {
      setIsDiscovering(true);

      // Use form values if API key is provided, otherwise use saved settings
      const discoveryPayload = formData.api_key?.trim()
        ? { base_url: formData.base_url, api_key: formData.api_key }
        : undefined;

      const result = await settingsService.discoverModels(discoveryPayload);
      setDiscoveredModels(result);

      if (result.status === 'success') {
        if (result.model_count > 0) {
          setShowModelsModal(true);
        } else {
          showToast('未发现可用模型', 'info');
        }
      } else if (result.status === 'unavailable') {
        showToast('请先配置 API Key', 'warning');
      } else {
        const classification = result.last_failure_classification || '未知错误';
        showToast(`模型发现失败: ${classification}`, 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '发现模型失败', 'error');
    } finally {
      setIsDiscovering(false);
    }
  };

  const selectModel = (modelId: string) => {
    setFormData((prev) => ({ ...prev, model_name: modelId }));
    setShowModelsModal(false);
    showToast(`已选择模型: ${modelId}`, 'info');
  };

  // Focus trap for modal
  useEffect(() => {
    if (!showModelsModal) return;

    const modalElement = document.querySelector('[role="dialog"]');
    if (!modalElement) return;

    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModelsModal(false);
      }
    };

    document.addEventListener('keydown', handleTab);
    document.addEventListener('keydown', handleEscape);
    firstElement?.focus();

    return () => {
      document.removeEventListener('keydown', handleTab);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showModelsModal]);

  if (isLoadingSettings) {
    return (
      <main id="main-content" className="min-h-screen bg-paper-white flex items-center justify-center">
        <div className="text-slate-gray" role="status" aria-live="polite">加载设置中...</div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-paper-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-display text-deep-ink mb-2">AI 配置</h1>
        <p className="text-slate-gray mb-8">配置写作批改所使用的 AI 提供商</p>

        {/* Current Configuration Status */}
        {currentSettings && (
          <div className="bg-card-cream rounded-lg p-6 mb-8 border border-slate-gray/20">
            <h2 className="text-lg font-semibold text-deep-ink mb-4">当前配置状态</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <span className="text-sm text-slate-gray">提供商</span>
                <p className="text-deep-ink font-medium">{currentSettings.provider_name || '未配置'}</p>
              </div>

              <div>
                <span className="text-sm text-slate-gray">模型名称</span>
                <p className="text-deep-ink font-medium">{currentSettings.model_name || '未配置'}</p>
              </div>

              <div>
                <span className="text-sm text-slate-gray">Base URL</span>
                <p className="text-deep-ink font-medium text-sm break-all">
                  {currentSettings.base_url || '未配置'}
                </p>
              </div>

              <div>
                <span className="text-sm text-slate-gray">API Key 状态</span>
                <div className="flex items-center gap-2 mt-1">
                  {currentSettings.has_api_key ? (
                    <>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-success-ink/10 text-success-ink">
                        已配置
                      </span>
                      {currentSettings.api_key_hint && (
                        <span className="text-xs text-slate-gray font-mono">
                          {currentSettings.api_key_hint}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-warning-amber/10 text-warning-amber">
                      未配置
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Last Test Result */}
            {currentSettings.last_tested_at && (
              <div className="pt-4 border-t border-slate-gray/20">
                <span className="text-sm text-slate-gray">上次测试</span>
                <div className="flex items-center gap-2 mt-1">
                  {currentSettings.last_test_status === 'success' ? (
                    <>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-success-ink/10 text-success-ink">
                        成功
                      </span>
                      {currentSettings.last_successful_mode && (
                        <span className="text-xs text-slate-gray">
                          模式: {currentSettings.last_successful_mode}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-error-crimson/10 text-error-crimson">
                        失败
                      </span>
                      {currentSettings.last_failure_classification && (
                        <span className="text-xs text-error-crimson">
                          {currentSettings.last_failure_classification}
                        </span>
                      )}
                    </>
                  )}
                  <span className="text-xs text-slate-gray">
                    {new Date(currentSettings.last_tested_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuration Form */}
        <form onSubmit={handleSubmit} className="bg-card-cream rounded-lg p-6 border border-slate-gray/20">
          <h2 className="text-lg font-semibold text-deep-ink mb-6">更新配置</h2>

          <div className="space-y-4">
            <Input
              label="提供商名称"
              placeholder="例如: OpenAI, Anthropic, DeepSeek"
              value={formData.provider_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, provider_name: e.target.value }))}
              error={errors.provider_name}
              required
            />

            <Input
              label="Base URL"
              type="url"
              placeholder="https://api.example.com/v1"
              value={formData.base_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, base_url: e.target.value }))}
              error={errors.base_url}
              helperText="API 端点的基础 URL"
              required
            />

            <Input
              label="模型名称"
              placeholder="例如: gpt-4, claude-3-opus"
              value={formData.model_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, model_name: e.target.value }))}
              error={errors.model_name}
              required
            />

            <div className="relative">
              <Input
                label="API Key"
                type={showApiKey ? 'text' : 'password'}
                placeholder={currentSettings?.has_api_key ? '留空表示不修改现有密钥' : '输入 API Key'}
                value={formData.api_key}
                onChange={(e) => setFormData((prev) => ({ ...prev, api_key: e.target.value }))}
                helperText={currentSettings?.has_api_key ? '留空以保持现有密钥不变' : '用于访问 AI 服务的密钥'}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-[38px] text-slate-gray hover:text-deep-ink transition-colors"
                aria-label={showApiKey ? '隐藏密钥' : '显示密钥'}
              >
                {showApiKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="json-fallback" className="flex items-center gap-2 cursor-pointer p-3 -m-3">
                <input
                  type="checkbox"
                  id="json-fallback"
                  checked={formData.json_fallback_enabled}
                  onChange={(e) => setFormData((prev) => ({ ...prev, json_fallback_enabled: e.target.checked }))}
                  className="w-4 h-4 text-vermilion border-slate-gray/30 rounded focus:ring-vermilion"
                />
                <span className="text-sm text-deep-ink">
                  启用 JSON 降级模式
                </span>
              </label>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="submit" isLoading={isSubmitting}>
              保存设置
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={handleTestConnection}
              isLoading={isTesting}
              disabled={!currentSettings?.has_api_key}
              aria-label="测试已保存的配置"
            >
              测试连接
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleDiscoverModels}
              isLoading={isDiscovering}
            >
              发现模型
            </Button>
          </div>

          <p className="mt-3 text-sm text-slate-gray">
            💡 提示：「测试连接」按钮测试的是已保存的配置。如有未保存的更改，请先保存设置再测试。
          </p>
        </form>

        {/* Models Discovery Modal */}
        {showModelsModal && discoveredModels && (
          <div
            className="fixed inset-0 bg-deep-ink/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModelsModal(false)}
            role="dialog"
            aria-labelledby="models-modal-title"
            aria-modal="true"
          >
            <div
              className="bg-paper-white rounded-lg shadow-lift max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-gray/20 flex items-center justify-between">
                <div>
                  <h3 id="models-modal-title" className="text-xl font-semibold text-deep-ink">可用模型列表</h3>
                  <p className="text-sm text-slate-gray mt-1">
                    发现 {discoveredModels.model_count} 个模型
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModelsModal(false)}
                  className="p-2 hover:bg-slate-gray/10 rounded-md transition-smooth min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="关闭模型列表"
                >
                  <svg className="w-5 h-5 text-slate-gray" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-2">
                  {discoveredModels.models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => selectModel(model.id)}
                      className="w-full text-left p-4 rounded-md border border-slate-gray/20 hover:border-vermilion hover:bg-vermilion/5 transition-all"
                    >
                      <div className="font-medium text-deep-ink">{model.id}</div>
                      {model.owned_by && (
                        <div className="text-sm text-slate-gray mt-1">
                          提供者: {model.owned_by}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-slate-gray/20">
                <Button variant="secondary" onClick={() => setShowModelsModal(false)}>
                  关闭
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast.show && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast({ ...toast, show: false })}
          />
        )}
      </div>
    </main>
  );
}

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '../../../App';
import { saveStoredAuthToken } from '../../../services/authSession';
import type {
  WritingAISettings,
  ProviderModelsResponse,
  ProviderTestResponse,
} from '../../../types/settings';

const currentUser = {
  id: 1,
  username: 'settings_user',
  email: 'settings@example.com',
  is_active: true,
};

const defaultSettings: WritingAISettings = {
  provider_name: 'openai-compatible',
  base_url: 'https://provider.example.com/v1',
  model_name: 'writing-model',
  json_fallback_enabled: true,
  has_api_key: true,
  api_key_hint: '****1234',
  last_test_status: 'unknown',
  last_tested_at: null,
  last_failure_classification: null,
  last_successful_mode: null,
};

interface SettingsSavePayload {
  provider_name: string;
  base_url: string;
  model_name: string;
  json_fallback_enabled: boolean;
  api_key?: string;
}

interface ModelDiscoveryPayload {
  base_url?: string;
  api_key?: string;
}

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );

const renderSettingsRoute = () =>
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <App />
    </MemoryRouter>
  );

function setupSettingsFetch(
  options: {
    settings?: Partial<WritingAISettings>;
    providerModelsResponse?: ProviderModelsResponse;
    providerTestResponse?: ProviderTestResponse;
    onDiscover?: (
      payload: ModelDiscoveryPayload,
      current: WritingAISettings
    ) => ProviderModelsResponse;
    onSave?: (
      payload: SettingsSavePayload,
      current: WritingAISettings
    ) => WritingAISettings;
  } = {}
) {
  let settings: WritingAISettings = {
    ...defaultSettings,
    ...options.settings,
  };
  const savePayloads: SettingsSavePayload[] = [];
  const discoverPayloads: ModelDiscoveryPayload[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.endsWith('/api/v1/auth/me')) {
      return jsonResponse(currentUser);
    }

    if (url.endsWith('/api/v1/settings/writing-ai') && method === 'GET') {
      return jsonResponse(settings);
    }

    if (url.endsWith('/api/v1/settings/writing-ai') && method === 'PUT') {
      const payload = JSON.parse(
        String(init?.body ?? '{}')
      ) as SettingsSavePayload;
      savePayloads.push(payload);
      settings = options.onSave
        ? options.onSave(payload, settings)
        : {
            ...settings,
            provider_name: payload.provider_name,
            base_url: payload.base_url,
            model_name: payload.model_name,
            json_fallback_enabled: payload.json_fallback_enabled,
            has_api_key:
              typeof payload.api_key === 'string' ? true : settings.has_api_key,
            api_key_hint:
              typeof payload.api_key === 'string'
                ? `****${payload.api_key.slice(-4)}`
                : settings.api_key_hint,
          };
      return jsonResponse(settings);
    }

    if (url.endsWith('/api/v1/settings/writing-ai/models') && method === 'POST') {
      const payload = JSON.parse(
        String(init?.body ?? '{}')
      ) as ModelDiscoveryPayload;
      discoverPayloads.push(payload);
      const result: ProviderModelsResponse = options.onDiscover?.(
        payload,
        settings
      ) ??
        options.providerModelsResponse ?? {
          status: 'succeeded',
          configured: true,
          base_url: payload.base_url ?? settings.base_url,
          model_count: 2,
          models: [
            {
              id: 'writing-model',
              created: 1686935001,
              object: 'model',
              owned_by: 'provider',
            },
            {
              id: 'writing-model-v2',
              created: 1686935002,
              object: 'model',
              owned_by: 'provider',
            },
          ],
          last_failure_classification: null,
          message: 'Model discovery succeeded',
        };
      return jsonResponse(result);
    }

    if (url.endsWith('/api/v1/settings/writing-ai/test') && method === 'POST') {
      const result: ProviderTestResponse = options.providerTestResponse ?? {
        status: 'passed',
        configured: true,
        model: settings.model_name,
        base_url: settings.base_url,
        last_successful_mode: 'structured-output',
        last_failure_classification: null,
        message: 'provider ok',
      };

      settings = {
        ...settings,
        last_test_status: result.status,
        last_successful_mode:
          result.last_successful_mode ?? settings.last_successful_mode,
        last_failure_classification:
          result.last_failure_classification ??
          settings.last_failure_classification,
        last_tested_at: '2026-05-08T08:00:00.000Z',
      };
      return jsonResponse(result);
    }

    return jsonResponse({}, 404);
  });

  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    savePayloads,
    discoverPayloads,
    getSettings: () => settings,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('SettingsPage', () => {
  it('loads settings and keeps API keys redacted', async () => {
    setupSettingsFetch();
    saveStoredAuthToken({
      access_token: 'token-settings',
      token_type: 'bearer',
      expires_in: 3600,
    });

    renderSettingsRoute();

    expect(
      await screen.findByRole('heading', { name: '设置' })
    ).toBeInTheDocument();
    const baseUrl = screen.getByLabelText('服务地址');
    const modelName = screen.getByLabelText('模型名称');
    await waitFor(() => {
      expect(baseUrl).toHaveDisplayValue('https://provider.example.com/v1');
      expect(modelName).toHaveDisplayValue('writing-model');
    });
    expect(screen.getByLabelText('JSON 兜底')).toBeChecked();
    expect(screen.getByLabelText('API 密钥')).toHaveValue('');
    expect(screen.getAllByText('****1234').length).toBeGreaterThan(0);
  });

  it('discovers provider models, fills the selected model, and clears stale results', async () => {
    const user = userEvent.setup();
    const { discoverPayloads } = setupSettingsFetch();
    saveStoredAuthToken({
      access_token: 'token-settings',
      token_type: 'bearer',
      expires_in: 3600,
    });

    renderSettingsRoute();
    const baseUrl = await screen.findByLabelText('服务地址');
    const modelName = await screen.findByLabelText('模型名称');
    const apiKey = screen.getByLabelText('API 密钥');
    await waitFor(() => {
      expect(baseUrl).toHaveDisplayValue('https://provider.example.com/v1');
      expect(modelName).toHaveDisplayValue('writing-model');
    });

    await user.type(apiKey, 'sk-discovery-secret-0000');
    await user.click(screen.getByRole('button', { name: /获取模型/ }));

    expect(await screen.findByText('已获取 2 个模型')).toBeInTheDocument();
    expect(discoverPayloads).toEqual([
      {
        base_url: 'https://provider.example.com/v1',
        api_key: 'sk-discovery-secret-0000',
      },
    ]);

    const nextModel = screen.getByRole('button', { name: /writing-model-v2/ });
    await user.click(nextModel);
    expect(modelName).toHaveDisplayValue('writing-model-v2');

    await user.clear(baseUrl);
    await user.type(baseUrl, 'https://provider.example.com/v2');
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /writing-model-v2/ })
      ).not.toBeInTheDocument();
    });
  });

  it('shows model discovery failures safely', async () => {
    const user = userEvent.setup();
    setupSettingsFetch({
      providerModelsResponse: {
        status: 'failed',
        configured: true,
        base_url: 'https://provider.example.com/v1',
        model_count: 0,
        models: [],
        last_failure_classification: 'authentication',
        message: 'Model discovery failed',
      },
    });
    saveStoredAuthToken({
      access_token: 'token-settings',
      token_type: 'bearer',
      expires_in: 3600,
    });

    renderSettingsRoute();
    const baseUrl = await screen.findByLabelText('服务地址');
    await waitFor(() => {
      expect(baseUrl).toHaveDisplayValue('https://provider.example.com/v1');
    });

    await user.click(screen.getByRole('button', { name: /获取模型/ }));

    expect(
      await screen.findByText('获取模型失败：authentication')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /writing-model-v2/ })
    ).not.toBeInTheDocument();
  });

  it('saves settings without replacing the existing API key', async () => {
    const user = userEvent.setup();
    const { savePayloads } = setupSettingsFetch();
    saveStoredAuthToken({
      access_token: 'token-settings',
      token_type: 'bearer',
      expires_in: 3600,
    });

    renderSettingsRoute();
    const baseUrl = await screen.findByLabelText('服务地址');
    const modelName = await screen.findByLabelText('模型名称');
    await waitFor(() => {
      expect(baseUrl).toHaveDisplayValue('https://provider.example.com/v1');
      expect(modelName).toHaveDisplayValue('writing-model');
    });

    await user.clear(baseUrl);
    await user.type(baseUrl, 'https://provider.example.com/v2');
    await user.clear(modelName);
    await user.type(modelName, 'writing-model-v2');
    await user.click(screen.getByLabelText('JSON 兜底'));
    await user.click(screen.getByRole('button', { name: /^保存$/ }));

    await waitFor(() => {
      expect(savePayloads).toHaveLength(1);
    });
    expect(savePayloads[0]).toMatchObject({
      provider_name: 'openai-compatible',
      base_url: 'https://provider.example.com/v2',
      model_name: 'writing-model-v2',
      json_fallback_enabled: false,
    });
    expect(savePayloads[0]).not.toHaveProperty('api_key');
    expect(await screen.findByText('设置已保存')).toBeInTheDocument();
    expect(screen.getAllByText('****1234').length).toBeGreaterThan(0);
  });

  it('replaces the API key when a new secret is submitted', async () => {
    const user = userEvent.setup();
    const { savePayloads } = setupSettingsFetch();
    saveStoredAuthToken({
      access_token: 'token-settings',
      token_type: 'bearer',
      expires_in: 3600,
    });

    renderSettingsRoute();
    const apiKeyInput = await screen.findByLabelText('API 密钥');
    await waitFor(() => {
      expect(screen.getByLabelText('服务地址')).toHaveDisplayValue(
        'https://provider.example.com/v1'
      );
      expect(apiKeyInput).toHaveValue('');
    });

    await user.type(apiKeyInput, 'sk-new-secret-9999');
    await user.click(screen.getByRole('button', { name: /^保存$/ }));

    await waitFor(() => {
      expect(savePayloads).toHaveLength(1);
    });
    expect(savePayloads[0]).toMatchObject({
      api_key: 'sk-new-secret-9999',
    });
    expect(apiKeyInput).toHaveValue('');
    expect(screen.getAllByText('****9999').length).toBeGreaterThan(0);
  });

  it('shows explicit provider test success state and refreshed metadata', async () => {
    const user = userEvent.setup();
    setupSettingsFetch({
      providerTestResponse: {
        status: 'passed',
        configured: true,
        model: 'writing-model',
        base_url: 'https://provider.example.com/v1',
        last_successful_mode: 'structured-output',
        last_failure_classification: null,
        message: 'provider ok',
      },
    });
    saveStoredAuthToken({
      access_token: 'token-settings',
      token_type: 'bearer',
      expires_in: 3600,
    });

    renderSettingsRoute();
    const baseUrl = await screen.findByLabelText('服务地址');
    await waitFor(() => {
      expect(baseUrl).toHaveDisplayValue('https://provider.example.com/v1');
    });

    await user.click(screen.getByRole('button', { name: /^测试$/ }));

    await waitFor(() => {
      expect(screen.getAllByText('passed').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('structured-output')).toBeInTheDocument();
  });

  it('shows explicit provider test failure metadata safely', async () => {
    const user = userEvent.setup();
    setupSettingsFetch({
      providerTestResponse: {
        status: 'failed',
        configured: false,
        model: 'writing-model',
        base_url: 'https://provider.example.com/v1',
        last_successful_mode: null,
        last_failure_classification: 'authentication',
        message: 'provider auth failed',
      },
    });
    saveStoredAuthToken({
      access_token: 'token-settings',
      token_type: 'bearer',
      expires_in: 3600,
    });

    renderSettingsRoute();
    const baseUrl = await screen.findByLabelText('服务地址');
    await waitFor(() => {
      expect(baseUrl).toHaveDisplayValue('https://provider.example.com/v1');
    });

    await user.click(screen.getByRole('button', { name: /^测试$/ }));

    await waitFor(() => {
      expect(screen.getAllByText('failed').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('authentication')).toBeInTheDocument();
  });
});

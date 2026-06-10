import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import {
  getStoredAuthToken,
  saveStoredAuthToken,
} from '../../services/authSession';

const currentUser = {
  id: 1,
  username: 'auth_user',
  email: 'auth@example.com',
  is_active: true,
};

const settingsResponse = {
  provider_name: 'openai-compatible',
  base_url: 'https://provider.example.com/v1',
  model_name: 'writing-model',
  json_fallback_enabled: true,
  has_api_key: true,
  api_key_hint: '****1234',
  last_test_status: null,
  last_tested_at: null,
  last_failure_classification: null,
  last_successful_mode: null,
};

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );

const renderRoute = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('auth flow', () => {
  it('logs in and renders the requested protected route', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/login')) {
        return jsonResponse({
          access_token: 'token-login',
          token_type: 'bearer',
          expires_in: 3600,
        });
      }
      if (url.endsWith('/api/v1/auth/me')) {
        return jsonResponse(currentUser);
      }
      if (url.endsWith('/api/v1/settings/writing-ai')) {
        return jsonResponse(settingsResponse);
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderRoute('/login?next=/settings');
    await user.type(screen.getByLabelText('账号或邮箱'), 'auth_user');
    await user.type(screen.getByLabelText('密码'), 'StrongPass123!');
    await user.click(screen.getByRole('button', { name: /^登录$/ }));

    expect(
      await screen.findByRole('heading', { name: '模型设置' })
    ).toBeInTheDocument();
    expect(getStoredAuthToken()).toBe('token-login');
  });

  it('logs out and clears stored credentials', async () => {
    const user = userEvent.setup();
    saveStoredAuthToken({
      access_token: 'token-existing',
      token_type: 'bearer',
      expires_in: 3600,
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/me')) {
        return jsonResponse(currentUser);
      }
      if (url.endsWith('/api/v1/settings/writing-ai')) {
        return jsonResponse(settingsResponse);
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderRoute('/settings');
    expect(
      await screen.findByRole('heading', { name: '模型设置' })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '退出登录' }));

    await waitFor(() => {
      expect(getStoredAuthToken()).toBeNull();
    });
    expect(
      await screen.findByRole('heading', { name: '登录' })
    ).toBeInTheDocument();
  });

  it('renders the register page as a retained form surface', async () => {
    const { container } = renderRoute('/register?next=/settings');

    expect(
      await screen.findByRole('heading', { name: '注册' })
    ).toBeInTheDocument();
    const shell = container.querySelector('.retained-tone-form');
    expect(shell).toBeInTheDocument();
    expect(shell).toHaveClass('retained-form-shell');
    expect(
      screen.getByText(
        '创建账号后即可保存模型配置、申论批改记录和个人复盘档案。'
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^注册$/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登录' })).toHaveAttribute(
      'href',
      '/login?next=%2Fsettings'
    );
    expect(screen.queryByText('学习工作台')).not.toBeInTheDocument();
    expect(screen.queryByText('今日任务')).not.toBeInTheDocument();
    expect(screen.queryByText('1. 诊断')).not.toBeInTheDocument();
  });
});

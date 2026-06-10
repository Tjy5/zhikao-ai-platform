import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';

const unknownRoutes = [
  '/archived',
  '/archived/session',
  '/legacy-flow',
  '/profile',
  '/internal-dashboard',
  '/internal-dashboard?from=legacy-flow',
] as const;

const legacyStorageKeys = [
  'legacy_flow_state',
  'latest_legacy_result',
  'legacy_handoff_payload',
  'legacy_user_id',
] as const;

const unexpectedRouteText = [
  'Legacy workflow module',
  'Archived control panel',
  'Internal-only report',
  'Hidden profile workflow',
] as const;

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

describe('retained route smoke and fallback route handling', () => {
  it('renders the public home route and gates protected routes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        } as Response)
      )
    );

    renderRoute('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: /智能公考学习平台/ })
    ).toBeInTheDocument();
    expect(screen.getAllByText('智考AI').length).toBeGreaterThan(0);
    expect(screen.getAllByText('开始申论批改')[0]).toHaveAttribute(
      'href',
      '/writing'
    );
    expect(screen.getAllByText('查看复盘档案')[0]).toHaveAttribute(
      'href',
      '/history'
    );

    cleanup();
    renderRoute('/shenlun-study');
    expect(
      await screen.findByRole('heading', { level: 1, name: '申论学习' })
    ).toBeInTheDocument();
    expect(screen.getByText('五类题不背模板，背判断')).toBeInTheDocument();
    expect(screen.getByText('范围、内容、要求')).toBeInTheDocument();

    cleanup();
    renderRoute('/writing');
    expect(
      await screen.findByRole('heading', { name: '登录' })
    ).toBeInTheDocument();

    cleanup();
    renderRoute('/history');
    expect(
      await screen.findByRole('heading', { name: '登录' })
    ).toBeInTheDocument();

    cleanup();
    renderRoute('/settings');
    expect(
      await screen.findByRole('heading', { name: '登录' })
    ).toBeInTheDocument();
  });

  it('renders fallback pages without using stale handoff storage', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const key of legacyStorageKeys) {
      window.localStorage.setItem(
        key,
        JSON.stringify({ value: { stale: true }, timestamp: Date.now() })
      );
    }

    for (const route of unknownRoutes) {
      cleanup();
      renderRoute(route);

      expect(screen.getAllByText('智考AI').length).toBeGreaterThan(0);
      for (const text of unexpectedRouteText) {
        expect(screen.queryByText(text)).not.toBeInTheDocument();
      }
    }

    expect(fetchMock).not.toHaveBeenCalled();
    for (const key of legacyStorageKeys) {
      expect(window.localStorage.getItem(key)).not.toBeNull();
    }
  });
});

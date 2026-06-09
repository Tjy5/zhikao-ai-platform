import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';

const jsonResponse = (body: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => body,
  } as Response);

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('home page smoke test', () => {
  it('renders the ink-wash writing grading home page with user-facing workflow content', async () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({
        items: [
          { id: 'writing-1', score: 82 },
          { id: 'writing-2', score: 88 },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderHome();

    expect(
      await screen.findByRole('heading', { level: 1, name: /智能写作反馈/ })
    ).toBeInTheDocument();
    expect(screen.getAllByText('墨评AI').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        '上传材料与作答内容，系统生成评分、评语与修改建议，帮助你复盘每一次写作训练。'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('写作工作台')).toBeInTheDocument();
    expect(screen.getAllByText('首页').length).toBeGreaterThan(0);
    expect(screen.getAllByText('写作反馈').length).toBeGreaterThan(0);
    expect(screen.getAllByText('历史记录').length).toBeGreaterThan(0);
    expect(screen.getAllByText('提交作答').length).toBeGreaterThan(0);
    expect(screen.getAllByText('智能批改').length).toBeGreaterThan(0);
    expect(screen.getAllByText('历史复盘').length).toBeGreaterThan(0);
    const companion = screen.getByTestId('ink-companion-hero');
    expect(companion).toHaveAttribute('data-companion-identity', 'human');
    expect(companion).toHaveAttribute(
      'data-companion-source',
      'selected-chatgpt-static'
    );
    expect(companion).toHaveAttribute(
      'data-layered-scene',
      'scholar-only-scene'
    );
    expect(companion).not.toHaveAttribute('data-paper-crane-role');

    const layeredScene = screen.getByTestId('ink-companion-layered-scene');
    expect(layeredScene).toHaveAttribute(
      'data-scene-role',
      'integrated-layered-companion-scene'
    );

    const companionImages = Array.from(companion.querySelectorAll('img'));
    expect(companionImages).toHaveLength(1);
    expect(companionImages.map(image => image.getAttribute('src'))).toEqual([
      '/images/ink-companion/optimized/ink-scholar-companion-foreground.webp',
    ]);
    expect(
      companionImages.map(image => image.getAttribute('data-layer'))
    ).toEqual(['scholar-foreground']);
    for (const image of companionImages) {
      expect(image).toHaveAttribute('alt', '');
      expect(image).toHaveAttribute('aria-hidden', 'true');
      expect(image.getAttribute('src')).not.toContain('frontend/public');
      expect(image.getAttribute('src')).not.toContain('.png');
      expect(image.getAttribute('src')).not.toContain(
        'ink-scholar-companion.webp'
      );
      expect(image.getAttribute('src')).not.toContain(
        'ink-paper-crane-motif.webp'
      );
      expect(image.getAttribute('src')).not.toContain(
        'ink-paper-crane-accent.webp'
      );
      expect(image.getAttribute('src')).not.toContain(
        'ink-companion-hero-backdrop.webp'
      );
    }
    expect(screen.getByText('先提交作答')).toBeInTheDocument();
    expect(screen.getByText('再复盘反馈')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '写作反馈与历史复盘' })
    ).toBeInTheDocument();
    expect(screen.queryByText('要求拆解')).not.toBeInTheDocument();
    expect(screen.queryByText('修改建议')).not.toBeInTheDocument();
    expect(screen.getByText('批改流程')).toBeInTheDocument();
    expect(screen.getByText('立即提交写作')).toBeInTheDocument();

    await waitFor(() => {
      const writingStat = screen.getByText('来自反馈历史').parentElement;
      const scoreStat = screen.getByText('来自批改历史').parentElement;

      expect(writingStat).toHaveTextContent('批改记录');
      expect(writingStat).toHaveTextContent('2');
      expect(scoreStat).toHaveTextContent('平均分');
      expect(scoreStat).toHaveTextContent('85');
    });

    const navLinks = within(screen.getByLabelText('墨评AI 导航')).getAllByRole(
      'link'
    );
    expect(navLinks.map(link => link.textContent)).toEqual([
      '首页',
      '写作反馈',
      '历史记录',
      '设置',
    ]);
    expect(navLinks.map(link => link.getAttribute('href'))).toEqual([
      '/',
      '/writing',
      '/history',
      '/settings',
    ]);

    const hrefs = screen
      .getAllByRole('link')
      .map(link => link.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining(['/', '/writing', '/history', '/settings'])
    );
    expect(hrefs).not.toEqual(
      expect.arrayContaining(['#process', '#features'])
    );
    expect(hrefs).not.toEqual(
      expect.arrayContaining([
        '/archived',
        '/archived/session',
        '/legacy-flow',
        '/profile',
        '/internal-dashboard',
        '/api/v1/internal/dashboard',
      ])
    );

    expect(container.querySelector('.ink-texture-overlay')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/writings/history?limit=50'),
      expect.objectContaining({ method: 'GET' })
    );
  });
});

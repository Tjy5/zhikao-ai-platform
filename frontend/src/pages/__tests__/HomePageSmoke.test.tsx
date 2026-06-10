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
  it('renders the civic exam learning platform home page with user-facing workflow content', async () => {
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
      await screen.findByRole('heading', { level: 1, name: /智能公考学习平台/ })
    ).toBeInTheDocument();
    expect(screen.getAllByText('智考AI').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        '围绕公务员考试的长期备考路径，把训练计划、申论批改、历史复盘和模型配置放进同一个学习指挥舱。'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('AI 驱动的公考备考工作台')).toBeInTheDocument();
    expect(screen.getAllByText('学习首页').length).toBeGreaterThan(0);
    expect(screen.getAllByText('申论批改').length).toBeGreaterThan(0);
    expect(screen.getAllByText('复盘档案').length).toBeGreaterThan(0);
    expect(screen.getAllByText('模型设置').length).toBeGreaterThan(0);
    expect(screen.getAllByText('诊断薄弱项').length).toBeGreaterThan(0);
    expect(screen.getAllByText('专项训练').length).toBeGreaterThan(0);
    expect(screen.getAllByText('智能批改').length).toBeGreaterThan(0);
    expect(screen.getAllByText('复盘提分').length).toBeGreaterThan(0);

    const companion = screen.getByTestId('ink-companion-hero');
    expect(companion).toHaveAttribute(
      'data-companion-identity',
      'civil-service-learning-dashboard'
    );
    expect(companion).toHaveAttribute(
      'data-companion-source',
      'selected-chatgpt-static'
    );
    expect(companion).toHaveAttribute(
      'data-layered-scene',
      'civic-study-dashboard-scene'
    );
    expect(companion).not.toHaveAttribute('data-paper-crane-role');

    const layeredScene = screen.getByTestId('ink-companion-layered-scene');
    expect(layeredScene).toHaveAttribute(
      'data-scene-role',
      'integrated-civic-learning-scene'
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

    expect(screen.getByText('先看清短板')).toBeInTheDocument();
    expect(screen.getByText('再安排训练')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: '智能公考学习平台核心功能',
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('要求拆解')).not.toBeInTheDocument();
    expect(screen.queryByText('修改建议')).not.toBeInTheDocument();
    expect(screen.getByText('公考备考指挥舱')).toBeInTheDocument();
    expect(screen.getAllByText('开始申论批改').length).toBeGreaterThan(0);
    expect(screen.getAllByText('查看复盘档案').length).toBeGreaterThan(0);

    await waitFor(() => {
      const writingStat = screen.getByText('已沉淀作答记录').parentElement;
      const scoreStat = screen.getByText('来自历史批改').parentElement;

      expect(writingStat).toHaveTextContent('申论批改');
      expect(writingStat).toHaveTextContent('2');
      expect(scoreStat).toHaveTextContent('平均得分');
      expect(scoreStat).toHaveTextContent('85');
    });

    const navLinks = within(screen.getByLabelText('智考AI 导航')).getAllByRole(
      'link'
    );
    expect(navLinks.map(link => link.textContent)).toEqual([
      '学习首页',
      '申论批改',
      '复盘档案',
      '模型设置',
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

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/Toast';
import HistoryPage from '../page';

vi.mock('@/components/AppLink', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const rawWritingItem = {
  id: 'writing-raw-0000000000',
  timestamp: '2026-01-01T08:00:00Z',
  type: 'writing',
  taskType: 'analysis',
  content: '# 写作反馈结果\n\n## 综合评价\n- 立意明确\n- 建议补充基层治理案例',
  contentFormat: 'markdown',
};

const legacyWritingItem = {
  id: 'writing-legacy-0000000',
  timestamp: '2026-01-02T08:00:00Z',
  type: 'writing',
  taskType: 'format-writing',
  score: 58,
};

const displayId = (id: string) => `${id.substring(0, 16)}...`;

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    json: async () => body,
    text: async () => (ok ? '' : `HTTP ${status}`),
  } as Response);

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/history']}>
      <ToastProvider>
        <HistoryPage />
      </ToastProvider>
    </MemoryRouter>
  );

const mockHistoryFetch = () => {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/v1/writings/history?limit=50')) {
      return jsonResponse({ items: [rawWritingItem, legacyWritingItem] });
    }
    if (url.endsWith(`/api/v1/writings/history/${rawWritingItem.id}`)) {
      return jsonResponse({
        id: rawWritingItem.id,
        timestamp: rawWritingItem.timestamp,
        type: rawWritingItem.type,
        request: { content: 'raw request', task_type: rawWritingItem.taskType },
        response: {
          content: rawWritingItem.content,
          contentFormat: rawWritingItem.contentFormat,
        },
      });
    }
    if (url.endsWith(`/api/v1/writings/history/${legacyWritingItem.id}`)) {
      return jsonResponse({
        id: legacyWritingItem.id,
        timestamp: legacyWritingItem.timestamp,
        type: legacyWritingItem.type,
        request: { task_type: legacyWritingItem.taskType },
        response: {
          taskType: legacyWritingItem.taskType,
          score: legacyWritingItem.score,
          feedback: '整体分析清晰。',
          suggestions: ['补充材料细节。'],
          scoreDetails: [
            {
              item: '立意',
              fullScore: 40,
              actualScore: 34,
              description: '观点明确。',
            },
          ],
        },
      });
    }
    if (init?.method === 'DELETE' && url.endsWith('/api/v1/writings/history')) {
      return jsonResponse({ deleted: 2 });
    }
    return jsonResponse({}, false, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('HistoryPage', () => {
  it('renders raw and legacy records and loads selected details', async () => {
    const user = userEvent.setup();
    mockHistoryFetch();

    renderPage();

    expect(
      await screen.findByText(displayId(rawWritingItem.id))
    ).toBeInTheDocument();
    expect(
      screen.getByText(displayId(legacyWritingItem.id))
    ).toBeInTheDocument();
    expect(screen.getByText('58.0分')).toBeInTheDocument();
    expect(screen.getByText('请选择记录查看详情')).toBeInTheDocument();

    await user.click(screen.getByText(displayId(rawWritingItem.id)));
    const rawHeading = await screen.findByText('AI 原始批改结果');
    expect(rawHeading).toBeInTheDocument();
    const detailPanel = rawHeading.closest(
      '.history-detail-panel'
    ) as HTMLElement;
    expect(within(detailPanel).getByText('综合评价')).toBeInTheDocument();
    expect(within(detailPanel).getByText('任务类型')).toBeInTheDocument();
    expect(within(detailPanel).getByText('markdown')).toBeInTheDocument();

    await user.click(screen.getByText(displayId(legacyWritingItem.id)));
    const feedbackHeading = await screen.findByText('详细反馈');
    const legacyDetailPanel = feedbackHeading.closest(
      '.history-detail-panel'
    ) as HTMLElement;
    expect(
      within(legacyDetailPanel).getByRole('heading', { name: '评分明细' })
    ).toBeInTheDocument();
    expect(feedbackHeading).toBeInTheDocument();
    expect(within(legacyDetailPanel).getByText('立意')).toBeInTheDocument();
  });

  it('filters records by query and type selector including raw content text', async () => {
    const user = userEvent.setup();
    mockHistoryFetch();

    renderPage();
    await screen.findByText(displayId(rawWritingItem.id));

    await user.type(
      screen.getByPlaceholderText('搜索 ID、类型、任务类型或内容...'),
      '基层治理'
    );

    expect(screen.getByText(displayId(rawWritingItem.id))).toBeInTheDocument();
    expect(
      screen.queryByText(displayId(legacyWritingItem.id))
    ).not.toBeInTheDocument();

    await user.clear(
      screen.getByPlaceholderText('搜索 ID、类型、任务类型或内容...')
    );
    await user.selectOptions(
      screen.getAllByRole('combobox')[1],
      'format-writing'
    );

    expect(
      screen.queryByText(displayId(rawWritingItem.id))
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(displayId(legacyWritingItem.id))
    ).toBeInTheDocument();
  });

  it('toggles raw detail view and copies raw response data', async () => {
    const user = userEvent.setup();
    const clipboardWrite = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWrite },
      configurable: true,
    });
    mockHistoryFetch();

    renderPage();
    await user.click(await screen.findByText(displayId(rawWritingItem.id)));

    await user.click(screen.getByRole('button', { name: '原始JSON' }));
    expect(screen.getByText('请求数据')).toBeInTheDocument();
    expect(screen.getByText('响应数据')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '结构化视图' }));
    await user.click(screen.getByRole('button', { name: '复制数据' }));

    expect(clipboardWrite).toHaveBeenCalledWith(
      expect.stringContaining('"content": "# 写作反馈结果\\n\\n## 综合评价')
    );
    expect(clipboardWrite).toHaveBeenCalledWith(
      expect.stringContaining('"contentFormat": "markdown"')
    );
    expect(await screen.findByText('已复制到剪贴板')).toBeInTheDocument();
  });

  it('refreshes and clears history with existing endpoints', async () => {
    const user = userEvent.setup();
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmMock);
    const fetchMock = mockHistoryFetch();

    renderPage();
    await screen.findByText(displayId(rawWritingItem.id));

    await user.click(screen.getByRole('button', { name: /刷新/ }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/writings/history?limit=50'),
        expect.any(Object)
      );
    });

    await user.click(screen.getByRole('button', { name: /清空全部/ }));

    expect(confirmMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/writings/history'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('shows the empty state when the history list is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse({ items: [] }))
    );

    renderPage();

    expect(await screen.findByText('暂无复盘档案')).toBeInTheDocument();
    expect(
      screen.getByText('开始第一次申论批改后，这里会沉淀你的训练记录')
    ).toBeInTheDocument();
  });

  it('shows an error state when the history request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse({}, false, 500))
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/HTTP error! status: 500/)).toBeInTheDocument();
    });
    expect(screen.getByText('暂无复盘档案')).toBeInTheDocument();
  });
});

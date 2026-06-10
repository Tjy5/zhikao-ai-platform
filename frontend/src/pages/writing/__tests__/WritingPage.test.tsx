import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { ToastProvider } from '@/components/Toast';
import {
  subscribeWritingHistoryRefresh,
  type WritingHistoryRefreshPayload,
} from '@/utils/writingHistoryRefresh';
import WritingPage from '../index';

const RAW_MARKDOWN = `# 写作反馈结果

## 任务类型判断
analysis。

## 综合评价
- 立意明确
- 结构完整
- 建议补充基层治理案例
`;

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    body: null,
    json: async () => body,
    text: async () => '',
  } as Response);

const streamResponse = (events: unknown[]) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }
      controller.close();
    },
  });

  return Promise.resolve({
    ok: true,
    status: 200,
    body,
  } as Response);
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/writing']}>
      <ToastProvider>
        <WritingPage />
      </ToastProvider>
    </MemoryRouter>
  );

const collectRefreshSignals = () => {
  const received: WritingHistoryRefreshPayload[] = [];
  const unsubscribe = subscribeWritingHistoryRefresh(payload =>
    received.push(payload)
  );
  return { received, unsubscribe };
};

const fillWritingForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(
    screen.getByLabelText(/请输入材料与要求/),
    '请围绕基层治理材料进行概括。'
  );
  await user.type(
    screen.getByLabelText(/请输入您的答案/),
    '材料反映出治理协同不足、服务响应偏慢等事项，需要完善机制。'
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('WritingPage', () => {
  it('renders the input form and initial empty result state', () => {
    renderPage();

    expect(screen.getAllByText('申论智能批改').length).toBeGreaterThan(0);
    expect(screen.getByText(/智考AI \/ 申论批改/)).toBeInTheDocument();
    expect(screen.getByText('学习工作台')).toBeInTheDocument();
    expect(screen.getByText('今日任务')).toBeInTheDocument();
    expect(screen.getByText(/材料完整/)).toBeInTheDocument();
    const navLinks = within(screen.getByLabelText('智考AI 导航')).getAllByRole(
      'link'
    );
    expect(navLinks.map(link => link.textContent)).toEqual([
      '学习首页',
      '申论学习',
      '申论批改',
      '复盘档案',
      '模型设置',
    ]);
    expect(navLinks.map(link => link.getAttribute('href'))).toEqual([
      '/',
      '/shenlun-study',
      '/writing',
      '/history',
      '/settings',
    ]);
    expect(screen.getByRole('link', { name: /查看复盘档案/ })).toHaveAttribute(
      'href',
      '/history'
    );
    expect(screen.getByLabelText(/请输入材料与要求/)).toBeInTheDocument();
    expect(screen.getByLabelText(/请输入您的答案/)).toBeInTheDocument();
    expect(screen.getByText('等待批改结果')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /开始AI批改/ })).toBeEnabled();
  });

  it('shows warning and does not call the API when task material is empty', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { received, unsubscribe } = collectRefreshSignals();

    renderPage();
    await user.type(
      screen.getByLabelText(/请输入您的答案/),
      '这是一段作答内容。'
    );
    await user.click(screen.getByRole('button', { name: /开始AI批改/ }));

    expect(await screen.findByText('请先填写材料或要求')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(received).toHaveLength(0);
    unsubscribe();
  });

  it('shows warning and does not call the API when answer text is empty', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { received, unsubscribe } = collectRefreshSignals();

    renderPage();
    await user.type(
      screen.getByLabelText(/请输入材料与要求/),
      '请围绕基层治理材料进行概括。'
    );
    await user.click(screen.getByRole('button', { name: /开始AI批改/ }));

    expect(await screen.findByText('请先填写你的作答')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(received).toHaveLength(0);
    unsubscribe();
  });

  it('renders the final result from progressive SSE grading', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() =>
      streamResponse([
        {
          stage: 1,
          message: '正在生成原始批改结果...',
          partial: true,
        },
        {
          stage: 2,
          progress: 100,
          partial: false,
          content: RAW_MARKDOWN,
          contentFormat: 'markdown',
        },
      ])
    );
    vi.stubGlobal('fetch', fetchMock);
    const { received, unsubscribe } = collectRefreshSignals();

    renderPage();
    await fillWritingForm(user);
    await user.click(screen.getByRole('button', { name: /开始AI批改/ }));

    expect(await screen.findByText('批改结果')).toBeInTheDocument();
    expect(screen.getByText('综合评价')).toBeInTheDocument();
    expect(screen.getByText('建议补充基层治理案例')).toBeInTheDocument();
    expect(screen.getByText('markdown')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(received).toHaveLength(1);
    });
    expect(received[0].trigger).toBe('writing-grading');
    expect(received[0].userId).toBeNull();
    unsubscribe();
  });

  it('falls back to one-shot grading and renders raw Markdown content', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/v1/writings/grade-progressive')) {
        return jsonResponse({}, false, 503);
      }
      return jsonResponse({
        content: RAW_MARKDOWN,
        contentFormat: 'markdown',
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { received, unsubscribe } = collectRefreshSignals();

    renderPage();
    await fillWritingForm(user);
    await user.click(screen.getByRole('button', { name: /开始AI批改/ }));

    expect(await screen.findByText('批改结果')).toBeInTheDocument();
    expect(screen.getByText('综合评价')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/v1/writings/grade-progressive'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Accept: 'text/event-stream' }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/v1/writings/grade'),
      expect.objectContaining({
        method: 'POST',
      })
    );
    await waitFor(() => {
      expect(received).toHaveLength(1);
    });
    expect(received[0].trigger).toBe('writing-grading');
    unsubscribe();
  });

  it('shows an error for progressive AI failure without one-shot retry', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() =>
      streamResponse([
        {
          stage: 'error',
          message: 'AI 服务请求超时，请稍后重试',
          classification: 'timeout',
          partial: false,
        },
      ])
    );
    vi.stubGlobal('fetch', fetchMock);
    const { received, unsubscribe } = collectRefreshSignals();

    renderPage();
    await fillWritingForm(user);
    await user.click(screen.getByRole('button', { name: /开始AI批改/ }));

    expect(
      await screen.findByText('评分失败：请检查网络或稍后重试')
    ).toBeInTheDocument();
    expect(screen.queryByText('批改结果')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(received).toHaveLength(0);
    unsubscribe();
  });

  it('does not render any partial result when a non-final event is followed by an AI error', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() =>
      streamResponse([
        {
          stage: 1,
          message: '正在生成诊断...',
          partial: true,
        },
        {
          stage: 'error',
          message: 'AI 返回结果格式异常，请稍后重试',
          classification: 'malformed_output',
          partial: false,
        },
      ])
    );
    vi.stubGlobal('fetch', fetchMock);
    const { received, unsubscribe } = collectRefreshSignals();

    renderPage();
    await fillWritingForm(user);
    await user.click(screen.getByRole('button', { name: /开始AI批改/ }));

    expect(
      await screen.findByText('评分失败：请检查网络或稍后重试')
    ).toBeInTheDocument();
    expect(screen.queryByText('批改结果')).not.toBeInTheDocument();
    expect(screen.queryByText(/正在生成诊断/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(received).toHaveLength(0);
    unsubscribe();
  });

  it('does not render a synthetic result when one-shot payload is invalid', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/v1/writings/grade-progressive')) {
        return jsonResponse({}, false, 503);
      }
      return jsonResponse({
        content: '',
        contentFormat: 'markdown',
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { received, unsubscribe } = collectRefreshSignals();

    renderPage();
    await fillWritingForm(user);
    await user.click(screen.getByRole('button', { name: /开始AI批改/ }));

    expect(
      await screen.findByText('评分失败：请检查网络或稍后重试')
    ).toBeInTheDocument();
    expect(screen.queryByText('批改结果')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(received).toHaveLength(0);
    unsubscribe();
  });
});

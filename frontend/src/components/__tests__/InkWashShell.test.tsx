import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import InkWashShell from '../InkWashShell';

describe('InkWashShell', () => {
  it('renders the ink-wash shell, navigation, title decoration, and workbench content', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/writing']}>
        <InkWashShell
          title='智能写作反馈'
          context='智能写作反馈'
          description='浅色工具页外壳'
          actions={[
            { label: '查看历史记录', to: '/history', variant: 'primary' },
          ]}
          metrics={[{ label: '状态', value: '可用' }]}
        >
          <section className='bg-paper'>工作区</section>
        </InkWashShell>
      </MemoryRouter>
    );

    expect(container.firstElementChild).toHaveClass(
      'paper-canvas',
      'retained-tone-workbench',
      'relative min-h-screen overflow-hidden'
    );
    expect(screen.getByLabelText('墨评AI 导航')).toHaveClass(
      'bg-paper-rice/80'
    );
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
    expect(screen.getAllByText('智能写作反馈').length).toBeGreaterThanOrEqual(
      2
    );
    expect(screen.getByText('学习工作台')).toBeInTheDocument();
    expect(screen.getByText('1. 拆解')).toBeInTheDocument();
    expect(screen.getByText('当前任务')).toBeInTheDocument();
    expect(screen.getByText('专注一篇')).toBeInTheDocument();
    expect(screen.getByText('工作区')).toHaveClass('bg-paper');
  });

  it('renders the shared navigation contract in the mobile menu', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/history']}>
        <InkWashShell
          title='历史记录'
          context='历史记录'
          description='浅色历史页外壳'
        >
          <section>历史工作区</section>
        </InkWashShell>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: '打开导航菜单' }));

    const mobileNavLinks = within(
      screen.getByLabelText('墨评AI 移动导航')
    ).getAllByRole('link');
    expect(mobileNavLinks.map(link => link.textContent)).toEqual([
      '首页',
      '写作反馈',
      '历史记录',
      '设置',
    ]);
    expect(mobileNavLinks.map(link => link.getAttribute('href'))).toEqual([
      '/',
      '/writing',
      '/history',
      '/settings',
    ]);
  });

  it('renders form tone with calmer chrome and without workbench-only ornaments', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <InkWashShell
          tone='form'
          title='登录'
          context='登录'
          description='登录后进入写作反馈、历史复盘和模型设置。'
        >
          <form aria-label='登录表单'>表单内容</form>
        </InkWashShell>
      </MemoryRouter>
    );

    expect(container.firstElementChild).toHaveClass(
      'retained-form-shell',
      'retained-tone-form'
    );
    expect(container.firstElementChild).not.toHaveClass('paper-canvas');

    expect(
      screen.getByRole('heading', { level: 1, name: '登录' })
    ).toBeInTheDocument();
    expect(screen.getByText('墨评AI / 登录')).toBeInTheDocument();
    expect(
      screen.getByText('登录后进入写作反馈、历史复盘和模型设置。')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('登录表单')).toBeInTheDocument();
    expect(screen.queryByText('学习工作台')).not.toBeInTheDocument();
    expect(screen.queryByText('当前任务')).not.toBeInTheDocument();
    expect(screen.queryByText('1. 拆解')).not.toBeInTheDocument();
  });

  it('renders fallback tone with minimal centered hierarchy', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/missing']}>
        <InkWashShell
          tone='fallback'
          title='墨评AI'
          context='页面未找到'
          description='页面未找到，请从导航选择入口。'
        >
          <a href='/'>返回首页</a>
        </InkWashShell>
      </MemoryRouter>
    );

    expect(container.firstElementChild).toHaveClass(
      'retained-form-shell',
      'retained-tone-fallback'
    );
    expect(
      screen.getByRole('heading', { level: 1, name: '墨评AI' })
    ).toBeInTheDocument();
    expect(screen.getByText('墨评AI / 页面未找到')).toBeInTheDocument();
    expect(
      screen.getByText('页面未找到，请从导航选择入口。')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute(
      'href',
      '/'
    );
    expect(screen.queryByText('学习工作台')).not.toBeInTheDocument();
    expect(screen.queryByText('专注一篇')).not.toBeInTheDocument();
  });
});

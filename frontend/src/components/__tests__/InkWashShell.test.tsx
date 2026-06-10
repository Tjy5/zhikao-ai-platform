import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import InkWashShell from '../InkWashShell';

describe('InkWashShell', () => {
  it('renders the civic learning shell, navigation, title decoration, and workbench content', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/writing']}>
        <InkWashShell
          title='申论智能批改'
          context='申论批改'
          description='公考学习工具页外壳'
          actions={[
            { label: '查看复盘档案', to: '/history', variant: 'primary' },
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
    expect(screen.getByLabelText('智考AI 导航')).toHaveClass(
      'bg-paper-rice/86'
    );
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
    expect(screen.getAllByText('申论智能批改').length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getByText('智考AI / 申论批改')).toBeInTheDocument();
    expect(screen.getByText('学习工作台')).toBeInTheDocument();
    expect(screen.getByText('1. 诊断')).toBeInTheDocument();
    expect(screen.getByText('今日任务')).toBeInTheDocument();
    expect(screen.getByText('专注提分')).toBeInTheDocument();
    expect(screen.getByText('工作区')).toHaveClass('bg-paper');
  });

  it('renders the shared navigation contract in the mobile menu', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/history']}>
        <InkWashShell
          title='复盘档案'
          context='复盘档案'
          description='公考复盘页外壳'
        >
          <section>复盘工作区</section>
        </InkWashShell>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: '打开导航菜单' }));

    const mobileNavLinks = within(
      screen.getByLabelText('智考AI 移动导航')
    ).getAllByRole('link');
    expect(mobileNavLinks.map(link => link.textContent)).toEqual([
      '学习首页',
      '申论学习',
      '申论批改',
      '复盘档案',
      '模型设置',
    ]);
    expect(mobileNavLinks.map(link => link.getAttribute('href'))).toEqual([
      '/',
      '/shenlun-study',
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
          description='登录后进入申论批改、复盘档案和模型设置。'
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
    expect(screen.getByText('智考AI / 登录')).toBeInTheDocument();
    expect(
      screen.getByText('登录后进入申论批改、复盘档案和模型设置。')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('登录表单')).toBeInTheDocument();
    expect(screen.queryByText('学习工作台')).not.toBeInTheDocument();
    expect(screen.queryByText('今日任务')).not.toBeInTheDocument();
    expect(screen.queryByText('1. 诊断')).not.toBeInTheDocument();
  });

  it('renders fallback tone with minimal centered hierarchy', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/missing']}>
        <InkWashShell
          tone='fallback'
          title='智考AI'
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
      screen.getByRole('heading', { level: 1, name: '智考AI' })
    ).toBeInTheDocument();
    expect(screen.getByText('智考AI / 页面未找到')).toBeInTheDocument();
    expect(
      screen.getByText('页面未找到，请从导航选择入口。')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute(
      'href',
      '/'
    );
    expect(screen.queryByText('学习工作台')).not.toBeInTheDocument();
    expect(screen.queryByText('专注提分')).not.toBeInTheDocument();
  });
});

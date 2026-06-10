import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../../../App';

const renderRoute = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('ShenlunStudyPage', () => {
  it('renders the public study page with expanded distilled knowledge modules', () => {
    const forbiddenSourceName = ['小', '马', '哥'].join('');
    const { container } = renderRoute('/shenlun-study');

    expect(
      screen.getByRole('heading', { level: 1, name: '申论学习' })
    ).toBeInTheDocument();
    expect(screen.getByText('先会读卷，再去下笔')).toBeInTheDocument();
    expect(screen.getByText('原始转写')).toBeInTheDocument();
    expect(screen.getByText('19份')).toBeInTheDocument();
    expect(screen.getByText('考场第一步：建立作答地图')).toBeInTheDocument();
    expect(screen.getByText('范围、内容、要求')).toBeInTheDocument();
    expect(screen.getByText('从材料到答案的四个动作')).toBeInTheDocument();
    expect(screen.getByText('五类题不背模板，背判断')).toBeInTheDocument();
    expect(screen.getByText('应用文格式矩阵')).toBeInTheDocument();
    expect(
      screen.getByText('确定范围，提炼论点，填充内容')
    ).toBeInTheDocument();
    expect(screen.getByText('常见误区自检')).toBeInTheDocument();

    for (const moduleTitle of [
      '归纳概括',
      '综合分析',
      '对策启示',
      '应用文',
      '大作文',
    ]) {
      expect(screen.getAllByText(moduleTitle).length).toBeGreaterThan(0);
    }

    expect(screen.getByText(/200 字题常见 4 到 5 个要点/)).toBeInTheDocument();
    expect(screen.getByText(/时间、事件、状态/)).toBeInTheDocument();
    expect(screen.getByText(/标题先含住内容/)).toBeInTheDocument();
    expect(screen.getByText(/保护、传承、利用类题/)).toBeInTheDocument();
    expect(screen.getByText(/写一篇 \/ 一份 \+ 文种/)).toBeInTheDocument();
    expect(screen.getAllByText(/翻译成答题语言/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('变形题处理').length).toBeGreaterThan(0);
    expect(container).not.toHaveTextContent(forbiddenSourceName);
  });

  it('adds the study page to retained navigation', () => {
    renderRoute('/shenlun-study');

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
  });
});

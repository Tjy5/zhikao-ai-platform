import { render, screen } from '@testing-library/react';

import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState title='暂无记录' description='完成练习后将展示分析结果' />
    );
    expect(screen.getByText('暂无记录')).toBeInTheDocument();
    expect(screen.getByText('完成练习后将展示分析结果')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';

import SectionHeader from '../SectionHeader';

describe('SectionHeader', () => {
  it('renders title and description', () => {
    render(
      <SectionHeader title='学习进度' description='了解最近一周的练习情况' />
    );
    expect(
      screen.getByRole('heading', { name: '学习进度' })
    ).toBeInTheDocument();
    expect(screen.getByText('了解最近一周的练习情况')).toBeInTheDocument();
  });
});

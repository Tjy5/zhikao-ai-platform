import React from 'react';
import { render, screen } from '@testing-library/react';

import Button from '../Button';

describe('Button', () => {
  it('renders the provided label', () => {
    render(<Button>立即开始</Button>);
    expect(
      screen.getByRole('button', { name: '立即开始' })
    ).toBeInTheDocument();
  });

  it('uses the ink-wash button treatment', () => {
    render(<Button variant='outline'>查看详情</Button>);
    const button = screen.getByRole('button', { name: '查看详情' });
    expect(button).toHaveClass(
      'border',
      'shadow-sm',
      'rounded-[6px]',
      'font-kaishu'
    );
    expect(button).toHaveClass('border-ink-light/20', 'bg-paper');
  });
});

import { render, screen } from '@testing-library/react';

import StatBadge from '../StatBadge';

describe('StatBadge', () => {
  it('displays label and value', () => {
    render(<StatBadge label='批改总数' value={12} />);
    expect(screen.getByText('批改总数')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

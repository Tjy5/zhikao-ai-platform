import { render, screen } from '@testing-library/react';

import Tag from '../Tag';

describe('Tag', () => {
  it('renders label text', () => {
    render(<Tag>数量关系</Tag>);
    expect(
      screen.getByRole('button', { name: '数量关系' })
    ).toBeInTheDocument();
  });
});

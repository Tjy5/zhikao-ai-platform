import type { Meta, StoryObj } from '@storybook/react';

import EmptyState, { type EmptyStateProps } from './EmptyState';

const meta: Meta<EmptyStateProps> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  args: {
    title: '暂无数据',
    description: '提交一次申论作答后，这里将展示批改结果与复盘档案。',
  },
};

export default meta;

type Story = StoryObj<EmptyStateProps>;

export const Basic: Story = {};

export const WithAction: Story = {
  args: {
    action: (
      <button className='rounded-md border border-ink bg-ink px-4 py-2 text-sm font-semibold text-paper shadow-sm hover:bg-ink-light'>
        去批改申论
      </button>
    ),
  },
};

export const Compact: Story = {
  args: {
    compact: true,
  },
};

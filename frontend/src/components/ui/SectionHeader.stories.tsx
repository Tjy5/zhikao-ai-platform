import type { Meta, StoryObj } from '@storybook/react';

import SectionHeader, { type SectionHeaderProps } from './SectionHeader';

const meta: Meta<SectionHeaderProps> = {
  title: 'UI/SectionHeader',
  component: SectionHeader,
  args: {
    title: '学习进度总览',
    description: '掌握弱项、规划路径，让学习更高效。',
  },
};

export default meta;

type Story = StoryObj<SectionHeaderProps>;

export const LeftAligned: Story = {};

export const CenterAligned: Story = {
  args: {
    align: 'center',
    icon: (
      <svg
        className='h-6 w-6'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={1.5}
          d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
        />
      </svg>
    ),
  },
};

export const WithAction: Story = {
  args: {
    action: (
      <button className='rounded-md border border-ink bg-paper-ivory px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-paper-rice'>
        查看全部
      </button>
    ),
  },
};

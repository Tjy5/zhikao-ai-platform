import type { Meta, StoryObj } from '@storybook/react';

import StatBadge, { type StatBadgeProps } from './StatBadge';

const meta: Meta<StatBadgeProps> = {
  title: 'UI/StatBadge',
  component: StatBadge,
  args: {
    label: '已批改',
    value: 42,
    tone: 'green',
    trend: 'up',
    trendValue: '12%',
    badgeText: '比上周提升',
  },
};

export default meta;

type Story = StoryObj<StatBadgeProps>;

export const Default: Story = {};

export const Warning: Story = {
  args: {
    label: '待复盘',
    value: 18,
    tone: 'amber',
    trend: 'down',
    trendValue: '5%',
  },
};

export const Neutral: Story = {
  args: {
    label: '批改总数',
    value: 320,
    tone: 'blue',
    trend: 'neutral',
    trendValue: '本周',
    badgeText: undefined,
  },
};

import type { Meta, StoryObj } from '@storybook/react';

import Button, { type ButtonProps } from './Button';

const meta: Meta<ButtonProps> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'primary',
        'secondary',
        'outline',
        'ghost',
        'destructive',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
  },
  args: {
    children: '立即开始',
  },
};

export default meta;

type Story = StoryObj<ButtonProps>;

export const Primary: Story = {
  args: {
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: '查看更多',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: '了解规范',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: '暂不可用',
  },
};

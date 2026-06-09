import type { Meta, StoryObj } from '@storybook/react';

import Tag, { type TagProps } from './Tag';

const meta: Meta<TagProps> = {
  title: 'UI/Tag',
  component: Tag,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'radio',
      options: ['subtle', 'outline'],
    },
    size: {
      control: 'radio',
      options: ['sm', 'md'],
    },
  },
  args: {
    children: '逻辑判断',
  },
};

export default meta;

type Story = StoryObj<TagProps>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    selected: true,
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
  },
};

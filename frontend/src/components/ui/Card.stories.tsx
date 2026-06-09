import type { Meta, StoryObj } from '@storybook/react';

import { Card, CardContent, CardFooter, CardHeader } from './Card';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof Card>;

export const Playground: Story = {
  render: args => (
    <Card {...args} style={{ width: 360 }}>
      <CardHeader>
        <h3 className='text-lg font-semibold text-foreground'>写作提升计划</h3>
        <p className='text-sm text-muted-foreground'>根据近期批改结果生成</p>
      </CardHeader>
      <CardContent>
        <ul className='space-y-2 text-sm text-foreground'>
          <li>· 每日修改一段答案</li>
          <li>· 每周复盘批改建议 2 次</li>
          <li>· 周末完成一篇完整写作</li>
        </ul>
      </CardContent>
      <CardFooter>
        <span className='text-primary font-semibold'>下次复盘：周六</span>
      </CardFooter>
    </Card>
  ),
};

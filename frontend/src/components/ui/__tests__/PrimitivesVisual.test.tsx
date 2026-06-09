import { render, screen } from '@testing-library/react';

import { Badge } from '../Badge';
import { Card, CardContent } from '../Card';
import { Input } from '../Input';
import { TabsList, TabsTrigger } from '../Tabs';
import { Textarea } from '../Textarea';

describe('Ink-Wash primitive styling', () => {
  it('renders ink-wash card, form controls, badge, and active tab states', () => {
    render(
      <div>
        <Card>
          <CardContent>学习卡片</CardContent>
        </Card>
        <Input placeholder='输入任务' />
        <Textarea placeholder='输入答案' />
        <Badge>重点</Badge>
        <TabsList>
          <TabsTrigger isActive>学习分析</TabsTrigger>
        </TabsList>
      </div>
    );

    const card = screen.getByText('学习卡片').parentElement;
    expect(card).toHaveClass(
      'retained-surface',
      'border',
      'shadow-sm',
      'bg-paper-ivory'
    );
    expect(screen.getByPlaceholderText('输入任务')).toHaveClass(
      'retained-input',
      'border',
      'shadow-sm',
      'bg-paper-ivory'
    );
    expect(screen.getByPlaceholderText('输入答案')).toHaveClass(
      'retained-input',
      'border',
      'shadow-sm'
    );
    expect(screen.getByText('重点')).toHaveClass('border');
    expect(screen.getByRole('button', { name: '学习分析' })).toHaveClass(
      'bg-paper'
    );
  });
});

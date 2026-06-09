'use client';

import { CheckCircle2, FileText, Loader2 } from 'lucide-react';

import type { RawWritingFeedbackResult } from '../../../types';
import EmptyState from '../../../components/ui/EmptyState';
import ResultsDisplay from './ResultsDisplay';

interface WritingResultPanelProps {
  result: RawWritingFeedbackResult | null;
  isLoading: boolean;
  statusText: string;
}

export default function WritingResultPanel({
  result,
  isLoading,
  statusText,
}: WritingResultPanelProps) {
  return (
    <section className='ink-panel min-h-[520px] overflow-hidden'>
      {!result ? (
        <WritingEmptyState isLoading={isLoading} statusText={statusText} />
      ) : (
        <div className='p-5 sm:p-6 lg:p-8'>
          <ResultsDisplay result={result} />
        </div>
      )}
    </section>
  );
}

interface WritingEmptyStateProps {
  isLoading: boolean;
  statusText: string;
}

function WritingEmptyState({ isLoading, statusText }: WritingEmptyStateProps) {
  if (isLoading) {
    return (
      <div className='animate-pulse p-5 sm:p-6 lg:p-8'>
        <div className='mb-6 flex items-center justify-between'>
          <span className='rounded-[4px] border border-ink-light/15 bg-paper-rice/70 px-3 py-1 font-kaishu text-sm text-ink'>
            正在生成 Markdown 批改结果
          </span>
          <span className='rounded-[4px] border border-ink-light/10 bg-paper/70 px-3 py-1 font-kaishu text-xs text-ink-wash'>
            AI 生成中
          </span>
        </div>
        <div className='space-y-4 rounded-[6px] border border-ink-light/15 bg-paper/90 p-6'>
          <div className='h-6 w-3/5 rounded-[3px] bg-paper-rice' />
          <div className='h-4 w-full rounded-[3px] bg-paper-rice' />
          <div className='h-4 w-11/12 rounded-[3px] bg-paper-rice' />
          <div className='h-4 w-10/12 rounded-[3px] bg-paper-rice' />
          <div className='mt-6 h-4 w-2/3 rounded-[3px] bg-paper-rice' />
          <div className='h-4 w-full rounded-[3px] bg-paper-rice' />
          <div className='h-4 w-9/12 rounded-[3px] bg-paper-rice' />
        </div>

        <div className='mt-6 text-center'>
          <div className='font-kaishu text-lg text-ink-wash'>
            AI 正在生成可直接阅读的 Markdown 结果...
          </div>
          <div className='mt-2 text-sm text-ink-wash/70'>{statusText}</div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full min-h-[520px] items-center justify-center p-6 lg:p-8'>
      <div className='w-full max-w-md'>
        <div className='mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-paper-rice/80'>
          {isLoading ? (
            <Loader2 className='h-10 w-10 animate-spin text-ink' />
          ) : (
            <FileText className='h-10 w-10 text-seal-red' />
          )}
        </div>
        <EmptyState
          title='等待批改结果'
          description='请先在左侧输入任务和答案'
          compact
          className='w-full border-0 bg-transparent shadow-none'
          icon={
            isLoading ? (
              <Loader2 className='h-16 w-16 animate-spin text-ink' />
            ) : (
              <CheckCircle2 className='h-16 w-16 text-ink-wash/40' />
            )
          }
        />
        <div className='mt-5 grid grid-cols-3 gap-2'>
          {['任务类型', '评语', '建议'].map(item => (
            <span
              key={item}
              className='rounded-[4px] border border-ink-light/10 bg-paper/70 px-3 py-2 text-center font-kaishu text-xs text-ink'
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { CheckCircle2, FileText } from 'lucide-react';

import MarkdownContent from '../../../components/MarkdownContent';
import type { RawWritingFeedbackResult } from '../../../types';

interface ResultsDisplayProps {
  result: RawWritingFeedbackResult;
  className?: string;
}

export default function ResultsDisplay({
  result,
  className = '',
}: ResultsDisplayProps) {
  return (
    <div className={`animate-fade-in ${className}`}>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <h2 className='flex items-center font-running-script text-4xl font-normal text-ink'>
          <span className='mr-3 flex h-10 w-10 items-center justify-center rounded-[4px] border border-ink-light/15 bg-paper/80 text-ink shadow-sm'>
            <CheckCircle2 className='h-5 w-5' aria-hidden='true' />
          </span>
          批改结果
        </h2>
        <div className='inline-flex items-center gap-2 rounded-[4px] border border-ink-light/15 bg-paper/80 px-3 py-1 font-kaishu text-sm text-ink'>
          <FileText className='h-4 w-4' aria-hidden='true' />
          {result.contentFormat || 'markdown'}
        </div>
      </div>

      <div className='rounded-[6px] border border-ink-light/15 bg-paper/90 p-5 shadow-sm sm:p-6 lg:p-8'>
        <MarkdownContent content={result.content} className='text-ink' />
      </div>
    </div>
  );
}

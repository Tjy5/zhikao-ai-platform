/**
 * 详细反馈组件
 * 展示AI批改的详细反馈内容
 */

'use client';

import { formatTextToHtml } from '../../../utils';

interface FeedbackSectionProps {
  feedback: string;
  className?: string;
}

export default function FeedbackSection({
  feedback,
  className = '',
}: FeedbackSectionProps) {
  if (!feedback) {
    return null;
  }

  return (
    <div
      className={`notebook-lines rounded-[6px] border border-ink-light/15 bg-paper/90 p-6 shadow-sm ${className}`}
    >
      <div className='mb-5 flex flex-wrap items-center gap-2'>
        <span className='rounded-[4px] border border-ink-light/15 bg-paper-rice/70 px-3 py-1 font-kaishu text-sm text-ink'>
          详细反馈
        </span>
        <span className='rounded-[4px] border border-ink-light/10 bg-paper/70 px-3 py-1 font-kaishu text-xs text-ink-wash'>
          逐条对照修改
        </span>
      </div>
      {/* 反馈内容 */}
      <div className='text-ink'>
        <div
          className='ai-feedback-content'
          style={{ lineHeight: '1.9' }}
          dangerouslySetInnerHTML={{
            __html: formatTextToHtml(feedback),
          }}
        />
      </div>

      {/* 反馈来源标识 */}
      <div className='mt-6 border-t border-ink-light/15 pt-4'>
        <div className='flex flex-col gap-3 font-kaishu text-sm text-ink-wash sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center'>
            <div className='mr-2 h-2 w-2 rounded-[2px] bg-landscape-green'></div>
            <span>AI 专业批改反馈</span>
          </div>
          <div className='flex items-center'>
            <svg
              className='mr-1 h-4 w-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <span>请结合评分明细复核</span>
          </div>
        </div>
      </div>
    </div>
  );
}

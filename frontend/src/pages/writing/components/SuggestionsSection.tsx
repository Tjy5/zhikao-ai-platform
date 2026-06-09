/**
 * 改进建议组件
 * 展示AI提供的改进建议列表
 */

'use client';

import { formatTextToHtml } from '../../../utils';

interface SuggestionsSectionProps {
  suggestions: string[];
  className?: string;
}

export default function SuggestionsSection({
  suggestions,
  className = '',
}: SuggestionsSectionProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={`notebook-lines rounded-[6px] border border-ink-light/15 bg-paper/90 p-6 shadow-sm ${className}`}
    >
      <div className='mb-5 flex flex-wrap items-center gap-2'>
        <span className='rounded-[4px] border border-ink-light/15 bg-paper-rice/70 px-3 py-1 font-kaishu text-sm text-ink'>
          改进清单
        </span>
        <span className='rounded-[4px] border border-ink-light/10 bg-paper/70 px-3 py-1 font-kaishu text-xs text-ink-wash'>
          一次重点改 1-2 个
        </span>
      </div>
      <ul className='space-y-5'>
        {suggestions.map((suggestion, index) => (
          <li key={index} className='flex items-start'>
            {/* 序号圆圈 */}
            <div className='mr-4 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[4px] border border-seal-red/25 bg-peach-soft/70 shadow-sm'>
              <span className='text-sm font-bold text-seal-red'>
                {index + 1}
              </span>
            </div>

            {/* 建议内容 */}
            <div className='flex-1'>
              <div
                className='text-ink'
                style={{ lineHeight: '1.8' }}
                dangerouslySetInnerHTML={{
                  __html: formatTextToHtml(suggestion),
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* 建议总结 */}
      <div className='mt-8 rounded-[6px] border border-ink-light/15 bg-ink/5 p-4'>
        <h4 className='mb-2 flex items-center font-kaishu text-sm text-ink'>
          <svg
            className='mr-2 h-4 w-4'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
            />
          </svg>
          重点改进方向
        </h4>
        <p className='font-kaishu text-sm leading-7 text-ink-wash'>
          建议按列表顺序处理，每次修改先聚焦 1-2
          个事项，再回到要求和评分明细检查是否落实。
        </p>
      </div>
    </div>
  );
}

import {
  FileText,
  History as HistoryIcon,
  Inbox,
  Layers,
  Tag,
} from 'lucide-react';
import type { HistoryItem } from '../types';
import { getHistoryContentPreview } from '../utils';

interface HistoryListProps {
  items: HistoryItem[];
  loading: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export default function HistoryList({
  items,
  loading,
  selectedId,
  onSelect,
}: HistoryListProps) {
  return (
    <section className='history-list-panel overflow-hidden'>
      <div className='border-b border-ink-light/10 p-5 sm:p-6'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <h2 className='flex items-center font-running-script text-4xl font-normal text-ink'>
            <span className='mr-3 flex h-10 w-10 items-center justify-center rounded-[4px] border border-ink-light/15 bg-paper/70 text-ink shadow-sm'>
              <HistoryIcon className='h-5 w-5' aria-hidden='true' />
            </span>
            最近记录
          </h2>
          <span className='rounded-[4px] border border-ink-light/15 bg-paper/80 px-3 py-1 font-kaishu text-xs text-ink'>
            时间排序
          </span>
          {loading && (
            <div className='font-kaishu text-base text-ink-wash'>加载中...</div>
          )}
        </div>
      </div>

      <div className='max-h-[820px] overflow-y-auto p-5 sm:p-6'>
        {loading && items.length === 0 && (
          <div className='space-y-4'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`loading-${index}`}
                className='animate-pulse rounded-[6px] border border-ink-light/10 bg-paper/60 p-6'
              >
                <div className='mb-3 h-4 w-24 rounded-[3px] bg-paper-rice'></div>
                <div className='h-3 w-32 rounded-[3px] bg-paper-rice'></div>
              </div>
            ))}
          </div>
        )}

        {(!loading || items.length > 0) && (
          <div className='relative space-y-3'>
            <div
              className='absolute bottom-3 left-[17px] top-3 w-px bg-gradient-to-b from-transparent via-ink-light/20 to-transparent'
              aria-hidden='true'
            />
            {items.map((item, index) => (
              <HistoryListItem
                key={item.id}
                item={item}
                index={index}
                isSelected={selectedId === item.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        {items.length === 0 && !loading && (
          <div className='py-20 text-center'>
            <Inbox
              className='mx-auto mb-4 h-12 w-12 text-ink-wash/40'
              aria-hidden='true'
            />
            <div className='mb-2 font-kaishu text-lg text-ink-wash'>
              暂无复盘档案
            </div>
            <div className='text-base text-ink-wash/70'>
              开始第一次申论批改后，这里会沉淀你的训练记录
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function HistoryListItem({
  item,
  index,
  isSelected,
  onSelect,
}: {
  item: HistoryItem;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const timestamp = item.timestamp ? new Date(item.timestamp) : null;
  const timestampText = timestamp ? timestamp.toLocaleString() : '未知时间';
  const score = typeof item.score === 'number' ? item.score : null;
  const contentPreview = getHistoryContentPreview(item.content, 92);

  return (
    <button
      type='button'
      className={`group history-record-card relative w-full p-0 text-left transition-all duration-200 focus-visible:ring-4 focus-visible:ring-ring/35 ${
        isSelected
          ? 'history-record-card-active ring-2 ring-seal-red/20'
          : 'hover:-translate-y-0.5 hover:border-ink-light/30'
      }`}
      onClick={() => onSelect(item.id)}
    >
      <div className='flex items-start gap-3 p-4'>
        <span
          className={`mt-1 flex h-9 w-9 flex-none items-center justify-center rounded-full border font-running-script text-xl leading-none ${
            isSelected
              ? 'border-seal-red/40 bg-seal-red/10 text-seal-red'
              : 'border-ink-light/15 bg-paper/70 text-ink-wash'
          }`}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className='min-w-0 flex-1'>
          <div className='mb-1 flex items-center justify-between gap-3'>
            <div className='truncate font-kaishu text-sm text-ink-wash'>
              {timestampText}
            </div>
            {score !== null && (
              <div className='font-running-script text-2xl leading-none text-seal-red'>
                {score.toFixed(1)}分
              </div>
            )}
          </div>

          <div className='mb-2 flex flex-wrap items-center gap-2'>
            {item.type && (
              <span className='inline-flex max-w-full min-w-0 items-center gap-1 rounded-[4px] bg-peach-soft/70 px-2 py-0.5 font-kaishu text-xs text-ink'>
                <Layers className='h-3 w-3' aria-hidden='true' />
                <span className='break-all'>{item.type}</span>
              </span>
            )}
            {item.taskType && (
              <span className='inline-flex max-w-full min-w-0 items-center gap-1 rounded-[4px] bg-jade-soft/70 px-2 py-0.5 font-kaishu text-xs text-ink'>
                <Tag className='h-3 w-3' aria-hidden='true' />
                <span className='break-all'>{item.taskType}</span>
              </span>
            )}
            {score === null && item.contentFormat && (
              <span className='inline-flex max-w-full min-w-0 items-center gap-1 rounded-[4px] bg-sky-soft/70 px-2 py-0.5 font-kaishu text-xs text-ink'>
                <FileText className='h-3 w-3' aria-hidden='true' />
                <span className='break-all'>{item.contentFormat}</span>
              </span>
            )}
          </div>

          {contentPreview && (
            <div className='mb-2 truncate text-sm leading-6 text-ink-wash'>
              {contentPreview}
            </div>
          )}

          <div className='truncate font-mono text-xs text-ink-wash'>
            {item.id.substring(0, 16)}...
          </div>
        </div>
      </div>
    </button>
  );
}

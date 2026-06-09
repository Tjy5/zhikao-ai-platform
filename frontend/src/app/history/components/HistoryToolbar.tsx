import { Home, RefreshCw, Trash2 } from 'lucide-react';
import Link from '@/components/AppLink';

interface HistoryToolbarProps {
  loading: boolean;
  deleting: boolean;
  onRefresh: () => void;
  onClearAll: () => void;
}

export default function HistoryToolbar({
  loading,
  deleting,
  onRefresh,
  onClearAll,
}: HistoryToolbarProps) {
  return (
    <div className='history-toolbar mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex flex-wrap items-center gap-3'>
        <Link
          href='/'
          className='ink-hover history-tool-button inline-flex items-center justify-center gap-2 rounded-[4px] px-4 py-2 font-kaishu text-base text-ink transition-all hover:-translate-y-0.5'
        >
          <Home className='h-4 w-4' aria-hidden='true' />
          返回首页
        </Link>
        <button
          onClick={onRefresh}
          className='ink-hover history-tool-button inline-flex items-center justify-center gap-2 rounded-[4px] px-4 py-2 font-kaishu text-base text-ink transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60'
          disabled={loading}
          type='button'
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden='true'
          />
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>
      <button
        onClick={onClearAll}
        className='ink-hover history-tool-button history-tool-button-danger inline-flex items-center justify-center gap-2 rounded-[4px] px-4 py-2 font-kaishu text-base text-seal-red transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60'
        disabled={deleting}
        type='button'
      >
        <Trash2 className='h-4 w-4' aria-hidden='true' />
        {deleting ? '清空中...' : '清空全部'}
      </button>
    </div>
  );
}

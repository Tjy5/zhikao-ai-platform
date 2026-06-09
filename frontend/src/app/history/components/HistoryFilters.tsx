import { Search } from 'lucide-react';

interface HistoryFiltersProps {
  query: string;
  typeFilter: string;
  qtypeFilter: string;
  typeOptions: string[];
  qtypeOptions: string[];
  filteredCount: number;
  onQueryChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onQtypeFilterChange: (value: string) => void;
}

export default function HistoryFilters({
  query,
  typeFilter,
  qtypeFilter,
  typeOptions,
  qtypeOptions,
  filteredCount,
  onQueryChange,
  onTypeFilterChange,
  onQtypeFilterChange,
}: HistoryFiltersProps) {
  return (
    <section className='history-filter-panel mb-8 p-5 sm:p-6'>
      <div className='mb-5 flex items-center justify-between gap-4'>
        <div>
          <div className='flex flex-wrap items-center gap-3'>
            <p className='font-semi-cursive text-3xl text-ink'>筛选记录</p>
            <span className='rounded-[4px] border border-ink-light/15 bg-paper-rice/70 px-3 py-1 font-kaishu text-xs text-ink'>
              按条件检索
            </span>
          </div>
          <div className='dry-brush mt-2 h-[2px] w-28' aria-hidden='true' />
        </div>
        <div className='rounded-[4px] border border-ink-light/15 bg-paper/80 px-4 py-2 font-kaishu text-base text-ink'>
          共 <span className='text-ink'>{filteredCount}</span> 条记录
        </div>
      </div>
      <div className='flex flex-col gap-5 xl:flex-row xl:items-center'>
        <div className='relative min-w-0 flex-1'>
          <Search
            className='pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-wash/50'
            aria-hidden='true'
          />
          <input
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder='搜索 ID、类型、任务类型或内容...'
            className='w-full rounded-[4px] border border-ink-light/20 bg-paper/75 px-12 py-4 font-kaishu text-base text-ink shadow-none outline-none transition-colors placeholder:text-ink-wash/50 focus:border-ink focus:ring-4 focus:ring-seal/20'
          />
        </div>
        <div className='flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center'>
          <label className='flex items-center gap-3 font-kaishu text-base text-ink'>
            类型
            <select
              className='rounded-[4px] border border-ink-light/20 bg-paper/75 px-4 py-3 font-kaishu text-base text-ink shadow-none outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-seal/20'
              value={typeFilter}
              onChange={event => onTypeFilterChange(event.target.value)}
            >
              <option value='all'>全部</option>
              {typeOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className='flex items-center gap-3 font-kaishu text-base text-ink'>
            任务类型
            <select
              className='rounded-[4px] border border-ink-light/20 bg-paper/75 px-4 py-3 font-kaishu text-base text-ink shadow-none outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-seal/20'
              value={qtypeFilter}
              onChange={event => onQtypeFilterChange(event.target.value)}
            >
              <option value='all'>全部</option>
              {qtypeOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}

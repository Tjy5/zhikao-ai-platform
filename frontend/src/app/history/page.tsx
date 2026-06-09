'use client';

import InkWashShell from '../../components/InkWashShell';
import ErrorBanner from './components/ErrorBanner';
import HistoryDetailPanel from './components/HistoryDetailPanel';
import HistoryFilters from './components/HistoryFilters';
import HistoryList from './components/HistoryList';
import HistoryToolbar from './components/HistoryToolbar';
import { useToast } from '../../components/Toast';
import { useHistoryRecords } from './hooks/useHistoryRecords';

export default function HistoryPage() {
  const toast = useToast();
  const history = useHistoryRecords(toast);

  const selectedLabel = history.selected ? '已选择' : '待选择';

  return (
    <InkWashShell
      title='历史记录'
      context='历史记录'
      description='集中查看写作反馈记录，按时间、类型和任务类型筛选，展开原始 Markdown、历史 JSON 与兼容旧结构。'
      actions={[
        { label: '开始写作反馈', to: '/writing', variant: 'primary' },
        { label: '返回首页', to: '/', variant: 'secondary' },
      ]}
      metrics={[
        { label: '已加载', value: String(history.items.length) },
        { label: '筛选结果', value: String(history.filteredItems.length) },
        { label: '详情', value: selectedLabel },
      ]}
    >
      <div className='history-workbench'>
        <section className='history-overview-panel mb-8 overflow-hidden px-5 py-6 sm:px-8 lg:px-10'>
          <div className='flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
            <div className='max-w-2xl'>
              <div className='mb-3 flex items-center gap-3'>
                <span className='seal-mark text-lg'>历</span>
                <span className='font-semi-cursive text-3xl text-ink'>
                  历史复盘
                </span>
                <span className='rounded-[4px] border border-ink-light/15 bg-paper-rice/70 px-3 py-1 font-kaishu text-xs text-ink'>
                  评分明细
                </span>
              </div>
              <p className='font-kaishu text-lg leading-9 text-ink-wash'>
                按时间、类型和任务类型筛选记录，右侧查看原始 Markdown、兼容旧记录和原始 JSON。
              </p>
              <div className='mt-5 flex flex-wrap gap-2'>
                {['记录筛选', '原始内容', '历史 JSON', '兼容旧记录'].map(item => (
                  <span
                    key={item}
                    className='rounded-[4px] border border-ink-light/10 bg-paper/70 px-3 py-1.5 font-kaishu text-xs text-ink'
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <HistoryToolbar
          loading={history.loading}
          deleting={history.deleting}
          onRefresh={history.loadList}
          onClearAll={history.clearAll}
        />

        <ErrorBanner error={history.error} />

        <HistoryFilters
          query={history.query}
          typeFilter={history.typeFilter}
          qtypeFilter={history.qtypeFilter}
          typeOptions={history.typeOptions}
          qtypeOptions={history.qtypeOptions}
          filteredCount={history.filteredItems.length}
          onQueryChange={history.setQuery}
          onTypeFilterChange={history.setTypeFilter}
          onQtypeFilterChange={history.setQtypeFilter}
        />

        <div className='history-content-grid grid grid-cols-1 gap-8 p-3 sm:p-5 xl:grid-cols-[minmax(280px,0.76fr)_minmax(0,1.64fr)] xl:items-start'>
          <HistoryList
            items={history.filteredItems}
            loading={history.loading}
            selectedId={history.selected?.id}
            onSelect={history.loadDetail}
          />
          <HistoryDetailPanel
            selected={history.selected}
            showRaw={history.showRaw}
            onToggleRaw={() => history.setShowRaw(value => !value)}
            onCopy={history.copyJSON}
          />
        </div>
      </div>
    </InkWashShell>
  );
}

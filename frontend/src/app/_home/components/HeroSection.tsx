import { Link } from 'react-router-dom';
import type { HomeStats } from '../hooks/useHomeStats';
import InkWashNav from '../../../components/InkWashNav';
import { getRetainedRouteTopNavLinks } from '../../../components/topNavigation';
import { workflowLabels } from '../data/homeContent';
import InkCompanionHeroPanel from './InkCompanionHeroPanel';

const homeNavLinks = getRetainedRouteTopNavLinks('/');

type HeroSectionProps = {
  stats: HomeStats;
};

export default function HeroSection({ stats }: HeroSectionProps) {
  const statItems = [
    {
      label: '批改记录',
      value: stats.loading ? '--' : String(stats.totalWritings),
      helper: stats.loading ? '同步中…' : '来自反馈历史',
    },
    {
      label: '平均分',
      value: stats.loading ? '--' : String(stats.averageScore),
      helper: stats.loading ? '统计中…' : '来自批改历史',
    },
    {
      label: '服务流程',
      value: 'AI',
      helper: '提交 · 批改 · 复盘',
    },
  ];

  return (
    <section
      id='home'
      aria-labelledby='home-hero-title'
      className='paper-canvas relative flex min-h-screen flex-col overflow-hidden text-ink'
    >
      <div className='pointer-events-none absolute inset-0' aria-hidden='true'>
        <div className='ink-wash-landscape absolute inset-x-0 bottom-0 h-[52vh] opacity-82' />
        <div className='ink-bleed absolute left-[8%] top-[38%] h-48 w-48 opacity-35' />
        <div className='ink-bleed absolute right-[12%] top-[18%] h-64 w-64 opacity-28' />
        <div className='absolute bottom-0 left-0 right-0 h-[28vh] bg-gradient-to-t from-paper via-paper/82 to-transparent' />
      </div>

      <InkWashNav variant='light' links={homeNavLinks} />

      <div className='relative z-10 mx-auto grid w-full max-w-[1600px] flex-1 items-center gap-10 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.62fr)] lg:px-10 lg:pt-32'>
        <div className='max-w-[840px]'>
          <div className='mb-5 flex flex-wrap items-center gap-3'>
            <p className='font-semi-cursive text-2xl text-ink-wash sm:text-3xl'>
              留白为卷，墨色成章
            </p>
            <span className='rounded-[6px] border border-ink-light/12 bg-paper/74 px-3 py-1 font-kaishu text-sm text-ink'>
              写作工作台
            </span>
          </div>
          <div className='relative inline-block'>
            <h1
              id='home-hero-title'
              className='font-cursive-title text-[48px] font-normal leading-[0.96] tracking-normal text-ink sm:text-[68px] md:text-[84px] xl:text-[100px]'
            >
              <span className='block'>墨评AI</span>
              <span className='block'>智能写作反馈</span>
            </h1>
            <span
              aria-hidden='true'
              className='seal-mark absolute -right-8 top-1/2 hidden -translate-y-1/2 text-2xl lg:block xl:-right-14'
            >
              专注
            </span>
          </div>

          <p className='mt-5 seal-mark text-xl lg:hidden'>专注</p>
          <div
            className='dry-brush mt-6 h-[4px] w-72 max-w-full'
            aria-hidden='true'
          />

          <div className='mt-7 max-w-2xl font-kaishu text-lg leading-9 text-ink-wash sm:text-xl'>
            上传材料与作答内容，系统生成评分、评语与修改建议，帮助你复盘每一次写作训练。
          </div>

          <div className='mt-6 flex flex-wrap gap-2'>
            {workflowLabels.map(note => (
              <span
                key={note}
                className='rounded-[6px] border border-ink-light/10 bg-paper/78 px-4 py-2 font-kaishu text-sm text-ink'
              >
                {note}
              </span>
            ))}
          </div>

          <div className='mt-9 flex flex-col gap-3 sm:flex-row'>
            <Link
              to='/writing'
              className='ink-hover rounded-[6px] border border-ink bg-ink px-7 py-4 text-center font-kaishu text-lg text-paper shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-ink-light focus-visible:ring-2 focus-visible:ring-seal/30'
            >
              开始写作反馈
            </Link>
            <Link
              to='/history'
              className='ink-hover rounded-[6px] border border-ink-light/20 bg-paper-rice/82 px-7 py-4 text-center font-kaishu text-lg text-ink shadow-sm transition duration-300 hover:border-ink hover:bg-paper focus-visible:ring-2 focus-visible:ring-seal/30'
            >
              查看历史记录
            </Link>
          </div>

          <div className='mt-10 grid max-w-3xl gap-3 sm:grid-cols-3'>
            {statItems.map(card => (
              <div key={card.label} className='retained-surface-soft px-4 py-4'>
                <p className='font-kaishu text-sm text-ink-wash'>
                  {card.label}
                </p>
                <p className='mt-2 font-running-script text-4xl font-normal leading-none text-ink'>
                  {card.value}
                </p>
                <p className='mt-2 text-xs text-ink-wash/80'>{card.helper}</p>
              </div>
            ))}
          </div>
        </div>

        <aside
          className='relative hidden min-h-[540px] lg:flex lg:items-center lg:justify-end'
          aria-hidden='true'
        >
          <InkCompanionHeroPanel />
        </aside>
      </div>

      <div
        className='relative z-10 flex justify-center pb-8'
        aria-hidden='true'
      >
        <div className='flex animate-bounce flex-col items-center text-ink-wash/60'>
          <span className='mb-2 font-kaishu text-xs tracking-[0.24em]'>
            了解功能
          </span>
          <svg
            className='h-5 w-5'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth={2}
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M19 9l-7 7-7-7'
            />
          </svg>
        </div>
      </div>
    </section>
  );
}

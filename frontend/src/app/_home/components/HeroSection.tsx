import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  ClipboardCheck,
  Gauge,
  Sparkles,
  Target,
} from 'lucide-react';
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
      label: '申论批改',
      value: stats.loading ? '--' : String(stats.totalWritings),
      helper: stats.loading ? '同步训练档案' : '已沉淀作答记录',
      icon: ClipboardCheck,
    },
    {
      label: '平均得分',
      value: stats.loading ? '--' : String(stats.averageScore || 0),
      helper: stats.loading ? '计算能力画像' : '来自历史批改',
      icon: Gauge,
    },
    {
      label: '学习节奏',
      value: '4',
      helper: '诊断 · 训练 · 批改 · 复盘',
      icon: BarChart3,
    },
  ];

  const focusItems = [
    { label: '行测刷题', value: '模块化', icon: Target },
    { label: '申论精批', value: '逐段建议', icon: BookOpenCheck },
    { label: '错因归档', value: '趋势复盘', icon: BrainCircuit },
  ];

  return (
    <section
      id='home'
      aria-labelledby='home-hero-title'
      className='civic-hero-grid relative flex min-h-screen flex-col overflow-hidden bg-background text-ink'
    >
      <div className='pointer-events-none absolute inset-0' aria-hidden='true'>
        <div className='absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-paper-ivory/95 to-transparent' />
        <div className='civic-signal-field civic-signal-field-primary absolute right-[-5rem] top-24 h-[32rem] w-[34rem]' />
        <div className='civic-signal-field civic-signal-field-secondary absolute bottom-[-8rem] left-[-6rem] h-[30rem] w-[36rem]' />
        <div className='absolute inset-x-0 bottom-0 h-[26vh] bg-gradient-to-t from-paper via-paper/80 to-transparent' />
      </div>

      <InkWashNav variant='light' links={homeNavLinks} />

      <div className='relative z-10 mx-auto grid w-full max-w-[1600px] flex-1 items-center gap-10 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[minmax(0,0.96fr)_minmax(420px,0.72fr)] lg:px-10 lg:pt-32 xl:gap-16'>
        <div className='max-w-[900px]'>
          <div className='mb-6 flex flex-wrap items-center gap-3'>
            <p className='inline-flex items-center gap-2 rounded-[6px] border border-civic-blue/15 bg-civic-blue/8 px-3 py-2 font-kaishu text-sm text-civic-blue shadow-sm'>
              <Sparkles className='h-4 w-4' aria-hidden='true' />
              AI 驱动的公考备考工作台
            </p>
            <span className='rounded-[6px] border border-ink-light/10 bg-paper/80 px-3 py-2 font-kaishu text-sm text-ink-wash'>
              行测 · 申论 · 复盘
            </span>
          </div>

          <h1
            id='home-hero-title'
            aria-label='智能公考学习平台'
            className='max-w-[860px] font-cursive-title text-[48px] font-normal leading-[0.98] tracking-normal text-ink sm:text-[68px] md:text-[82px] xl:text-[96px]'
          >
            <span className='block'>智能公考</span>
            <span className='block text-civic-blue'>学习平台</span>
          </h1>

          <p className='mt-7 max-w-2xl font-kaishu text-lg leading-9 text-ink-wash sm:text-xl'>
            围绕公务员考试的长期备考路径，把训练计划、申论批改、历史复盘和模型配置放进同一个学习指挥舱。
          </p>

          <div className='mt-7 flex flex-wrap gap-2'>
            {workflowLabels.map((note, index) => (
              <span
                key={note}
                className='rounded-[6px] border border-ink-light/10 bg-paper/82 px-4 py-2 font-kaishu text-sm text-ink shadow-sm'
              >
                {index + 1}. {note}
              </span>
            ))}
          </div>

          <div className='mt-10 flex flex-col gap-3 sm:flex-row'>
            <Link
              to='/writing'
              className='ink-hover inline-flex items-center justify-center gap-3 rounded-[6px] border border-civic-blue bg-civic-blue px-7 py-4 text-center font-kaishu text-lg text-paper shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-civic-blue-dark focus-visible:ring-2 focus-visible:ring-civic-blue/30'
            >
              开始申论批改
              <ArrowRight className='h-5 w-5' aria-hidden='true' />
            </Link>
            <Link
              to='/history'
              className='ink-hover inline-flex items-center justify-center gap-3 rounded-[6px] border border-ink-light/18 bg-paper-rice/88 px-7 py-4 text-center font-kaishu text-lg text-ink shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-civic-blue/40 hover:bg-paper focus-visible:ring-2 focus-visible:ring-civic-blue/30'
            >
              查看复盘档案
            </Link>
          </div>

          <div className='mt-10 grid max-w-4xl gap-3 sm:grid-cols-3'>
            {statItems.map(card => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className='retained-surface-soft px-4 py-4'
                >
                  <div className='mb-3 flex items-center justify-between gap-3'>
                    <p className='font-kaishu text-sm text-ink-wash'>
                      {card.label}
                    </p>
                    <Icon
                      className='h-4 w-4 text-civic-blue'
                      aria-hidden='true'
                    />
                  </div>
                  <p className='font-running-script text-4xl font-normal leading-none text-ink'>
                    {card.value}
                  </p>
                  <p className='mt-2 text-xs text-ink-wash/80'>{card.helper}</p>
                </div>
              );
            })}
          </div>

          <div className='mt-6 grid max-w-4xl gap-3 sm:grid-cols-3'>
            {focusItems.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className='flex items-center justify-between gap-3 rounded-[6px] border border-ink-light/10 bg-paper/72 px-4 py-3 shadow-sm backdrop-blur'
                >
                  <span className='inline-flex items-center gap-2 font-kaishu text-sm text-ink'>
                    <Icon
                      className='h-4 w-4 text-seal-red'
                      aria-hidden='true'
                    />
                    {item.label}
                  </span>
                  <span className='font-kaishu text-xs text-ink-wash'>
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <aside
          className='relative hidden min-h-[560px] lg:flex lg:items-center lg:justify-end'
          aria-hidden='true'
        >
          <InkCompanionHeroPanel stats={stats} />
        </aside>
      </div>

      <div
        className='relative z-10 flex justify-center pb-8'
        aria-hidden='true'
      >
        <div className='flex animate-bounce flex-col items-center text-ink-wash/60'>
          <span className='mb-2 font-kaishu text-xs tracking-[0.24em]'>
            查看学习路径
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

import {
  ArrowUpRight,
  ChevronRight,
  FileText,
  History,
  Home,
  Settings,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { pageCards } from '../data/homeContent';
import type { HomeStats } from '../hooks/useHomeStats';
import { Card } from '../../../components/ui/Card';

type CollectionSectionProps = {
  stats: HomeStats;
};

const cardIcons = {
  学习首页: Home,
  申论批改: FileText,
  复盘档案: History,
  模型设置: Settings,
} as const;

export default function CollectionSection({ stats }: CollectionSectionProps) {
  const metricValue = (metric: (typeof pageCards)[number]['metric']) => {
    if (metric === 'totalWritings')
      return stats.loading ? '--' : String(stats.totalWritings);
    if (metric === 'home') return '总览';
    if (metric === 'settings') return '模型';
    return '复盘';
  };

  return (
    <section
      id='features'
      aria-labelledby='home-features-title'
      className='relative overflow-hidden bg-paper px-5 py-16 text-ink sm:px-8 lg:px-12 lg:py-20'
    >
      <div className='pointer-events-none absolute inset-0' aria-hidden='true'>
        <div className='civic-signal-field civic-signal-field-secondary absolute left-[-10rem] top-16 h-72 w-80 opacity-60' />
        <div className='absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-civic-blue/20 to-transparent' />
      </div>
      <div className='relative z-10 mx-auto max-w-[1600px]'>
        <div className='mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
          <div>
            <div className='mb-4 flex flex-wrap items-center gap-3'>
              <p className='font-semi-cursive text-2xl text-civic-blue sm:text-3xl'>
                备考模块
              </p>
              <span className='rounded-[4px] border border-ink-light/15 bg-paper-rice/80 px-3 py-1 font-kaishu text-sm text-ink'>
                核心功能
              </span>
            </div>
            <h2
              id='home-features-title'
              aria-label='智能公考学习平台核心功能'
              className='font-cursive-title text-[40px] font-normal leading-[1.05] tracking-normal text-ink sm:text-[52px] lg:text-[64px]'
            >
              <span className='block'>训练、批改、复盘</span>
              <span className='block lg:pl-20'>
                <span className='font-running-script normal-case text-seal-red'>
                  AI
                </span>{' '}
                <span>同屏协作</span>
              </span>
            </h2>
            <div
              className='dry-brush mt-5 h-[3px] w-56 max-w-full'
              aria-hidden='true'
            />
          </div>

          <Link
            to='/writing'
            className='group inline-flex w-fit items-center gap-3 rounded-[6px] border border-civic-blue/18 bg-civic-blue/8 px-4 py-3 transition duration-300 hover:-translate-y-0.5 hover:bg-paper focus-visible:ring-2 focus-visible:ring-civic-blue/35'
          >
            <span className='font-running-script text-3xl text-ink'>
              进入申论批改
            </span>
            <ChevronRight
              aria-hidden='true'
              className='h-5 w-5 text-civic-blue transition group-hover:text-seal-red'
            />
          </Link>
        </div>

        <div className='grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4'>
          {pageCards.map(card => {
            const Icon = cardIcons[card.title as keyof typeof cardIcons];
            return (
              <article
                key={card.title}
                className='group transition duration-300 hover:-translate-y-0.5 focus-within:-translate-y-0.5'
              >
                <Card className='ink-panel relative flex h-full min-h-[290px] flex-col justify-between overflow-hidden p-6 shadow-none'>
                  <div>
                    <div className='mb-5 flex items-start justify-between gap-4'>
                      <span className='flex h-12 w-12 items-center justify-center rounded-[6px] border border-civic-blue/14 bg-civic-blue/8 text-civic-blue'>
                        <Icon className='h-5 w-5' aria-hidden='true' />
                      </span>
                      <span className='rounded-[4px] border border-ink-light/15 bg-paper-rice/76 px-3 py-1 font-kaishu text-xs text-ink-wash'>
                        {card.badge}
                      </span>
                    </div>
                    <h3 className='font-running-script text-3xl font-normal leading-none text-ink sm:text-4xl'>
                      {card.title}
                    </h3>
                    <p className='mt-4 max-w-[20rem] font-kaishu text-base leading-7 text-ink-wash'>
                      {card.subtitle}
                    </p>
                  </div>
                  <div className='mt-6 flex items-center justify-between gap-4 border-t border-ink-light/10 pt-5'>
                    <div>
                      <p className='font-kaishu text-sm text-ink-wash'>
                        {card.metricLabel}
                      </p>
                      <p className='mt-2 font-running-script text-3xl font-normal leading-none text-ink'>
                        {metricValue(card.metric)}
                      </p>
                    </div>
                    <Link
                      to={card.href}
                      aria-label={`打开${card.title}`}
                      className='ink-hover flex h-11 w-11 flex-none items-center justify-center rounded-[4px] border border-civic-blue bg-civic-blue text-paper shadow-sm transition duration-300 hover:bg-civic-blue-dark focus-visible:ring-2 focus-visible:ring-civic-blue/30'
                    >
                      <ArrowUpRight aria-hidden='true' className='h-5 w-5' />
                    </Link>
                  </div>
                </Card>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

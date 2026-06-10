import { ArrowRight, ClipboardCheck, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ctaLines, workflowLabels } from '../data/homeContent';

export default function FinalCtaSection() {
  return (
    <section
      id='contact'
      aria-labelledby='home-cta-title'
      className='relative overflow-hidden border-t border-ink-light/12 bg-paper text-ink'
    >
      <div
        className='absolute inset-0 bg-gradient-to-l from-civic-blue/8 via-paper-rice/20 to-paper-ivory/40'
        aria-hidden='true'
      />
      <div
        className='civic-signal-field civic-signal-field-primary absolute right-10 top-12 h-64 w-80 opacity-60'
        aria-hidden='true'
      />

      <div className='relative z-10 mx-auto w-full max-w-[1600px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20'>
        <div className='grid gap-8 rounded-[8px] border border-ink-light/10 bg-paper/82 p-6 shadow-sm backdrop-blur sm:p-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(320px,0.38fr)] lg:items-center'>
          <div>
            <p className='font-kaishu text-sm text-civic-blue'>继续训练</p>
            <h2
              id='home-cta-title'
              className='mt-3 font-cursive-title text-3xl font-normal leading-[1.1] tracking-normal sm:text-5xl lg:text-6xl'
            >
              {ctaLines.map((line, index) => (
                <span
                  key={line}
                  className={
                    index === 0
                      ? 'mb-2 block text-ink sm:mb-4'
                      : 'block text-ink-wash'
                  }
                >
                  {line}
                </span>
              ))}
            </h2>
            <div
              className='mt-6 h-[3px] w-64 max-w-full dry-brush'
              aria-hidden='true'
            />
            <div className='mt-5 flex flex-wrap gap-2'>
              {workflowLabels.map(item => (
                <span
                  key={item}
                  className='rounded-[4px] border border-ink-light/10 bg-paper-rice/68 px-3 py-1 font-kaishu text-sm text-ink'
                >
                  {item}
                </span>
              ))}
            </div>
            <div className='mt-7 flex flex-col gap-3 sm:flex-row'>
              <Link
                to='/writing'
                className='ink-hover inline-flex items-center justify-center gap-2 rounded-[6px] border border-civic-blue bg-civic-blue px-6 py-3 font-kaishu text-base text-paper shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-civic-blue-dark focus-visible:ring-2 focus-visible:ring-civic-blue/30'
              >
                <ClipboardCheck className='h-4 w-4' aria-hidden='true' />
                开始申论批改
                <ArrowRight className='h-4 w-4' aria-hidden='true' />
              </Link>
              <Link
                to='/history'
                className='ink-hover inline-flex items-center justify-center gap-2 rounded-[6px] border border-ink-light/18 bg-paper px-6 py-3 font-kaishu text-base text-ink shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-civic-blue/35 hover:bg-paper-rice focus-visible:ring-2 focus-visible:ring-civic-blue/30'
              >
                <History className='h-4 w-4' aria-hidden='true' />
                查看复盘档案
              </Link>
            </div>
          </div>

          <div className='grid gap-3'>
            {[
              ['01', '提交申论作答'],
              ['02', '查看评分明细'],
              ['03', '提炼下一次训练重点'],
            ].map(([num, label]) => (
              <div
                key={num}
                className='flex items-center justify-between gap-4 rounded-[6px] border border-ink-light/10 bg-paper-ivory/72 px-4 py-4'
              >
                <span className='font-serif-fallback text-xs text-seal-red'>
                  {num}
                </span>
                <span className='font-kaishu text-sm text-ink'>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { ctaLines, workflowLabels } from '../data/homeContent';

export default function FinalCtaSection() {
  return (
    <section
      id='contact'
      aria-labelledby='home-cta-title'
      className='relative overflow-hidden border-t border-ink-light/15 bg-paper text-ink'
    >
      <div
        className='absolute inset-0 bg-gradient-to-l from-paper-rice/50 via-paper-rice/15 to-paper-ivory/30'
        aria-hidden='true'
      />
      <div
        className='ink-bleed absolute right-10 top-12 h-64 w-64 opacity-18'
        aria-hidden='true'
      />

      <div className='relative z-10 mx-auto w-full max-w-[1600px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20'>
        <div className='ml-auto grid max-w-[820px] gap-6 text-right lg:grid-cols-[200px_minmax(0,1fr)] lg:items-center'>
          <div className='hidden text-left lg:block'>
            <p className='seal-mark text-3xl'>继续</p>
            <p className='mt-2 font-running-script text-2xl text-ink'>
              写作训练
            </p>
          </div>
          <div>
            <p className='font-kaishu text-sm text-seal-red'>开始批改</p>
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
              className='ml-auto mt-6 h-[3px] w-64 max-w-full dry-brush'
              aria-hidden='true'
            />
            <div className='mt-5 flex flex-wrap justify-end gap-2'>
              {workflowLabels.map(item => (
                <span
                  key={item}
                  className='rounded-[4px] border border-ink-light/10 bg-paper-rice/60 px-3 py-1 font-kaishu text-sm text-ink'
                >
                  {item}
                </span>
              ))}
            </div>
            <Link
              to='/writing'
              className='ink-hover mt-7 inline-flex rounded-[6px] border border-ink bg-ink px-6 py-3 font-kaishu text-base text-paper shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-ink-light focus-visible:ring-2 focus-visible:ring-seal/30'
            >
              立即提交写作
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

import type { ReactNode } from 'react';
import { ArrowRight, BookOpenCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import InkWashNav from './InkWashNav';
import { getRetainedRouteTopNavLinks } from './topNavigation';

export type ShellTone = 'workbench' | 'form' | 'fallback';

export interface ShellAction {
  label: string;
  to: string;
  variant?: 'primary' | 'secondary';
}

export interface ShellMetric {
  label: string;
  value: string;
}

interface InkWashShellProps {
  title: string;
  context: string;
  description: string;
  tone?: ShellTone;
  actions?: ShellAction[];
  metrics?: ShellMetric[];
  navLinks?: ReadonlyArray<{ label: string; href: string }>;
  navCta?: { label: string; href: string };
  children?: ReactNode;
}

const workflowSteps = ['拆解', '评分', '建议', '复盘'] as const;

export default function InkWashShell({
  title,
  context,
  description,
  tone = 'workbench',
  actions = [],
  metrics = [],
  navLinks,
  navCta,
  children,
}: InkWashShellProps) {
  const location = useLocation();
  const resolvedNavLinks =
    navLinks ?? getRetainedRouteTopNavLinks(location.pathname);
  const isWorkbench = tone === 'workbench';
  const isForm = tone === 'form';
  const isFallback = tone === 'fallback';
  const showSideCard =
    isWorkbench && (actions.length > 0 || metrics.length > 0);

  const shellBackgroundClass = isWorkbench
    ? 'paper-canvas'
    : 'retained-form-shell';

  return (
    <div
      className={cn(
        shellBackgroundClass,
        `retained-tone-${tone}`,
        'relative min-h-screen overflow-hidden text-ink'
      )}
    >
      <div className='pointer-events-none absolute inset-0' aria-hidden='true'>
        <div className='absolute inset-0 bg-paper/72' />
        {isWorkbench && (
          <>
            <div className='ink-wash-landscape absolute inset-x-0 top-0 h-[22rem] opacity-60' />
            <div className='ink-bleed absolute -left-20 top-60 h-56 w-56 opacity-22' />
            <div className='ink-bleed absolute -right-16 bottom-14 h-64 w-64 opacity-18' />
          </>
        )}
        {isForm && (
          <div className='ink-bleed absolute -right-24 -top-10 h-72 w-72 opacity-15' />
        )}
      </div>

      <InkWashNav variant='light' links={resolvedNavLinks} cta={navCta} />

      <div
        className={cn(
          'relative z-10 mx-auto w-full px-4 sm:px-6 lg:px-8',
          isWorkbench && 'max-w-[1600px] pb-14 pt-28 lg:pt-32',
          isForm && 'max-w-5xl pb-16 pt-28 lg:pt-32',
          isFallback &&
            'flex min-h-[60vh] max-w-3xl flex-col items-center justify-center pb-12 pt-28 text-center lg:pt-32'
        )}
      >
        {isFallback ? (
          <FallbackHeader
            title={title}
            context={context}
            description={description}
          />
        ) : (
          <header
            className={cn(
              'mb-10',
              showSideCard
                ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-end'
                : 'flex flex-col gap-4'
            )}
          >
            {isWorkbench && (
              <WorkbenchHeader
                title={title}
                context={context}
                description={description}
              />
            )}
            {isForm && (
              <FormHeader
                title={title}
                context={context}
                description={description}
              />
            )}
            {showSideCard && (
              <WorkbenchSideCard actions={actions} metrics={metrics} />
            )}
          </header>
        )}

        {children}
      </div>
    </div>
  );
}

interface HeaderProps {
  title: string;
  context: string;
  description: string;
}

function WorkbenchHeader({ title, context, description }: HeaderProps) {
  return (
    <div className='max-w-3xl'>
      <div className='mb-5 flex flex-wrap items-center gap-3'>
        <p className='rounded-[6px] border border-ink-light/12 bg-paper/74 px-4 py-2 font-kaishu text-sm text-ink shadow-sm'>
          墨评AI / {context}
        </p>
        <span className='rounded-[6px] border border-ink-light/12 bg-paper-rice/78 px-3 py-1 font-kaishu text-sm text-ink'>
          学习工作台
        </span>
      </div>
      <div className='relative inline-block'>
        <h1 className='font-cursive-title text-[44px] font-normal leading-[1] tracking-normal text-ink sm:text-[60px] lg:text-[76px]'>
          {title}
        </h1>
        <span
          aria-hidden='true'
          className='seal-mark absolute -right-8 top-1/2 hidden -translate-y-1/2 text-xl lg:block xl:-right-14'
        >
          {context}
        </span>
      </div>
      <p aria-hidden='true' className='mt-3 seal-mark text-xl lg:hidden'>
        {context}
      </p>
      <div className='dry-brush mt-5 h-[3px] w-44' aria-hidden='true' />
      <p className='mt-5 max-w-2xl font-kaishu text-base leading-8 text-ink-wash sm:text-lg'>
        {description}
      </p>
      <div className='mt-5 flex flex-wrap gap-2'>
        {workflowSteps.map((label, index) => (
          <span
            key={label}
            className='rounded-[6px] border border-ink-light/10 bg-paper/80 px-3 py-1 font-kaishu text-xs text-ink'
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function FormHeader({ title, context, description }: HeaderProps) {
  return (
    <div className='text-center sm:text-left'>
      <p className='inline-flex rounded-[6px] border border-ink-light/12 bg-paper/74 px-3 py-1 font-kaishu text-xs text-ink shadow-sm'>
        墨评AI / {context}
      </p>
      <h1 className='mt-4 font-running-script text-4xl font-normal leading-tight text-ink sm:text-5xl'>
        {title}
      </h1>
      <div
        className='retained-form-divider mt-4 w-32 sm:mx-0 mx-auto'
        aria-hidden='true'
      />
      <p className='mt-4 font-kaishu text-base leading-7 text-ink-wash sm:text-[1.05rem]'>
        {description}
      </p>
    </div>
  );
}

function FallbackHeader({ title, context, description }: HeaderProps) {
  return (
    <div className='flex flex-col items-center'>
      <p className='inline-flex rounded-[6px] border border-ink-light/12 bg-paper/74 px-3 py-1 font-kaishu text-xs text-ink shadow-sm'>
        墨评AI / {context}
      </p>
      <h1 className='mt-5 font-cursive-title text-5xl font-normal leading-tight text-ink sm:text-6xl'>
        {title}
      </h1>
      <div className='retained-form-divider mt-5 w-40' aria-hidden='true' />
      <p className='mt-5 font-kaishu text-base leading-7 text-ink-wash sm:text-lg'>
        {description}
      </p>
    </div>
  );
}

interface WorkbenchSideCardProps {
  actions: ShellAction[];
  metrics: ShellMetric[];
}

function WorkbenchSideCard({ actions, metrics }: WorkbenchSideCardProps) {
  return (
    <aside className='retained-surface p-5'>
      <div className='mb-4 flex items-center justify-between gap-4 border-b border-ink-light/10 px-1 pb-4'>
        <div>
          <p className='font-kaishu text-sm text-seal-red'>当前任务</p>
          <p className='mt-1 font-running-script text-3xl text-ink'>专注一篇</p>
        </div>
        <span className='flex h-14 w-14 items-center justify-center rounded-full bg-peach-soft/48'>
          <BookOpenCheck className='h-5 w-5 text-ink/70' />
        </span>
      </div>
      {metrics.length > 0 && (
        <div className='mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1'>
          {metrics.map(metric => (
            <div
              key={metric.label}
              className='retained-surface-soft flex items-end justify-between gap-3 rounded-[8px] px-3 py-3 text-sm text-ink'
            >
              <span className='font-kaishu text-sm text-ink-wash'>
                {metric.label}
              </span>
              <span className='font-running-script text-3xl font-normal leading-none text-ink'>
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      )}
      {actions.length > 0 && (
        <div className='flex flex-col gap-2 sm:flex-row lg:flex-col'>
          {actions.map(action => (
            <Link
              key={`${action.to}-${action.label}`}
              to={action.to}
              className={cn(
                'ink-hover inline-flex items-center justify-center gap-2 rounded-[6px] border px-5 py-3 font-kaishu text-base transition duration-200 focus-visible:ring-2 focus-visible:ring-seal/30',
                action.variant === 'primary'
                  ? 'border-ink bg-ink text-paper shadow-sm hover:-translate-y-0.5 hover:bg-ink-light'
                  : 'border-ink-light/30 bg-paper-rice text-ink hover:-translate-y-0.5 hover:bg-paper'
              )}
            >
              {action.label}
              <ArrowRight className='h-4 w-4' aria-hidden='true' />
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}

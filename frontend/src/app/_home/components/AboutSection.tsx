import {
  BrainCircuit,
  ClipboardList,
  FilePenLine,
  RotateCcw,
} from 'lucide-react';
import { workflowLabels } from '../data/homeContent';

const processCards = [
  {
    title: '诊断薄弱项',
    description: '把历史批改、作答习惯和错因沉淀为可读的能力画像。',
    icon: BrainCircuit,
  },
  {
    title: '专项训练',
    description: '围绕行测模块、申论题型和近期薄弱点安排训练节奏。',
    icon: ClipboardList,
  },
  {
    title: '智能批改',
    description: '对材料理解、答案结构、表达质量和得分点进行分层反馈。',
    icon: FilePenLine,
  },
  {
    title: '复盘提分',
    description: '从每一次作答中提炼可复用策略，形成下一轮训练重点。',
    icon: RotateCcw,
  },
] as const;

export default function AboutSection() {
  return (
    <section
      id='process'
      aria-labelledby='home-process-title'
      className='relative overflow-hidden bg-paper-ivory text-ink'
    >
      <div className='pointer-events-none absolute inset-0' aria-hidden='true'>
        <div className='absolute left-0 right-0 top-0 h-[30vh] bg-gradient-to-b from-paper via-paper-ivory to-transparent' />
        <div className='civic-scanline absolute inset-x-0 top-0 h-full opacity-70' />
      </div>

      <div className='relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-12 px-5 py-16 sm:px-8 lg:px-12 lg:py-24'>
        <div className='flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between'>
          <div className='relative max-w-[700px]'>
            <div className='mb-4 flex flex-wrap items-center gap-3'>
              <p className='font-semi-cursive text-2xl text-civic-blue sm:text-3xl'>
                从刷题到上岸路径
              </p>
              <span className='rounded-[4px] border border-ink-light/15 bg-paper-rice/80 px-3 py-1 font-kaishu text-sm text-ink'>
                学习闭环
              </span>
            </div>
            <h2
              id='home-process-title'
              className='font-cursive-title text-[40px] font-normal leading-[1.05] tracking-normal text-ink sm:text-[52px] lg:text-[64px]'
            >
              <span className='block'>先看清短板</span>
              <span className='block'>再安排训练</span>
            </h2>
            <p className='mt-5 font-kaishu text-base leading-8 text-ink-wash sm:text-lg'>
              平台不只给一次批改结果，而是把每次训练接入同一套备考闭环：诊断、练习、反馈、复盘，让下一步学习更具体。
            </p>
          </div>

          <div className='ink-panel max-w-[460px] p-5 lg:p-6'>
            <p className='font-kaishu text-sm text-civic-blue'>当前学习链路</p>
            <div
              className='retained-form-divider mt-3 w-full'
              aria-hidden='true'
            />
            <div className='mt-4 grid grid-cols-2 gap-2'>
              {workflowLabels.map(label => (
                <span
                  key={label}
                  className='rounded-[4px] border border-ink-light/10 bg-paper/80 px-3 py-2 text-center font-kaishu text-sm text-ink'
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {processCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className='workflow-step-card px-5 py-5'>
                <div className='flex items-start justify-between gap-4'>
                  <span className='font-serif-fallback text-xs text-seal-red'>
                    0{index + 1}
                  </span>
                  <span className='flex h-10 w-10 items-center justify-center rounded-[6px] border border-civic-blue/14 bg-civic-blue/8 text-civic-blue'>
                    <Icon className='h-5 w-5' aria-hidden='true' />
                  </span>
                </div>
                <p className='mt-4 font-running-script text-3xl text-ink'>
                  {card.title}
                </p>
                <p className='mt-3 font-kaishu text-sm leading-6 text-ink-wash'>
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

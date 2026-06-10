import {
  Activity,
  BookMarked,
  CheckCircle2,
  Radar,
  TrendingUp,
} from 'lucide-react';
import type { HomeStats } from '../hooks/useHomeStats';

const inkCompanionLayeredAssets = {
  scholarForeground:
    '/images/ink-companion/optimized/ink-scholar-companion-foreground.webp',
} as const;

const moduleScores = [
  { label: '资料分析', value: 82 },
  { label: '判断推理', value: 74 },
  { label: '申论概括', value: 68 },
  { label: '文章写作', value: 76 },
] as const;

const todayTasks = [
  '完成一套申论小题',
  '复盘 3 个扣分点',
  '更新模型连通性',
] as const;

type InkCompanionHeroPanelProps = {
  stats: HomeStats;
};

export default function InkCompanionHeroPanel({
  stats,
}: InkCompanionHeroPanelProps) {
  const average = stats.loading ? '--' : String(stats.averageScore || 0);
  const writings = stats.loading ? '--' : String(stats.totalWritings);

  return (
    <div
      className='ink-companion-stage relative mx-auto h-[560px] w-full max-w-[560px]'
      data-testid='ink-companion-hero'
      data-companion-identity='civil-service-learning-dashboard'
      data-companion-source='selected-chatgpt-static'
      data-layered-scene='civic-study-dashboard-scene'
    >
      <div
        className='ink-companion-scene absolute inset-0 overflow-hidden'
        data-testid='ink-companion-layered-scene'
        data-scene-role='integrated-civic-learning-scene'
      >
        <div className='ink-companion-scene-wash ink-companion-scene-wash-left absolute -left-10 top-8 h-[72%] w-[58%]' />
        <div className='ink-companion-scene-wash ink-companion-scene-wash-right absolute -right-10 top-14 h-[64%] w-[52%]' />

        <div className='absolute left-6 top-2 z-[9] rounded-[6px] border border-civic-blue/18 bg-paper/92 px-4 py-3 shadow-sm backdrop-blur'>
          <p className='font-kaishu text-xs text-ink-wash'>今日学习状态</p>
          <div className='mt-2 flex items-end gap-2'>
            <span className='font-running-script text-4xl leading-none text-civic-blue'>
              {average}
            </span>
            <span className='pb-1 font-kaishu text-sm text-ink-wash'>
              平均分
            </span>
          </div>
        </div>

        <div className='absolute right-7 top-16 z-[9] rounded-[6px] border border-seal-red/18 bg-paper/90 px-4 py-3 shadow-sm backdrop-blur'>
          <p className='font-kaishu text-xs text-ink-wash'>训练档案</p>
          <div className='mt-2 flex items-end gap-2'>
            <span className='font-running-script text-4xl leading-none text-seal-red'>
              {writings}
            </span>
            <span className='pb-1 font-kaishu text-sm text-ink-wash'>篇</span>
          </div>
        </div>

        <img
          src={inkCompanionLayeredAssets.scholarForeground}
          alt=''
          aria-hidden='true'
          width={1254}
          height={1254}
          decoding='async'
          draggable={false}
          data-layer='scholar-foreground'
          className='ink-companion-layer ink-companion-layer-scholar absolute left-4 top-24 h-[322px] w-[258px] object-contain'
        />

        <div className='absolute bottom-5 left-5 right-5 z-[7]'>
          <div className='ink-companion-flow-card p-5'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='inline-flex items-center gap-2 font-kaishu text-sm text-civic-blue'>
                  <Radar className='h-4 w-4' aria-hidden='true' />
                  能力画像
                </p>
                <p className='mt-2 font-running-script text-4xl text-ink'>
                  公考备考指挥舱
                </p>
                <p className='mt-3 max-w-[20rem] font-kaishu text-base leading-7 text-ink-wash'>
                  自动汇总训练结果，提示薄弱模块，并把申论批改沉淀为下一次作答策略。
                </p>
              </div>

              <span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-[6px] border border-civic-blue/18 bg-civic-blue/8 text-civic-blue'>
                <Activity className='h-5 w-5' aria-hidden='true' />
              </span>
            </div>

            <div className='mt-5 grid grid-cols-2 gap-2'>
              {moduleScores.map(score => (
                <div
                  key={score.label}
                  className='rounded-[6px] border border-ink-light/10 bg-paper/72 px-3 py-3'
                >
                  <div className='flex items-center justify-between gap-2'>
                    <span className='font-kaishu text-xs text-ink-wash'>
                      {score.label}
                    </span>
                    <span className='font-kaishu text-xs text-civic-blue'>
                      {score.value}
                    </span>
                  </div>
                  <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-ink/8'>
                    <div
                      className='h-full rounded-full bg-civic-blue'
                      style={{ width: `${score.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className='mt-5 rounded-[6px] border border-ink-light/10 bg-paper-ivory/70 p-3'>
              <div className='mb-3 flex items-center justify-between gap-3'>
                <span className='inline-flex items-center gap-2 font-kaishu text-sm text-ink'>
                  <BookMarked
                    className='h-4 w-4 text-seal-red'
                    aria-hidden='true'
                  />
                  今日任务
                </span>
                <span className='inline-flex items-center gap-1 font-kaishu text-xs text-ink-wash'>
                  <TrendingUp className='h-3.5 w-3.5' aria-hidden='true' />
                  提分路径
                </span>
              </div>
              <div className='grid gap-2'>
                {todayTasks.map(task => (
                  <span
                    key={task}
                    className='inline-flex items-center gap-2 font-kaishu text-sm text-ink-wash'
                  >
                    <CheckCircle2
                      className='h-4 w-4 text-civic-green'
                      aria-hidden='true'
                    />
                    {task}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { workflowLabels } from '../data/homeContent';

export default function AboutSection() {
  return (
    <section
      id='process'
      aria-labelledby='home-process-title'
      className='relative overflow-hidden bg-paper-ivory text-ink'
    >
      <div className='pointer-events-none absolute inset-0' aria-hidden='true'>
        <div className='absolute left-0 right-0 top-0 h-[30vh] bg-gradient-to-b from-paper via-paper-ivory to-transparent' />
        <div className='ink-bleed absolute bottom-[10%] left-[15%] h-44 w-[36vw] opacity-22' />
      </div>

      <div className='relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-12 px-5 py-16 sm:px-8 lg:px-12 lg:py-24'>
        <div className='flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between'>
          <div className='relative max-w-[640px]'>
            <div className='mb-4 flex flex-wrap items-center gap-3'>
              <p className='font-semi-cursive text-2xl text-ink-wash sm:text-3xl'>
                从作答到复盘
              </p>
              <span className='rounded-[4px] border border-ink-light/15 bg-paper-rice/70 px-3 py-1 font-kaishu text-sm text-ink'>
                写作流程
              </span>
            </div>
            <h2
              id='home-process-title'
              className='font-cursive-title text-[40px] font-normal leading-[1.05] tracking-normal text-ink sm:text-[52px] lg:text-[64px]'
            >
              <span className='block'>先提交作答</span>
              <span className='block'>再复盘反馈</span>
            </h2>
            <p className='mt-5 font-kaishu text-base leading-8 text-ink-wash sm:text-lg'>
              围绕写作训练的核心步骤组织内容：准备材料、提交答案、查看评分与建议，再从历史记录中复盘改进。
            </p>
          </div>

          <div className='ink-panel max-w-[420px] p-5 lg:p-6'>
            <p className='font-kaishu text-sm text-seal-red'>关键节点</p>
            <div
              className='retained-form-divider mt-3 w-full'
              aria-hidden='true'
            />
            <div className='mt-4 grid grid-cols-2 gap-2'>
              {workflowLabels.map(label => (
                <span
                  key={label}
                  className='rounded-[4px] border border-ink-light/10 bg-paper/70 px-3 py-2 text-center font-kaishu text-sm text-ink'
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-3'>
          {workflowLabels.map((label, index) => (
            <div key={label} className='workflow-step-card px-5 py-5'>
              <span className='font-serif-fallback text-xs text-seal-red'>
                0{index + 1}
              </span>
              <div className='mt-3 flex items-end justify-between gap-3'>
                <p className='font-running-script text-3xl text-ink'>{label}</p>
                <span className='rounded-[4px] border border-ink-light/15 bg-paper/75 px-2 py-1 font-kaishu text-xs text-ink-wash'>
                  步骤
                </span>
              </div>
              <p className='mt-3 font-kaishu text-sm leading-6 text-ink-wash'>
                {index === 0
                  ? '填写材料和答案，形成完整作答。'
                  : index === 1
                    ? '查看评分、评语和修改方向。'
                    : '回看批改记录，沉淀改进重点。'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

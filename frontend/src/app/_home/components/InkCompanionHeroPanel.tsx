const inkCompanionLayeredAssets = {
  scholarForeground:
    '/images/ink-companion/optimized/ink-scholar-companion-foreground.webp',
} as const;

const learningFlowSteps = ['提交作答', '智能批改', '历史复盘'] as const;

export default function InkCompanionHeroPanel() {
  return (
    <div
      className='ink-companion-stage relative mx-auto h-[540px] w-full max-w-[520px]'
      data-testid='ink-companion-hero'
      data-companion-identity='human'
      data-companion-source='selected-chatgpt-static'
      data-layered-scene='scholar-only-scene'
    >
      <div
        className='ink-companion-scene absolute inset-0 overflow-hidden'
        data-testid='ink-companion-layered-scene'
        data-scene-role='integrated-layered-companion-scene'
      >
        <div className='ink-companion-paper-grain absolute inset-0' />

        <div className='ink-companion-scene-wash ink-companion-scene-wash-left absolute -left-10 top-8 h-[72%] w-[58%]' />

        <div className='ink-companion-scene-wash ink-companion-scene-wash-right absolute -right-10 top-14 h-[64%] w-[52%]' />

        <div className='ink-companion-mist ink-companion-mist-a absolute left-2 top-10 h-48 w-48 rounded-full bg-ink-wash/10 blur-3xl' />

        <div className='ink-companion-mist ink-companion-mist-b absolute bottom-24 right-4 h-60 w-60 rounded-full bg-landscape-green/10 blur-3xl' />

        <img
          src={inkCompanionLayeredAssets.scholarForeground}
          alt=''
          aria-hidden='true'
          width={1254}
          height={1254}
          decoding='async'
          draggable={false}
          data-layer='scholar-foreground'
          className='ink-companion-layer ink-companion-layer-scholar absolute left-0 top-4 h-[374px] w-[300px] object-contain'
        />

        <div className='ink-companion-flow-shell absolute bottom-5 left-5 right-5'>
          <div className='ink-companion-flow-card p-5'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='font-running-script text-4xl text-ink'>
                  批改流程
                </p>

                <p className='mt-3 font-kaishu text-lg leading-8 text-ink-wash'>
                  阅读材料、提交作答、查看反馈，复盘每一次写作训练。
                </p>
              </div>

              <span className='seal-mark shrink-0 text-2xl'>静学</span>
            </div>

            <div className='mt-5 grid grid-cols-2 gap-2'>
              {learningFlowSteps.map(step => (
                <span
                  key={step}
                  className='rounded-[4px] border border-ink-light/10 bg-paper/70 px-2 py-2 text-center font-kaishu text-sm text-ink'
                >
                  {step}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

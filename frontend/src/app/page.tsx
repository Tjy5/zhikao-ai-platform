import { Link } from 'react-router-dom';
import { CommandBar } from '../components/CommandBar';
import { Pin } from '../components/ui/Pin';
import { GradingReport } from '../components/grading/GradingReport';
import { useAuth } from '../hooks/useAuth';

/**
 * / — LandingPage. design.md §10.11 + direction-v3-home.html (visual truth).
 *
 * Public page: renders its own `<CommandBar variant="public">` and
 * `<main id="main-content">` (the global skip-link target). It makes NO
 * authenticated API calls — it is pure presentational marketing that mirrors
 * the real product's report-card structure. Auth-aware CTAs route logged-in
 * users into the workspace instead of asking them to register again.
 *
 * Composition (matches direction-v3-home.html section-for-section):
 *  1. Hero — left thesis (结构化批改 in oxblood) + value line + CTA + trust
 *     badges; right a REAL report-card mockup (not a stock illustration).
 *  2. The loop — four-step closed loop (写 → 改 → 盘 → 进), a genuine sequence.
 *  3. Report showcase (#demo) — the real GradingReport fed a static 5-section
 *     sample that matches the backend's guaranteed markdown contract.
 *  4. Final CTA — register (or 去写作台 when already authed).
 *  5. Minimal footer.
 */

/**
 * Static sample grading markdown for the showcase. Mirrors the backend's
 * guaranteed 5-section contract (writing-feedback-benchmark.json
 * `required_sections`): 任务类型判断 / 综合评价 / 亮点 / 改进建议 / 参考优化.
 * Presentational only — NOT fetched from any API, no fake score/dimensions.
 */
const SAMPLE_FEEDBACK = `# 写作反馈结果

## 任务类型判断
综合分析类（对策导向）—— 先诊断「重形象、轻实效」的成因，再给出可执行的纠偏对策。

## 综合评价
作答抓住了「样板村」现象，问题意识到位，能从「干部干、群众看」切入。主要不足：诊断停留在表面，未触及考核导向与政绩观；对策笼统，缺少责任主体和可量化指标；语言偶有泛化，可更精炼。

## 亮点
- 问题意识较强，能识别「形象工程 vs 实际需求」的张力。
- 用「干部干、群众看」点出基层治理痛点，有画面感。
- 已具备「现象—原因—对策」的基本框架。

## 改进建议
- 诊断深一层：补「考核导向偏差、政绩观错位、监督缺位」。
- 对策可落地：按责任主体（乡镇 / 村两委 / 群众）＋ 量化指标拆分。
- 语言收紧：删「重形象、轻实效」式空泛对仗，换可核验表述。

## 参考优化
乡村振兴应坚持「问需于民、问效于民」。乡镇建立项目入库前的需求听证与事后效益评估，村两委公开资金去向与进展，群众通过走访满意度、项目闲置率参与监督——把「样板村」的考核，从「有没有」转向「管不管用」。`;

/** Sample meta for the showcase GradingReport (clearly demo values). */
const SAMPLE_META = {
  time: '2026-06-14T21:48:00',
  model: 'gpt-4o-mini',
  durationMs: 11400,
};

/** Four-step closed loop — a real practice sequence (写/改/盘/进). */
const LOOP_STEPS: { pin: string; label: string; desc: string }[] = [
  { pin: '1', label: '写', desc: '粘贴或直接写申论作答，实时统计字数与进度。' },
  { pin: '2', label: '改', desc: 'AI 给结构化批阅：类型、亮点、改进建议、参考范文。' },
  { pin: '3', label: '盘', desc: '历史复盘，按时间与关键词回看每一次批改。' },
  { pin: '4', label: '进', desc: '对照参考范文，下一篇写得更准、更稳。' },
];

/** Section label style: mono small caps-ish, oxblood for most, ok for 亮点. */
function SecLabel({
  children,
  tone = 'oxblood',
}: {
  children: React.ReactNode;
  tone?: 'oxblood' | 'ok';
}) {
  const color = tone === 'ok' ? 'text-ok' : 'text-oxblood';
  return (
    <div className={`text-[11px] font-semibold tracking-[0.02em] ${color}`}>
      {children}
    </div>
  );
}

/** Arrow icon used in oxblood CTAs. */
function ArrowRight({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Green check used in the trust-badge row. */
function CheckOk({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * HeroReportCard — the compact report-card mockup for the hero right column.
 * A faithful static representation of the real GradingReport's visual language
 * (Pin check, sec-label, numbered suggestions, mini radar), showing 3 of the 5
 * sections so the hero stays compact. The full 5-section sample lives in the
 * #demo showcase below, rendered by the real GradingReport component.
 */
function HeroReportCard() {
  return (
    <div className="relative">
      {/* Soft panel backdrop (hidden on the narrowest screens). */}
      <div className="absolute -inset-3 bg-panel rounded-2xl -z-10 hidden sm:block" />

      <div className="rounded-xl border border-line bg-paper shadow-[0_10px_30px_-12px_oklch(0.24_0.02_262/0.18)] overflow-hidden">
        {/* Card header bar */}
        <div className="flex items-center gap-2 px-4 h-10 border-b border-line bg-panel text-[12px]">
          <Pin>
            <CheckOk className="w-3 h-3" />
          </Pin>
          <span className="font-medium text-ink">本次批阅</span>
          <span className="text-faint">·</span>
          <span className="font-mono text-faint">
            {SAMPLE_META.model} ·{' '}
            {(SAMPLE_META.durationMs / 1000).toFixed(1)}s
          </span>
        </div>

        {/* Card body: 3 compact sections + mini radar */}
        <div className="p-4 md:p-5 space-y-4">
          <div>
            <SecLabel>任务类型判断</SecLabel>
            <p className="mt-1 text-[13.5px] text-ink leading-relaxed">
              综合分析类（对策导向）—— 先诊断成因，再给可执行对策。
            </p>
          </div>

          <div className="grid grid-cols-[1fr_88px] gap-4 items-center">
            <div>
              <SecLabel>改进建议</SecLabel>
              <ul className="mt-1.5 flex flex-col gap-1.5 text-[12.5px]">
                <li className="flex gap-2">
                  <Pin className="shrink-0 h-[1.05rem] min-w-[1.05rem] text-[10px]">
                    1
                  </Pin>
                  <span className="text-ink">
                    诊断深一层：补考核导向、政绩观。
                  </span>
                </li>
                <li className="flex gap-2">
                  <Pin className="shrink-0 h-[1.05rem] min-w-[1.05rem] text-[10px]">
                    2
                  </Pin>
                  <span className="text-ink">
                    对策按责任主体 + 量化指标拆分。
                  </span>
                </li>
              </ul>
            </div>
            {/* Mini radar (decorative — illustrates the opt-in structured view). */}
            <svg
              viewBox="0 0 100 100"
              className="w-[88px] h-[88px] shrink-0"
              role="img"
              aria-label="维度雷达示意图"
            >
              <g stroke="var(--line)" fill="none" strokeWidth={1}>
                <polygon points="50,12 84,50 50,88 16,50" />
                <polygon points="50,31 69,50 50,69 31,50" />
              </g>
              <polygon
                points="50,24 67,50 50,63 28,50"
                fill="oklch(0.56 0.17 32 / 0.18)"
                stroke="var(--mark)"
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="pt-3 border-t border-line">
            <SecLabel>参考优化</SecLabel>
            <p className="mt-1 text-[12.5px] text-mute leading-relaxed">
              把「样板村」的考核，从「有没有」转向「管不管用」——问需于民、问效于民。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  // Auth-aware CTAs: logged-in users go straight into the workspace instead of
  // being asked to register. The public CommandBar stays the same either way.
  const heroCtaTo = isAuthenticated ? '/app/writing' : '/register';
  const heroCtaLabel = isAuthenticated ? '去写作台' : '免费开始第一篇';
  const finalCtaTo = isAuthenticated ? '/app/writing' : '/register';
  const finalCtaLabel = isAuthenticated ? '开始新一篇批改' : '免费注册';
  const finalSubtitle = isAuthenticated
    ? '回到写作台，约 12 秒拿到下一份结构化批阅报告。'
    : '注册后接入你自己的模型，30 秒拿到第一份结构化批阅。';

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <CommandBar variant="public" />

      <main id="main-content" className="flex-1 text-ink">
        {/* ===== HERO ===== */}
        <section className="border-b border-line">
          <div className="max-w-[1180px] mx-auto px-4 md:px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-10 lg:gap-14 items-center">
            {/* Thesis */}
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-mono text-faint border border-line rounded-full px-2.5 py-1 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-mark" aria-hidden="true" />
                智能公考 · 申论写作批改
              </div>

              <h1
                className="text-[30px] md:text-[40px] leading-[1.15] font-semibold tracking-tight text-ink"
                style={{ textWrap: 'balance' }}
              >
                写完申论，立刻拿到
                <br className="hidden sm:block" />
                考官级
                <span className="text-oxblood">结构化批改</span>。
              </h1>

              <p className="mt-5 text-[15px] md:text-[16px] text-mute leading-[1.8] max-w-[46ch]">
                不只是打个分。任务类型判断、亮点、改进建议、参考范文——逐条告诉你这篇哪里弱、下一篇怎么改。
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to={heroCtaTo}
                  className="inline-flex items-center gap-2 text-[14px] font-medium bg-oxblood text-white px-5 py-2.5 rounded-lg hover:bg-oxblood-ink transition-ui"
                >
                  {heroCtaLabel}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#demo"
                  className="text-[14px] text-mute hover:text-ink px-2 py-2.5 transition-ui"
                >
                  看批改示例 ↓
                </a>
              </div>

              {/* Trust badges */}
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-faint">
                <span className="inline-flex items-center gap-1.5">
                  <CheckOk className="w-3.5 h-3.5 text-ok" />
                  接入你自己的 OpenAI 兼容模型
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckOk className="w-3.5 h-3.5 text-ok" />
                  历史本地留存
                </span>
              </div>
            </div>

            {/* Product moment: real report-card mockup */}
            <HeroReportCard />
          </div>
        </section>

        {/* ===== THE LOOP (real four-step sequence) ===== */}
        <section className="border-b border-line">
          <div className="max-w-[1180px] mx-auto px-4 md:px-6 py-12 md:py-16">
            <h2 className="text-[13px] font-mono uppercase tracking-wider text-faint mb-2">
              练习闭环
            </h2>
            <p className="text-[20px] md:text-[24px] font-semibold tracking-tight text-ink mb-8">
              四步把一篇申论改到位
            </p>

            {/* gap-px on a bg-line grid draws 1px dividers between cells. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line rounded-xl overflow-hidden border border-line">
              {LOOP_STEPS.map((step) => (
                <div key={step.pin} className="bg-paper p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Pin>{step.pin}</Pin>
                    <span className="text-[14px] font-semibold text-ink">
                      {step.label}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-mute leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== REPORT SHOWCASE ===== */}
        <section
          id="demo"
          className="border-b border-line bg-panel/40 scroll-mt-20"
        >
          <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-12 md:py-16">
            <div className="max-w-[60ch] mb-8">
              <h2 className="text-[13px] font-mono uppercase tracking-wider text-faint mb-2">
                一篇批改长这样
              </h2>
              <p className="text-[20px] md:text-[24px] font-semibold tracking-tight text-ink">
                五个固定板块，每条都指向行动
              </p>
              <p className="text-[14px] text-mute mt-2 leading-relaxed">
                任务类型判断、综合评价、亮点、改进建议、参考优化——结构稳定，方便复盘，也方便逐条改进。
              </p>
            </div>

            {/*
              The real GradingReport fed a static sample — shows users exactly
              what they get after a grading run (stage trace + 5-section report
              + action row). design.md §10.11 specifies GradingReport here.
            */}
            <GradingReport markdown={SAMPLE_FEEDBACK} meta={SAMPLE_META} />
          </div>
        </section>

        {/* ===== FINAL CTA ===== */}
        <section>
          <div className="max-w-[1180px] mx-auto px-4 md:px-6 py-14 md:py-20 text-center">
            <h2 className="text-[24px] md:text-[30px] font-semibold tracking-tight text-ink">
              {isAuthenticated ? '继续你的批改训练' : '开始你的第一篇批改'}
            </h2>
            <p className="text-[14px] text-mute mt-3 mb-7 max-w-[50ch] mx-auto">
              {finalSubtitle}
            </p>
            <Link
              to={finalCtaTo}
              className="inline-flex items-center gap-2 text-[15px] font-medium bg-oxblood text-white px-6 py-3 rounded-lg hover:bg-oxblood-ink transition-ui"
            >
              {finalCtaLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-line">
        <div className="max-w-[1180px] mx-auto px-4 md:px-6 py-6 flex flex-wrap items-center gap-3 text-[12px] text-faint">
          <span className="grid place-items-center w-6 h-6 rounded bg-mark text-white font-bold text-[12px]">
            成
          </span>
          <span className="font-medium text-mute">成公</span>
          <span className="font-mono">智能公考 · 申论写作批改</span>
          <span className="ml-auto font-mono">© 2026 成公</span>
        </div>
      </footer>
    </div>
  );
}

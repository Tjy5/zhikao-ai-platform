/**
 * 成公 design tokens — SINGLE source of truth:
 * .trellis/tasks/06-14-frontend-rebuild/design.md §2.
 *
 * OKLCH color tokens are locked here. Do NOT re-introduce the old cream /
 * paper-white / slate-gray / deep-ink / success-ink / vermilion-as-CTA palette —
 * that direction (墨评AI / 墨韵) is fully replaced. vermilion (`mark`) is an
 * accent only (批改标记 / 状态); the CTA color is `oxblood`.
 *
 * Spacing uses Tailwind's DEFAULT scale (no override) so p-1 < p-2 < p-3 stays
 * monotonic (the old config redefined '1'/'2' and broke ordering).
 * borderRadius / boxShadow / maxWidth also use Tailwind defaults; floats use
 * arbitrary shadow values inline (e.g. shadow-[0_10px_30px_-12px_...]).
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Command bar (dark top bar)
        shell: 'oklch(0.235 0.016 262)',
        'shell-2': 'oklch(0.28 0.018 262)',
        'shell-line': 'oklch(0.34 0.02 262)',
        'shell-txt': 'oklch(0.92 0.006 250)',
        'shell-mute': 'oklch(0.66 0.012 250)',
        // Workspace surfaces (near-white, NOT cream)
        paper: 'oklch(0.985 0.003 240)',
        panel: 'oklch(0.965 0.005 240)',
        rule: 'oklch(0.86 0.008 240)',
        line: 'oklch(0.90 0.006 240)',
        // Text
        ink: 'oklch(0.24 0.02 262)',
        mute: 'oklch(0.47 0.014 262)',
        faint: 'oklch(0.60 0.012 262)',
        // Actions
        oxblood: 'oklch(0.42 0.12 25)',
        'oxblood-ink': 'oklch(0.34 0.11 25)',
        // vermilion accent (批改标记 / 状态 accent ONLY — never a generic CTA)
        mark: 'oklch(0.56 0.17 32)',
        'mark-soft': 'oklch(0.96 0.035 32)',
        // Status
        ok: 'oklch(0.50 0.11 155)',
        warn: 'oklch(0.62 0.14 72)',
      },
      fontFamily: {
        // Pure sans only — serif is disabled product-wide (design.md §3).
        sans: ['Inter', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

# Design System

> **权威性说明（2026-06-15）**：本文件描述品牌定位与原则。当前前端重构（`.trellis/tasks/06-14-frontend-rebuild/`）的 `design.md` 是**技术实现与 token 的唯一权威**，本文件与之冲突处以该 `design.md` 为准。关键修正：产品名 = **成公**；导航 = **顶部命令栏**（非左栏）；字体 = **纯无衬线**（禁用衬线）；批改签名 = **5 段结构化报告**（默认）+ opt-in 雷达，**不在正文文字上画删除线/波浪线**（动态 CJK markdown 上对齐不可靠）。

## Metadata

- **Product:** 成公（智能公考学习平台，原代号「墨评AI」已弃用）
- **Register:** product
- **Primary surface:** AI learning workspace for writing practice, AI grading, settings, and review
- **Design goal:** More complete and more polished than `frontend-old`, while avoiding old ink-wash overdecoration and generic SaaS templates

## Creative Direction

### North Star: “Answer Sheet Command Desk”

The interface should feel like a focused study desk upgraded into an AI control room. The subject matter is exam writing: answer sheets, margin notes, correction marks, rubric dimensions, progress review. The visual system should borrow from that world without becoming nostalgic decoration.

The memorable signature element is the **redline review layer**: thin vermilion correction marks, rubric rails, inline annotations, and progress traces that appear around writing and feedback surfaces. This is not a decorative “Chinese style” motif; it is a functional metaphor for expert marking.

### Physical scene

A candidate studies at night on a laptop, moving between writing, AI feedback, and review history. The UI needs enough depth and contrast to feel focused, but not a dark developer dashboard. Use a light, neutral workspace with precise colored signals.

## Color

Use OKLCH-oriented tokens in implementation where possible. Current hex values may remain during migration, but new tokens should be expressed as CSS variables and mapped into Tailwind.

### Palette

- **Workspace Ink** — `oklch(0.24 0.025 255)` / approx `#252B34`  
  Primary text, navigation, strong outlines.
- **Answer Sheet** — `oklch(0.985 0.004 250)` / approx `#FAFAFB`  
  Main background. A true clean sheet, not warm parchment.
- **Panel Mist** — `oklch(0.955 0.012 245)` / approx `#EEF2F7`  
  Secondary surfaces, empty states, side panels.
- **Vermilion Mark** — `oklch(0.56 0.17 32)` / approx `#C7432F`  
  Critique marks, primary action, destructive confirmation, active state. Keep visually scarce.
- **Scholar Blue** — `oklch(0.45 0.11 250)` / approx `#315A92`  
  Navigation, information states, AI/workspace affordances.
- **Progress Green** — `oklch(0.52 0.10 155)` / approx `#2F7B57`  
  Success, connection ready, saved state.
- **Review Amber** — `oklch(0.68 0.14 72)` / approx `#C98519`  
  Warnings, missing API key, attention required.

### Color rules

- Body background must not use the old `paper/card-cream` warm parchment system as the dominant identity.
- Vermilion is a semantic review mark, not a brand flood. Use it for decisions and critique, not generic decoration.
- Muted text must remain readable; avoid low-contrast gray on tinted surfaces.
- Error, warning, success, loading, and empty states each need visually distinct but restrained treatments.

## Typography

### Roles

- **Display / Page titles:** `Inter` + `Noto Sans SC`（**纯无衬线**；衬线在产品 UI 中渲染不可靠，已禁用，包括 wordmark 与标题）。
- **Body / UI:** `Inter`, system sans. Use for forms, navigation, controls, dense status text.
- **Data / technical:** `JetBrains Mono`, monospace. Use for model IDs, provider URLs, token-like snippets, timestamps.

### Type rules

- H1 max size should stay below 72px on desktop; app pages should usually be 32–44px.
- Use `text-wrap: balance` for h1–h3 and `text-wrap: pretty` for prose.
- Body line length: 65–75ch.
- Avoid decorative calligraphy fonts in product UI.

## Layout

### App shell

The product should feel like one workspace, not separate unrelated pages.

- Public shell: landing, login, register.
- Authenticated shell: persistent top or side navigation with user status, AI readiness, and primary routes.
- Core routes: Home/workspace, Writing, Grading, History, Settings.
- Route aliases may support legacy paths only if they reduce friction; canonical protected routes should remain `/app/*`.

### Page structure

- **Home / workspace:** quick status, primary action to write, AI readiness, recent history, next-step prompts.
- **Writing:** large editor + stats/rubric side panel + configuration readiness warning + clear path to grading.
- **Grading:** stage progress, AI status, current message, final Markdown result, action rail.
- **History:** list/detail split on desktop, stacked master-detail on mobile, filters/search/delete/copy actions.
- **Settings:** model configuration console with current state, API key state, model discovery, connection test, save feedback.

### Density

The UI may be information-rich, but not cramped. Prefer structured rails, split panels, and persistent status strips over nested generic cards.

## Components

### Signature: Structured review output

Reusable treatment for writing and feedback contexts:

- **默认签名 = 5 段结构化批阅报告**（任务类型判断/综合评价/亮点/改进建议/参考优化），每段为有样式的块，对应后端保证的 markdown 5 段契约。
- accent 用 vermilion 编号 pin、维度 chip、阶段连线；**不在正文文字上画删除线/波浪线/下划线**（动态 CJK markdown 上对齐不可靠）。
- opt-in 结构化评分（雷达图 + 摘录批注卡）待后端结构化输出后启用，前端不填假数据。
- Must respect reduced motion.

### Buttons

- Primary: vermilion background for the one most important action on a page.
- Secondary: ink/blue outline or soft panel fill.
- Destructive: vermilion only when deleting/clearing; require confirmation.
- Use active verbs: “开始批改”, “保存配置”, “测试连接”, “清空历史”.

### Inputs

- Large enough for study workflows; focus ring must be visible.
- Validation errors appear inline with specific recovery instructions.
- API key fields support show/hide, masked saved state, and “leave blank to keep existing key”.

### Cards and panels

- Cards are allowed but should not be the whole visual language.
- Use panels for workspace regions; use cards for contained records or summaries.
- Avoid identical icon-card grids except where the content is truly parallel.

### Toasts, dialogs, empty states

- Toasts confirm transient outcomes; they must not be the only place critical state is shown.
- Dialogs use clear consequence copy.
- Empty states must offer an action, not just say “暂无数据”.

## Motion

- Motion should communicate progress or state transition: grading stages, panel reveal, saved-state confirmation.
- Avoid decorative perpetual motion.
- Use ease-out curves and short durations (150–300ms for UI, up to 700ms for major page transition).
- Implement `prefers-reduced-motion` fallbacks.

## Accessibility

- WCAG 2.1 AA minimum.
- Visible focus for every interactive control.
- `aria-live` for grading progress and save/test outcomes.
- Keyboard-accessible dialogs and model selection.
- Touch targets ≥44px on mobile.

## Anti-slop rules

Do not ship:

- Gradient text.
- Glassmorphism as default surface.
- Colored side-stripe cards.
- Tiny uppercase eyebrow on every section.
- Repeated 01/02/03 section numbering unless it is a real sequence.
- A page that is only a form without surrounding guidance, status, or recovery states.
- Old ink-wash/calligraphy decoration as the dominant visual identity.

## Validation expectation

Before calling the frontend complete, capture or manually inspect every core route at mobile, tablet, and desktop widths; verify contrast, keyboard navigation, long content, empty states, loading states, and backend error states.

/**
 * structuredScoringPref — client-side persistence for the opt-in "结构化评分
 * 输出" toggle. design.md §9 / §10.10.
 *
 * DORMANT BY CONTRACT (design.md §9, prd.md 数据策略):
 *  - The backend `WritingPromptBuilder` system prompt FORBIDS JSON output, and
 *    `WritingDtos.WritingSubmission` carries only `{ content, task_type }` —
 *    there is NO structured-scoring field on the wire today.
 *  - Until a Phase-2 backend change adds structured JSON output
 *    (`dimensions[]` / `annotations[]` / `overall`), this preference MUST NOT
 *    alter any API request and the StructuredReport MUST NOT render with fake
 *    data.
 *  - This module ONLY persists the user's intent client-side so the UI state
 *    survives reloads and the future wiring point is discoverable. No backend
 *    field is fabricated.
 *
 * Future wiring (when the backend lands structured JSON): the grading request
 * builder reads `getStructuredScoringPref()` and, when true + backend-capable,
 * requests structured output; StructuredReport then renders from the real
 * payload. Today: no-op.
 */

const STORAGE_KEY = 'chenggong.structuredScoringOptIn';

export function getStructuredScoringPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // localStorage may be unavailable (private mode / disabled) — default off.
    return false;
  }
}

export function setStructuredScoringPref(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Silently ignore — the toggle still reflects intent in-component for the
    // session even if persistence fails.
  }
}

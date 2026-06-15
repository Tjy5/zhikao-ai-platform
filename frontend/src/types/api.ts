/**
 * API response / request types — MUST match the backend contract.
 *
 * Ground-truth backend sources (do not invent fields beyond these):
 *  - Auth:        backend auth controller / DTOs (register / login / me)
 *  - Writing:     WritingDtos.java (WritingSubmission, RawWritingFeedbackResult),
 *                 WritingController.java (grade, grade-progressive SSE shape)
 *  - History:     HistoryService.java (summary / detail / clear / delete)
 *  - Settings:    WritingAISettings controller + DTOs
 *
 * Load-bearing realities (design.md §9, prd.md backend table):
 *  - Grading response is a single `content` (markdown) + `contentFormat`.
 *    The AI system prompt forbids JSON output, so there is NO score / dimensions
 *    / annotations in the response today.
 *  - `HistorySummary.score` is STRUCTURALLY ALWAYS NULL: HistoryService.append
 *    writes `null` and summary() echoes record.score(). Do not render it.
 *  - `HistorySummary.content` is the grading FEEDBACK markdown, not the user's
 *    original writing. The original writing only appears in the detail endpoint
 *    under `request.content`.
 */

// Auth types
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  username_or_email: string;
  password: string;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Settings types
export interface WritingAISettingsUpdate {
  provider_name: string;
  base_url: string;
  model_name: string;
  api_key?: string;
  json_fallback_enabled: boolean;
}

export interface WritingAISettingsResponse {
  id: number | null;
  provider_name: string;
  base_url: string;
  model_name: string;
  json_fallback_enabled: boolean;
  has_api_key: boolean;
  api_key_hint: string | null;
  last_test_status: string | null;
  last_tested_at: string | null;
  last_failure_classification: string | null;
  last_successful_mode: string | null;
}

export interface WritingAIModelDiscoveryRequest {
  base_url?: string;
  api_key?: string;
}

export interface ProviderModelInfo {
  id: string;
  created: number | null;
  object: string | null;
  owned_by: string | null;
}

export interface ProviderModelsResponse {
  status: string;
  configured: boolean;
  base_url: string;
  model_count: number;
  models: ProviderModelInfo[];
  last_failure_classification: string | null;
  message: string;
}

export interface ProviderTestResponse {
  status: string;
  configured: boolean;
  model: string | null;
  base_url: string | null;
  last_successful_mode: string | null;
  last_failure_classification: string | null;
  message: string;
}

// Writing types
export interface WritingSubmission {
  content: string;
  task_type?: string;
}

export interface RawWritingFeedbackResult {
  content: string;
  contentFormat: string;
}

// SSE event types
export interface SSEProgressEvent {
  stage: number | 'error';
  progress: number;
  status: string;
  message: string;
  partial: boolean;
  content?: string;
  contentFormat?: string;
  classification?: string;
  retryable?: boolean;
}

// History types
// The list endpoint returns summary items (newest first).
// NOTE: `content` in a summary is the grading feedback (markdown), NOT the user's original writing.
// `score` is always null in the current backend data - do not render it.
export interface HistorySummary {
  id: string;
  timestamp: string;
  type: string; // "grade" | "progressive"
  taskType: string | null;
  // STRUCTURALLY ALWAYS NULL — HistoryService.append writes null; do not render.
  score: number | null;
  content: string; // Grading feedback (markdown)
  contentFormat: string;
}

export interface HistorySummaryResponse {
  items: HistorySummary[];
}

// History detail endpoint returns the user's original writing (request.content)
// plus the grading feedback (response.content) and optional extra metadata.
export interface HistoryDetailRequest {
  content: string;
  task_type: string | null;
}

export interface HistoryDetailResponse {
  content: string;
  contentFormat: string;
}

export interface HistoryDetail {
  id: string;
  timestamp: string;
  type: string;
  request: HistoryDetailRequest;
  response: HistoryDetailResponse;
  extra?: Record<string, unknown>;
}

// `DELETE /history` clears ALL of the current user's history and returns
// `{ deleted: n }`. `DELETE /history/{id}` deletes a single record
// (idempotent + user-scoped, returns `{ deleted: 1 }` or `{ deleted: 0 }`).
// Batch delete is implemented client-side by issuing N single-item deletes.
export interface HistoryClearResponse {
  deleted: number;
}

// API Error type
export interface ApiErrorResponse {
  message: string;
  status?: number;
  details?: unknown;
}

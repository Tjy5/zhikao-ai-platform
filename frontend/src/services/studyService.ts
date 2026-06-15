import apiClient from './apiClient';
import type {
  SectionKey,
  StudySection,
  StudySectionsResponse,
  StudyRevisionsResponse,
  StudyRevision,
  StudyProposalsResponse,
  StudyProposeRequest,
  StudyEditRequest,
  StudyRevertRequest,
  StudyRejectRequest,
  StudyRejectResponse,
} from '../types/api';

/**
 * Study content versioning service (child-4). Mirrors
 * `backend StudyController` (`/api/v1/study`) 1:1 — every method maps to one
 * endpoint; all wire fields are snake_case per `StudyDtos`.
 *
 * RBAC: reads + `propose` need only a logged-in user; `edit / approve / reject
 * / revert / getProposals` need ROLE_ADMIN on the backend (`@PreAuthorize`).
 * The frontend `isAdmin` gate only hides affordances — `apiClient` will surface
 * a 403 as `ErrorType.AUTH`; callers must special-case `details?.status === 403`
 * to show "需要管理员权限" instead of the generic "登录已过期" AUTH mapping.
 *
 * Revision list responses: `RevisionsResponse` uses the `revisions` key and
 * `ProposalsResponse` the `proposals` key (NOT `items`). `reject` returns
 * `{ reviewed }`.
 */
export const studyService = {
  /** Read all 9 sections' current live content (`GET /sections`). */
  getSections(): Promise<StudySectionsResponse> {
    return apiClient.get<StudySectionsResponse>('/api/v1/study/sections');
  },

  /** Read one section's current live content (`GET /sections/{key}`). */
  getSection(key: SectionKey): Promise<StudySection> {
    return apiClient.get<StudySection>(
      `/api/v1/study/sections/${encodeURIComponent(key)}`
    );
  },

  /**
   * List revisions for a section (`GET /sections/{key}/revisions`).
   * `limit`/`offset` optional (backend-clamped).
   */
  getRevisions(
    key: SectionKey,
    opts?: { limit?: number; offset?: number }
  ): Promise<StudyRevisionsResponse> {
    const params = new URLSearchParams();
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return apiClient.get<StudyRevisionsResponse>(
      `/api/v1/study/sections/${encodeURIComponent(key)}/revisions${qs ? `?${qs}` : ''}`
    );
  },

  /** Read one revision's content snapshot (`GET /revisions/{id}`). */
  getRevision(id: number): Promise<StudyRevision> {
    return apiClient.get<StudyRevision>(
      `/api/v1/study/revisions/${encodeURIComponent(id)}`
    );
  },

  /**
   * Submit a change proposal for a section (`POST /sections/{key}/propose`).
   * Login-only; produces a `proposed` row pending admin review.
   */
  propose(
    key: SectionKey,
    body: StudyProposeRequest
  ): Promise<StudyRevision> {
    return apiClient.post<StudyRevision>(
      `/api/v1/study/sections/${encodeURIComponent(key)}/propose`,
      body
    );
  },

  /**
   * Direct-edit a section (`POST /sections/{key}/edit`). Admin-only.
   * Produces a new `published(action=direct_edit)` row immediately.
   */
  edit(
    key: SectionKey,
    body: StudyEditRequest
  ): Promise<StudyRevision> {
    return apiClient.post<StudyRevision>(
      `/api/v1/study/sections/${encodeURIComponent(key)}/edit`,
      body
    );
  },

  /**
   * Approve a proposal (`POST /revisions/{id}/approve`). Admin-only.
   * Produces a new `published(author=proposer, reviewer=admin)` row.
   */
  approve(revisionId: number): Promise<StudyRevision> {
    return apiClient.post<StudyRevision>(
      `/api/v1/study/revisions/${encodeURIComponent(revisionId)}/approve`
    );
  },

  /**
   * Reject a proposal (`POST /revisions/{id}/reject`). Admin-only.
   * Body `{ review_note }` is optional; sets the row to `rejected`.
   */
  reject(
    revisionId: number,
    body?: StudyRejectRequest
  ): Promise<StudyRejectResponse> {
    return apiClient.post<StudyRejectResponse>(
      `/api/v1/study/revisions/${encodeURIComponent(revisionId)}/reject`,
      body ?? {}
    );
  },

  /**
   * Revert a section to a target revision
   * (`POST /sections/{key}/revert { target_revision_id }`). Admin-only.
   * Append-only: copies the target's content_json into a new `published(action=
   * revert, parent=target)` row; history is never deleted.
   */
  revert(
    key: SectionKey,
    body: StudyRevertRequest
  ): Promise<StudyRevision> {
    return apiClient.post<StudyRevision>(
      `/api/v1/study/sections/${encodeURIComponent(key)}/revert`,
      body
    );
  },

  /**
   * Admin review queue — all pending proposals across sections
   * (`GET /proposals`).
   */
  getProposals(
    opts?: { limit?: number; offset?: number }
  ): Promise<StudyProposalsResponse> {
    const params = new URLSearchParams();
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return apiClient.get<StudyProposalsResponse>(
      `/api/v1/study/proposals${qs ? `?${qs}` : ''}`
    );
  },
};

export default studyService;

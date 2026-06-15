package com.zhikao.backend.study;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

/**
 * DTOs for {@code /api/v1/study}. Snake_case {@code @JsonProperty} on every field mirrors the
 * existing convention in {@code AuthDtos} ({@code is_active} / {@code access_token}) and {@code
 * SettingsDtos} ({@code provider_name} / {@code base_url}): JacksonConfig does not set a naming
 * strategy, so record-component names default to camelCase unless explicitly annotated. The parent
 * design (§5) mandates the frontend consume snake_case, so every wire field is annotated.
 */
public final class StudyDtos {
  private StudyDtos() {}

  /**
   * Request bodies. {@code author_id} is intentionally absent — always server-derived. {@code
   * ignoreUnknown} means a client-supplied {@code author_id} (or any other stray field) is silently
   * dropped instead of failing deserialization, which is exactly the "author is server-derived"
   * security property (§7).
   */

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ProposeRequest(
      @JsonProperty("content_json") JsonNode contentJson,
      @JsonProperty("change_summary") String changeSummary) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record EditRequest(
      @JsonProperty("content_json") JsonNode contentJson,
      @JsonProperty("change_summary") String changeSummary) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record RevertRequest(@JsonProperty("target_revision_id") long targetRevisionId) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record RejectRequest(@JsonProperty("review_note") String reviewNote) {}

  /** Responses. {@code content_json} is emitted as a raw JSON object (not an escaped string). */

  public record SectionLive(
      @JsonProperty("section_key") String sectionKey,
      @JsonProperty("content_json") JsonNode contentJson,
      @JsonProperty("updated_at") Instant updatedAt,
      @JsonProperty("updated_by") Long updatedBy) {}

  public record SectionsResponse(@JsonProperty("sections") java.util.List<SectionLive> sections) {}

  public record RevisionSummary(
      long id,
      @JsonProperty("section_key") String sectionKey,
      String action,
      String status,
      @JsonProperty("author_username") String authorUsername,
      @JsonProperty("created_at") Instant createdAt,
      @JsonProperty("change_summary") String changeSummary,
      @JsonProperty("reviewer_username") String reviewerUsername,
      @JsonProperty("reviewed_at") Instant reviewedAt,
      @JsonProperty("review_note") String reviewNote,
      @JsonProperty("parent_revision_id") Long parentRevisionId) {}

  public record RevisionDetail(
      long id,
      @JsonProperty("section_key") String sectionKey,
      String action,
      String status,
      @JsonProperty("author_username") String authorUsername,
      @JsonProperty("created_at") Instant createdAt,
      @JsonProperty("change_summary") String changeSummary,
      @JsonProperty("reviewer_username") String reviewerUsername,
      @JsonProperty("reviewed_at") Instant reviewedAt,
      @JsonProperty("review_note") String reviewNote,
      @JsonProperty("parent_revision_id") Long parentRevisionId,
      @JsonProperty("content_json") JsonNode contentJson) {}

  public record RevisionsResponse(
      @JsonProperty("revisions") java.util.List<RevisionSummary> revisions,
      int total) {}

  public record ProposalsResponse(
      @JsonProperty("proposals") java.util.List<RevisionSummary> proposals,
      int total) {}

  public record RejectResponse(@JsonProperty("reviewed") int reviewed) {}
}

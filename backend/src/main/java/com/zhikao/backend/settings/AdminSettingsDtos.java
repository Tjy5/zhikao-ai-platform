package com.zhikao.backend.settings;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.zhikao.backend.settings.SettingsDtos.WritingAISettingsResponse;
import com.zhikao.backend.settings.SettingsDtos.WritingAISettingsUpdate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public final class AdminSettingsDtos {
  private AdminSettingsDtos() {}

  public record OperationPolicyResponse(
      @JsonProperty("public_registration_enabled") boolean publicRegistrationEnabled,
      @JsonProperty("content_proposals_enabled") boolean contentProposalsEnabled,
      @JsonProperty("reject_note_required") boolean rejectNoteRequired,
      @JsonProperty("admin_direct_publish_enabled") boolean adminDirectPublishEnabled,
      @JsonProperty("content_revert_enabled") boolean contentRevertEnabled) {}

  public record OperationPolicyUpdate(
      @JsonProperty("public_registration_enabled") boolean publicRegistrationEnabled,
      @JsonProperty("content_proposals_enabled") boolean contentProposalsEnabled,
      @JsonProperty("reject_note_required") boolean rejectNoteRequired,
      @JsonProperty("admin_direct_publish_enabled") boolean adminDirectPublishEnabled,
      @JsonProperty("content_revert_enabled") boolean contentRevertEnabled) {}

  public record AdminSettingsResponse(
      @JsonProperty("writing_ai") WritingAISettingsResponse writingAi,
      @JsonProperty("operation_policy") OperationPolicyResponse operationPolicy) {}

  public record AdminSettingsUpdate(
      @JsonProperty("writing_ai") @NotNull @Valid WritingAISettingsUpdate writingAi,
      @JsonProperty("operation_policy") @NotNull @Valid OperationPolicyUpdate operationPolicy) {}
}

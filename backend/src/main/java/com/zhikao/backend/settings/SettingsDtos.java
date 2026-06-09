package com.zhikao.backend.settings;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;

public final class SettingsDtos {
  private SettingsDtos() {}

  public record WritingAISettingsUpdate(
      @JsonProperty("provider_name") @NotBlank String providerName,
      @JsonProperty("base_url") @NotBlank String baseUrl,
      @JsonProperty("model_name") @NotBlank String modelName,
      @JsonProperty("api_key") String apiKey,
      @JsonProperty("json_fallback_enabled") boolean jsonFallbackEnabled) {}

  public record WritingAIModelDiscoveryRequest(
      @JsonProperty("base_url") String baseUrl, @JsonProperty("api_key") String apiKey) {}

  public record WritingAISettingsResponse(
      Long id,
      @JsonProperty("provider_name") String providerName,
      @JsonProperty("base_url") String baseUrl,
      @JsonProperty("model_name") String modelName,
      @JsonProperty("json_fallback_enabled") boolean jsonFallbackEnabled,
      @JsonProperty("has_api_key") boolean hasApiKey,
      @JsonProperty("api_key_hint") String apiKeyHint,
      @JsonProperty("last_test_status") String lastTestStatus,
      @JsonProperty("last_tested_at") Instant lastTestedAt,
      @JsonProperty("last_failure_classification") String lastFailureClassification,
      @JsonProperty("last_successful_mode") String lastSuccessfulMode) {}

  public record ProviderModelInfo(
      String id, Long created, String object, @JsonProperty("owned_by") String ownedBy) {}

  public record ProviderModelsResponse(
      String status,
      boolean configured,
      @JsonProperty("base_url") String baseUrl,
      @JsonProperty("model_count") int modelCount,
      List<ProviderModelInfo> models,
      @JsonProperty("last_failure_classification") String lastFailureClassification,
      String message) {}

  public record ProviderTestResponse(
      String status,
      boolean configured,
      String model,
      @JsonProperty("base_url") String baseUrl,
      @JsonProperty("last_successful_mode") String lastSuccessfulMode,
      @JsonProperty("last_failure_classification") String lastFailureClassification,
      String message) {}
}

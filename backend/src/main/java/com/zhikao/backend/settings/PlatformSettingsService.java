package com.zhikao.backend.settings;

import com.zhikao.backend.ai.AiClassification;
import com.zhikao.backend.ai.AiProvider;
import com.zhikao.backend.ai.AiProviderConfig;
import com.zhikao.backend.ai.AiProviderException;
import com.zhikao.backend.common.Clock;
import com.zhikao.backend.config.AppProperties;
import com.zhikao.backend.data.PlatformSettingsRecord;
import com.zhikao.backend.data.PlatformSettingsRepository;
import com.zhikao.backend.settings.AdminSettingsDtos.AdminSettingsResponse;
import com.zhikao.backend.settings.AdminSettingsDtos.AdminSettingsUpdate;
import com.zhikao.backend.settings.AdminSettingsDtos.OperationPolicyResponse;
import com.zhikao.backend.settings.SettingsDtos.ProviderModelInfo;
import com.zhikao.backend.settings.SettingsDtos.ProviderModelsResponse;
import com.zhikao.backend.settings.SettingsDtos.ProviderTestResponse;
import com.zhikao.backend.settings.SettingsDtos.WritingAIModelDiscoveryRequest;
import com.zhikao.backend.settings.SettingsDtos.WritingAISettingsResponse;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PlatformSettingsService {
  private final PlatformSettingsRepository settings;
  private final ApiKeyEncryptionService encryption;
  private final AppProperties properties;
  private final Clock clock;
  private final AiProvider aiProvider;

  public PlatformSettingsService(
      PlatformSettingsRepository settings,
      ApiKeyEncryptionService encryption,
      AppProperties properties,
      Clock clock,
      AiProvider aiProvider) {
    this.settings = settings;
    this.encryption = encryption;
    this.properties = properties;
    this.clock = clock;
    this.aiProvider = aiProvider;
  }

  public PlatformSettingsRecord current() {
    return settings.find().orElseGet(this::createDefaultRow);
  }

  public AdminSettingsResponse getAdminSettings() {
    return toAdminResponse(current());
  }

  public OperationPolicyResponse getOperationPolicy() {
    return toOperationPolicyResponse(current());
  }

  @Transactional
  public AdminSettingsResponse updateAdminSettings(AdminSettingsUpdate request) {
    current();
    String apiKey = request.writingAi().apiKey() == null ? null : request.writingAi().apiKey().trim();
    boolean updateSecret = apiKey != null && !apiKey.isBlank();
    PlatformSettingsRecord row =
        settings.update(
            SettingsService.normalizeOrDefault(request.writingAi().providerName(), "openai-compatible"),
            SettingsService.normalizeBaseUrl(request.writingAi().baseUrl()),
            SettingsService.normalizeOrDefault(request.writingAi().modelName(), properties.openaiModelName()),
            updateSecret ? encryption.encrypt(apiKey) : null,
            updateSecret ? encryption.mask(apiKey) : null,
            updateSecret,
            request.writingAi().jsonFallbackEnabled(),
            request.operationPolicy().publicRegistrationEnabled(),
            request.operationPolicy().contentProposalsEnabled(),
            request.operationPolicy().rejectNoteRequired(),
            request.operationPolicy().adminDirectPublishEnabled(),
            request.operationPolicy().contentRevertEnabled(),
            clock.now());
    return toAdminResponse(row);
  }

  public ProviderModelsResponse discoverModels(WritingAIModelDiscoveryRequest request) {
    PlatformSettingsRecord row = current();
    String baseUrl =
        SettingsService.normalizeBaseUrl(
            SettingsService.firstText(request == null ? null : request.baseUrl(), row.writingBaseUrl()));
    String apiKey =
        SettingsService.firstText(request == null ? null : request.apiKey(), decrypt(row.writingApiKeyEncrypted()));
    if (apiKey == null || apiKey.isBlank()) {
      return new ProviderModelsResponse(
          "unavailable", false, baseUrl, 0, List.of(), "unavailable", "Provider API key is not configured");
    }
    try {
      List<ProviderModelInfo> models =
          aiProvider.listModels(
                  new AiProviderConfig(
                      apiKey, baseUrl, row.writingModelName(), row.writingJsonFallbackEnabled()))
              .stream()
              .sorted(Comparator.comparing(ProviderModelInfo::id))
              .toList();
      return new ProviderModelsResponse(
          "succeeded", true, baseUrl, models.size(), models, null, "模型列表获取成功");
    } catch (AiProviderException error) {
      return new ProviderModelsResponse(
          "failed",
          true,
          baseUrl,
          0,
          List.of(),
          error.classification().value(),
          error.classification().userMessage());
    }
  }

  @Transactional
  public ProviderTestResponse testProvider() {
    PlatformSettingsRecord row = current();
    if (row.writingApiKeyEncrypted() == null || row.writingApiKeyEncrypted().isBlank()) {
      return new ProviderTestResponse(
          "unavailable",
          false,
          row.writingModelName(),
          row.writingBaseUrl(),
          null,
          "unavailable",
          "Provider API key is not configured");
    }
    String apiKey = decrypt(row.writingApiKeyEncrypted());
    Instant now = clock.now();
    try {
      aiProvider.gradeWritingRaw(
          new AiProviderConfig(
              apiKey,
              row.writingBaseUrl(),
              row.writingModelName(),
              row.writingJsonFallbackEnabled()),
          "请用一句话回复 Markdown 批改能力正常。",
          "provider_test");
      settings.updateProviderStatus("succeeded", now, null, "raw_text");
      return new ProviderTestResponse(
          "succeeded", true, row.writingModelName(), row.writingBaseUrl(), "raw_text", null, "Provider 测试成功");
    } catch (AiProviderException error) {
      settings.updateProviderStatus("failed", now, error.classification().value(), null);
      return new ProviderTestResponse(
          error.classification() == AiClassification.UNAVAILABLE ? "unavailable" : "failed",
          true,
          row.writingModelName(),
          row.writingBaseUrl(),
          null,
          error.classification().value(),
          error.classification().userMessage());
    }
  }

  public EffectiveAiSettings requireConfiguredGlobalSettings() {
    PlatformSettingsRecord row = current();
    if (row.writingApiKeyEncrypted() == null || row.writingApiKeyEncrypted().isBlank()) {
      throw new AiProviderException(AiClassification.UNAVAILABLE, "global provider api key missing");
    }
    return new EffectiveAiSettings(
        "global",
        row.id(),
        new AiProviderConfig(
            decrypt(row.writingApiKeyEncrypted()),
            row.writingBaseUrl(),
            row.writingModelName(),
            row.writingJsonFallbackEnabled()));
  }

  public void recordGlobalSuccess(Instant now) {
    settings.updateProviderStatus("succeeded", now, null, "raw_text");
  }

  public void recordGlobalFailure(Instant now, AiClassification classification) {
    settings.updateProviderStatus("failed", now, classification.value(), null);
  }

  public void requirePublicRegistrationEnabled() {
    if (!current().publicRegistrationEnabled()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "当前已关闭公开注册");
    }
  }

  public void requireContentProposalsEnabled() {
    if (!current().contentProposalsEnabled()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "当前已关闭内容提案提交");
    }
  }

  public void requireRejectNotePolicy(String note) {
    if (current().rejectNoteRequired() && (note == null || note.trim().isBlank())) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "驳回提案时必须填写审核说明");
    }
  }

  public void requireAdminDirectPublishEnabled() {
    if (!current().adminDirectPublishEnabled()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "当前已关闭管理员直接发布");
    }
  }

  public void requireContentRevertEnabled() {
    if (!current().contentRevertEnabled()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "当前已关闭内容回滚");
    }
  }

  public WritingAISettingsResponse toWritingResponse(PlatformSettingsRecord row) {
    return new WritingAISettingsResponse(
        row.id(),
        row.writingProviderName(),
        row.writingBaseUrl(),
        row.writingModelName(),
        row.writingJsonFallbackEnabled(),
        row.writingApiKeyEncrypted() != null && !row.writingApiKeyEncrypted().isBlank(),
        row.writingApiKeyHint(),
        row.lastTestStatus(),
        row.lastTestedAt(),
        row.lastFailureClassification(),
        row.lastSuccessfulMode());
  }

  private AdminSettingsResponse toAdminResponse(PlatformSettingsRecord row) {
    return new AdminSettingsResponse(toWritingResponse(row), toOperationPolicyResponse(row));
  }

  private OperationPolicyResponse toOperationPolicyResponse(PlatformSettingsRecord row) {
    return new OperationPolicyResponse(
        row.publicRegistrationEnabled(),
        row.contentProposalsEnabled(),
        row.rejectNoteRequired(),
        row.adminDirectPublishEnabled(),
        row.contentRevertEnabled());
  }

  private PlatformSettingsRecord createDefaultRow() {
    String apiKey = properties.openaiApiKey() == null ? null : properties.openaiApiKey().trim();
    boolean hasApiKey = apiKey != null && !apiKey.isBlank();
    return settings.insertDefaults(
        "openai-compatible",
        SettingsService.normalizeBaseUrl(properties.openaiApiBase()),
        SettingsService.normalizeOrDefault(properties.openaiModelName(), "gpt-4o-mini"),
        hasApiKey ? encryption.encrypt(apiKey) : null,
        hasApiKey ? encryption.mask(apiKey) : null,
        properties.writingLlmJsonFallback(),
        clock.now());
  }

  private String decrypt(String encrypted) {
    if (encrypted == null || encrypted.isBlank()) {
      return null;
    }
    try {
      return encryption.decrypt(encrypted);
    } catch (IllegalArgumentException error) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Provider API key cannot be decrypted");
    }
  }
}

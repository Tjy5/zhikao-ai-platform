package com.zhikao.backend.settings;

import com.zhikao.backend.ai.AiClassification;
import com.zhikao.backend.ai.AiProvider;
import com.zhikao.backend.ai.AiProviderConfig;
import com.zhikao.backend.ai.AiProviderException;
import com.zhikao.backend.common.Clock;
import com.zhikao.backend.config.AppProperties;
import com.zhikao.backend.data.UserAiSettingsRecord;
import com.zhikao.backend.data.UserAiSettingsRepository;
import com.zhikao.backend.settings.SettingsDtos.ProviderModelInfo;
import com.zhikao.backend.settings.SettingsDtos.ProviderModelsResponse;
import com.zhikao.backend.settings.SettingsDtos.ProviderTestResponse;
import com.zhikao.backend.settings.SettingsDtos.WritingAIModelDiscoveryRequest;
import com.zhikao.backend.settings.SettingsDtos.WritingAISettingsResponse;
import com.zhikao.backend.settings.SettingsDtos.WritingAISettingsUpdate;
import java.net.URI;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SettingsService {
  private final UserAiSettingsRepository settings;
  private final ApiKeyEncryptionService encryption;
  private final AppProperties properties;
  private final Clock clock;
  private final AiProvider aiProvider;

  public SettingsService(
      UserAiSettingsRepository settings,
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

  public WritingAISettingsResponse get(long userId) {
    return settings.findByUserId(userId).map(this::toResponse).orElse(defaultResponse());
  }

  @Transactional
  public WritingAISettingsResponse update(long userId, WritingAISettingsUpdate request) {
    String baseUrl = normalizeBaseUrl(request.baseUrl());
    String providerName = normalizeOrDefault(request.providerName(), "openai-compatible");
    String modelName = normalizeOrDefault(request.modelName(), properties.openaiModelName());
    String apiKey = request.apiKey() == null ? null : request.apiKey().trim();
    boolean updateSecret = apiKey != null && !apiKey.isBlank();
    UserAiSettingsRecord row =
        settings.upsert(
            userId,
            providerName,
            baseUrl,
            modelName,
            updateSecret ? encryption.encrypt(apiKey) : null,
            updateSecret ? encryption.mask(apiKey) : null,
            request.jsonFallbackEnabled(),
            updateSecret,
            clock.now());
    return toResponse(row);
  }

  public ProviderModelsResponse discoverModels(long userId, WritingAIModelDiscoveryRequest request) {
    UserAiSettingsRecord saved = settings.findByUserId(userId).orElse(null);
    String baseUrl =
        normalizeBaseUrl(
            firstText(
                request == null ? null : request.baseUrl(),
                saved == null ? null : saved.baseUrl(),
                properties.openaiApiBase()));
    String apiKey =
        firstText(
            request == null ? null : request.apiKey(),
            saved == null ? null : decrypt(saved.apiKeyEncrypted()));
    if (apiKey == null || apiKey.isBlank()) {
      return new ProviderModelsResponse(
          "unavailable", false, baseUrl, 0, List.of(), "unavailable", "Provider API key is not configured");
    }
    try {
      List<ProviderModelInfo> models =
          aiProvider.listModels(
              new AiProviderConfig(
                  apiKey,
                  baseUrl,
                  saved == null ? properties.openaiModelName() : saved.modelName(),
                  saved == null ? properties.writingLlmJsonFallback() : saved.jsonFallbackEnabled()))
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
  public ProviderTestResponse testProvider(long userId) {
    UserAiSettingsRecord row = settings.findByUserId(userId).orElse(null);
    if (row == null || row.apiKeyEncrypted() == null || row.apiKeyEncrypted().isBlank()) {
      return new ProviderTestResponse(
          "unavailable", false, row == null ? null : row.modelName(), row == null ? null : row.baseUrl(), null, "unavailable", "Provider API key is not configured");
    }
    String apiKey = decrypt(row.apiKeyEncrypted());
    Instant now = clock.now();
    try {
      aiProvider.gradeWritingRaw(
          new AiProviderConfig(apiKey, row.baseUrl(), row.modelName(), row.jsonFallbackEnabled()),
          "请用一句话回复 Markdown 批改能力正常。",
          "provider_test");
      settings.updateProviderStatus(row.id(), "succeeded", now, null, "raw_text");
      return new ProviderTestResponse(
          "succeeded", true, row.modelName(), row.baseUrl(), "raw_text", null, "Provider 测试成功");
    } catch (AiProviderException error) {
      settings.updateProviderStatus(row.id(), "failed", now, error.classification().value(), null);
      return new ProviderTestResponse(
          error.classification() == AiClassification.UNAVAILABLE ? "unavailable" : "failed",
          true,
          row.modelName(),
          row.baseUrl(),
          null,
          error.classification().value(),
          error.classification().userMessage());
    }
  }

  public AiProviderConfig providerConfig(UserAiSettingsRecord row) {
    return new AiProviderConfig(
        decrypt(row.apiKeyEncrypted()), row.baseUrl(), row.modelName(), row.jsonFallbackEnabled());
  }

  public String decrypt(String encrypted) {
    if (encrypted == null || encrypted.isBlank()) {
      return null;
    }
    try {
      return encryption.decrypt(encrypted);
    } catch (IllegalArgumentException error) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Provider API key cannot be decrypted");
    }
  }

  public WritingAISettingsResponse toResponse(UserAiSettingsRecord row) {
    return new WritingAISettingsResponse(
        row.id(),
        row.providerName(),
        row.baseUrl(),
        row.modelName(),
        row.jsonFallbackEnabled(),
        row.apiKeyEncrypted() != null && !row.apiKeyEncrypted().isBlank(),
        row.apiKeyHint(),
        row.lastTestStatus(),
        row.lastTestedAt(),
        row.lastFailureClassification(),
        row.lastSuccessfulMode());
  }

  private WritingAISettingsResponse defaultResponse() {
    return new WritingAISettingsResponse(
        null,
        "openai-compatible",
        properties.openaiApiBase(),
        properties.openaiModelName(),
        properties.writingLlmJsonFallback(),
        false,
        null,
        null,
        null,
        null,
        null);
  }

  public UserAiSettingsRecord requireConfiguredSettings(long userId) {
    UserAiSettingsRecord row = settings.findByUserId(userId).orElse(null);
    if (row == null || row.apiKeyEncrypted() == null || row.apiKeyEncrypted().isBlank()) {
      throw new AiProviderException(AiClassification.UNAVAILABLE, "user provider api key missing");
    }
    return row;
  }

  public void recordSuccess(UserAiSettingsRecord row, Instant now) {
    settings.updateProviderStatus(row.id(), "succeeded", now, null, "raw_text");
  }

  public void recordFailure(UserAiSettingsRecord row, Instant now, AiClassification classification) {
    settings.updateProviderStatus(row.id(), "failed", now, classification.value(), null);
  }

  public static String normalizeBaseUrl(String value) {
    String normalized = normalizeOrDefault(value, "https://api.openai.com/v1");
    URI uri;
    try {
      uri = URI.create(normalized);
    } catch (IllegalArgumentException error) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Provider base URL is invalid");
    }
    if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
        || uri.getHost() == null) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Provider base URL must be http or https");
    }
    while (normalized.endsWith("/") && normalized.length() > 1) {
      normalized = normalized.substring(0, normalized.length() - 1);
    }
    return normalized;
  }

  private static String firstText(String... values) {
    if (values == null) {
      return null;
    }
    for (String value : values) {
      if (value != null && !value.trim().isBlank()) {
        return value.trim();
      }
    }
    return null;
  }

  private static String normalizeOrDefault(String value, String defaultValue) {
    String normalized = value == null ? "" : value.trim();
    return normalized.isBlank() ? defaultValue : normalized;
  }
}

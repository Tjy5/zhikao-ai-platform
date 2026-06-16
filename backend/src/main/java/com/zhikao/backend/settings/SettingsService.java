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
  private final PlatformSettingsService platformSettingsService;
  private final Clock clock;
  private final AiProvider aiProvider;

  public SettingsService(
      UserAiSettingsRepository settings,
      ApiKeyEncryptionService encryption,
      AppProperties properties,
      PlatformSettingsService platformSettingsService,
      Clock clock,
      AiProvider aiProvider) {
    this.settings = settings;
    this.encryption = encryption;
    this.properties = properties;
    this.platformSettingsService = platformSettingsService;
    this.clock = clock;
    this.aiProvider = aiProvider;
  }

  public WritingAISettingsResponse get(long userId) {
    return settings
        .findByUserId(userId)
        .map(this::toResponse)
        .orElseGet(() -> platformSettingsService.toWritingResponse(platformSettingsService.current()));
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
    var global = saved == null ? platformSettingsService.current() : null;
    String baseUrl =
        normalizeBaseUrl(
            firstText(
                request == null ? null : request.baseUrl(),
                saved == null ? null : saved.baseUrl(),
                global == null ? null : global.writingBaseUrl(),
                properties.openaiApiBase()));
    String apiKey =
        firstText(
            request == null ? null : request.apiKey(),
            saved == null ? null : decrypt(saved.apiKeyEncrypted()),
            global == null ? null : decrypt(global.writingApiKeyEncrypted()));
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
                  saved == null ? global.writingModelName() : saved.modelName(),
                  saved == null ? global.writingJsonFallbackEnabled() : saved.jsonFallbackEnabled()))
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
    EffectiveAiSettings effective;
    try {
      effective = requireEffectiveSettings(userId);
    } catch (AiProviderException error) {
      return new ProviderTestResponse(
          "unavailable", false, null, null, null, "unavailable", "Provider API key is not configured");
    }
    Instant now = clock.now();
    try {
      aiProvider.gradeWritingRaw(
          effective.config(),
          "请用一句话回复 Markdown 批改能力正常。",
          "provider_test");
      recordSuccess(effective, now);
      return new ProviderTestResponse(
          "succeeded",
          true,
          effective.config().modelName(),
          effective.config().baseUrl(),
          "raw_text",
          null,
          "Provider 测试成功");
    } catch (AiProviderException error) {
      recordFailure(effective, now, error.classification());
      return new ProviderTestResponse(
          error.classification() == AiClassification.UNAVAILABLE ? "unavailable" : "failed",
          true,
          effective.config().modelName(),
          effective.config().baseUrl(),
          null,
          error.classification().value(),
          error.classification().userMessage());
    }
  }

  public AiProviderConfig providerConfig(EffectiveAiSettings effective) {
    return effective.config();
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

  public EffectiveAiSettings requireEffectiveSettings(long userId) {
    UserAiSettingsRecord row = settings.findByUserId(userId).orElse(null);
    if (row != null) {
      if (row.apiKeyEncrypted() == null || row.apiKeyEncrypted().isBlank()) {
        throw new AiProviderException(AiClassification.UNAVAILABLE, "user provider api key missing");
      }
      return new EffectiveAiSettings(
          "user",
          row.id(),
          new AiProviderConfig(
              decrypt(row.apiKeyEncrypted()), row.baseUrl(), row.modelName(), row.jsonFallbackEnabled()));
    }
    return platformSettingsService.requireConfiguredGlobalSettings();
  }

  public void recordSuccess(EffectiveAiSettings effective, Instant now) {
    if (effective.isUserScoped()) {
      settings.updateProviderStatus(effective.statusTargetId(), "succeeded", now, null, "raw_text");
    } else {
      platformSettingsService.recordGlobalSuccess(now);
    }
  }

  public void recordFailure(EffectiveAiSettings effective, Instant now, AiClassification classification) {
    if (effective.isUserScoped()) {
      settings.updateProviderStatus(effective.statusTargetId(), "failed", now, classification.value(), null);
    } else {
      platformSettingsService.recordGlobalFailure(now, classification);
    }
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

  public static String firstText(String... values) {
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

  public static String normalizeOrDefault(String value, String defaultValue) {
    String normalized = value == null ? "" : value.trim();
    return normalized.isBlank() ? defaultValue : normalized;
  }
}

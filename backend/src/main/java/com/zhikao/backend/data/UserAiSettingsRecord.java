package com.zhikao.backend.data;

import java.time.Instant;

public record UserAiSettingsRecord(
    long id,
    long userId,
    String providerName,
    String baseUrl,
    String modelName,
    String apiKeyEncrypted,
    String apiKeyHint,
    boolean jsonFallbackEnabled,
    Instant createdAt,
    Instant updatedAt,
    String lastTestStatus,
    Instant lastTestedAt,
    String lastFailureClassification,
    String lastSuccessfulMode) {}

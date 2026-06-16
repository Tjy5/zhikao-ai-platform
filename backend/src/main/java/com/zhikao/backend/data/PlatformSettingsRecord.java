package com.zhikao.backend.data;

import java.time.Instant;

public record PlatformSettingsRecord(
    long id,
    String writingProviderName,
    String writingBaseUrl,
    String writingModelName,
    String writingApiKeyEncrypted,
    String writingApiKeyHint,
    boolean writingJsonFallbackEnabled,
    boolean publicRegistrationEnabled,
    boolean contentProposalsEnabled,
    boolean rejectNoteRequired,
    boolean adminDirectPublishEnabled,
    boolean contentRevertEnabled,
    Instant createdAt,
    Instant updatedAt,
    String lastTestStatus,
    Instant lastTestedAt,
    String lastFailureClassification,
    String lastSuccessfulMode) {}

package com.zhikao.backend.study;

import java.time.Instant;

/**
 * Row record for {@code study_section}. {@code currentRevisionId} and {@code updatedBy} are
 * nullable ({@code null} for a freshly seeded section before any published revision / system seed).
 */
public record StudySectionRecord(
    String sectionKey, Long currentRevisionId, Instant updatedAt, Long updatedBy) {}

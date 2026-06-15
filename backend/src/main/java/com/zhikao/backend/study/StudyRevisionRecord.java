package com.zhikao.backend.study;

import java.time.Instant;

/**
 * Row record for {@code study_revision}. {@code contentJson} is the append-only content snapshot;
 * it is never mutated after insert. Nullable fields cover system seed ({@code authorId}) and the
 * state-specific review / parent metadata.
 */
public record StudyRevisionRecord(
    Long id,
    String sectionKey,
    String contentJson,
    Long authorId,
    Instant createdAt,
    String changeSummary,
    String status,
    String action,
    Long parentRevisionId,
    Long reviewerId,
    Instant reviewedAt,
    String reviewNote) {}

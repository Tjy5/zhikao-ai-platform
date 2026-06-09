package com.zhikao.backend.data;

import java.time.Instant;

public record HistoryRecord(
    String id,
    Long userId,
    Instant createdAt,
    String kind,
    String taskType,
    Double score,
    String requestJson,
    String responseJson,
    String extraJson) {}

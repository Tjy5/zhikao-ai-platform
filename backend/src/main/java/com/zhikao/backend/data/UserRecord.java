package com.zhikao.backend.data;

import java.time.Instant;

public record UserRecord(
    long id,
    String username,
    String email,
    String hashedPassword,
    boolean active,
    Instant createdAt,
    Instant updatedAt) {}

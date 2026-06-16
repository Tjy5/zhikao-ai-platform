package com.zhikao.backend.admin;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public final class AdminUserDtos {
  private AdminUserDtos() {}

  public record AdminUserSummary(
      long id,
      String username,
      String email,
      @JsonProperty("is_active") boolean active,
      String role,
      @JsonProperty("created_at") Instant createdAt,
      @JsonProperty("updated_at") Instant updatedAt) {}

  public record AdminUserListResponse(
      java.util.List<AdminUserSummary> users, int total, int limit, int offset) {}

  public record RoleUpdateRequest(String role) {}

  public record ActiveUpdateRequest(@JsonProperty("is_active") Boolean active) {}
}

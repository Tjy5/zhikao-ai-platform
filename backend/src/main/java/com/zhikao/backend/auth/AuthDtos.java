package com.zhikao.backend.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public final class AuthDtos {
  private AuthDtos() {}

  public record RegisterRequest(
      @NotBlank String username, @Email @NotBlank String email, @NotBlank String password) {}

  public record LoginRequest(
      @JsonProperty("username_or_email") @NotBlank String usernameOrEmail,
      @NotBlank String password) {}

  public record UserResponse(
      long id,
      String username,
      String email,
      @JsonProperty("is_active") boolean active) {}

  public record TokenResponse(
      @JsonProperty("access_token") String accessToken,
      @JsonProperty("token_type") String tokenType,
      @JsonProperty("expires_in") int expiresIn) {}
}

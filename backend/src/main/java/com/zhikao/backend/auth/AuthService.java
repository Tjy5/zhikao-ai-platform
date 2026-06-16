package com.zhikao.backend.auth;

import com.zhikao.backend.auth.AuthDtos.LoginRequest;
import com.zhikao.backend.auth.AuthDtos.RegisterRequest;
import com.zhikao.backend.auth.AuthDtos.TokenResponse;
import com.zhikao.backend.auth.AuthDtos.UserResponse;
import com.zhikao.backend.common.Clock;
import com.zhikao.backend.data.UserRecord;
import com.zhikao.backend.data.UserRepository;
import com.zhikao.backend.security.JwtService;
import com.zhikao.backend.settings.PlatformSettingsService;
import java.time.Instant;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
  private final UserRepository users;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;
  private final PlatformSettingsService platformSettingsService;
  private final Clock clock;

  public AuthService(
      UserRepository users,
      PasswordEncoder passwordEncoder,
      JwtService jwtService,
      PlatformSettingsService platformSettingsService,
      Clock clock) {
    this.users = users;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
    this.platformSettingsService = platformSettingsService;
    this.clock = clock;
  }

  @Transactional
  public UserResponse register(RegisterRequest request) {
    platformSettingsService.requirePublicRegistrationEnabled();
    String username = normalizeUsername(request.username());
    String email = normalizeEmail(request.email());
    if (users.existsByUsernameOrEmail(username, email)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名或邮箱已被注册");
    }
    Instant now = clock.now();
    UserRecord user = users.insert(username, email, passwordEncoder.encode(request.password()), now);
    return toResponse(user);
  }

  public TokenResponse login(LoginRequest request) {
    String lookup = request.usernameOrEmail().trim();
    String emailLookup = lookup.toLowerCase(Locale.ROOT);
    UserRecord user =
        users.findByUsernameOrEmail(lookup, emailLookup)
            .filter(UserRecord::active)
            .filter(candidate -> passwordEncoder.matches(request.password(), candidate.hashedPassword()))
            .orElseThrow(() -> new BadCredentialsException("bad credentials"));
    return new TokenResponse(jwtService.createAccessToken(user.id()), "bearer", jwtService.expiresInSeconds());
  }

  public UserResponse toResponse(UserRecord user) {
    return new UserResponse(user.id(), user.username(), user.email(), user.active(), user.role());
  }

  private static String normalizeUsername(String value) {
    String normalized = value == null ? "" : value.trim();
    if (normalized.isBlank()) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "用户名不能为空");
    }
    return normalized;
  }

  private static String normalizeEmail(String value) {
    String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    if (normalized.isBlank()) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "邮箱不能为空");
    }
    return normalized;
  }
}

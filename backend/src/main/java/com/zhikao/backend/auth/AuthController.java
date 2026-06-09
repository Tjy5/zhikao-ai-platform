package com.zhikao.backend.auth;

import com.zhikao.backend.auth.AuthDtos.LoginRequest;
import com.zhikao.backend.auth.AuthDtos.RegisterRequest;
import com.zhikao.backend.auth.AuthDtos.TokenResponse;
import com.zhikao.backend.auth.AuthDtos.UserResponse;
import com.zhikao.backend.data.UserRepository;
import com.zhikao.backend.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthService authService;
  private final UserRepository users;

  public AuthController(AuthService authService, UserRepository users) {
    this.authService = authService;
    this.users = users;
  }

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  public UserResponse register(@Valid @RequestBody RegisterRequest request) {
    return authService.register(request);
  }

  @PostMapping("/login")
  public TokenResponse login(@Valid @RequestBody LoginRequest request) {
    return authService.login(request);
  }

  @GetMapping("/me")
  public UserResponse me(Authentication authentication) {
    CurrentUser principal = (CurrentUser) authentication.getPrincipal();
    return users.findById(principal.id()).map(authService::toResponse).orElseThrow();
  }
}

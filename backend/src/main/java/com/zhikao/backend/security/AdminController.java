package com.zhikao.backend.security;

import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
  @GetMapping("/ping")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> ping() {
    return Map.of("ok", true);
  }
}

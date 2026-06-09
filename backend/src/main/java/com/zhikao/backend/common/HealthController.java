package com.zhikao.backend.common;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
  @GetMapping("/")
  public Map<String, String> root() {
    return Map.of("message", "AI Writing Feedback Platform API");
  }

  @GetMapping("/health")
  public Map<String, String> health() {
    return Map.of("status", "healthy");
  }
}

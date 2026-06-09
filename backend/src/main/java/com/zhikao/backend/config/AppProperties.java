package com.zhikao.backend.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
    boolean debug,
    String corsOrigins,
    String secretKey,
    int accessTokenExpireMinutes,
    String modelSettingsEncryptionKey,
    String openaiApiKey,
    String openaiApiBase,
    String openaiModelName,
    boolean writingLlmJsonFallback) {

  public List<String> corsOriginList() {
    if (corsOrigins == null || corsOrigins.isBlank()) {
      return List.of();
    }
    return Arrays.stream(corsOrigins.split(","))
        .map(String::trim)
        .filter(value -> !value.isBlank())
        .distinct()
        .toList();
  }
}

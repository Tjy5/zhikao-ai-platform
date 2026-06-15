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
    boolean writingLlmJsonFallback,
    String adminUsernames) {

  public List<String> corsOriginList() {
    return splitCommaList(corsOrigins);
  }

  public List<String> adminUsernameList() {
    return splitCommaList(adminUsernames);
  }

  private static List<String> splitCommaList(String value) {
    if (value == null || value.isBlank()) {
      return List.of();
    }
    return Arrays.stream(value.split(","))
        .map(String::trim)
        .filter(part -> !part.isBlank())
        .distinct()
        .toList();
  }
}

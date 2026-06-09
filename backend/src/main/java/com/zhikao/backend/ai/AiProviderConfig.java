package com.zhikao.backend.ai;

public record AiProviderConfig(
    String apiKey, String baseUrl, String modelName, boolean jsonFallbackEnabled) {
  public boolean configured() {
    return apiKey != null && !apiKey.isBlank();
  }
}

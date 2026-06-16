package com.zhikao.backend.settings;

import com.zhikao.backend.ai.AiProviderConfig;

public record EffectiveAiSettings(
    String source,
    Long statusTargetId,
    AiProviderConfig config) {
  public boolean isUserScoped() {
    return "user".equals(source);
  }
}

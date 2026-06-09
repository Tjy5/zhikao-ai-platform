package com.zhikao.backend.writing;

import com.zhikao.backend.data.UserAiSettingsRecord;
import com.zhikao.backend.data.UserAiSettingsRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class AiStatusService {
  private final UserAiSettingsRepository settings;

  public AiStatusService(UserAiSettingsRepository settings) {
    this.settings = settings;
  }

  public Map<String, Object> status(long userId) {
    UserAiSettingsRecord row = settings.findByUserId(userId).orElse(null);
    if (row == null || row.apiKeyEncrypted() == null || row.apiKeyEncrypted().isBlank()) {
      Map<String, Object> capability = new LinkedHashMap<>();
      capability.put("configured", false);
      capability.put("last_successful_mode", null);
      capability.put("last_failure_classification", "unavailable");
      capability.put("json_fallback_enabled", row == null || row.jsonFallbackEnabled());

      Map<String, Object> payload = basePayload("unavailable", "unavailable", capability);
      payload.put("reason", "User provider API key is not configured");
      payload.put("model", row == null ? null : row.modelName());
      payload.put("base_url", row == null ? null : row.baseUrl());
      return payload;
    }

    String writingFeedbackStatus;
    if (isSuccessMode(row.lastSuccessfulMode())) {
      writingFeedbackStatus = "available";
    } else if (row.lastFailureClassification() != null) {
      writingFeedbackStatus = "error";
    } else {
      writingFeedbackStatus = "unverified";
    }
    Map<String, Object> capability = new LinkedHashMap<>();
    capability.put("configured", true);
    capability.put("last_successful_mode", row.lastSuccessfulMode());
    capability.put(
        "last_failure_classification",
        isSuccessMode(row.lastSuccessfulMode()) ? null : row.lastFailureClassification());
    capability.put("json_fallback_enabled", row.jsonFallbackEnabled());

    Map<String, Object> payload = basePayload("active", writingFeedbackStatus, capability);
    payload.put("model", row.modelName());
    payload.put("base_url", row.baseUrl());
    return payload;
  }

  private static boolean isSuccessMode(String value) {
    return "structured_output".equals(value) || "json_fallback".equals(value) || "raw_text".equals(value);
  }

  private static Map<String, Object> basePayload(
      String status, String writingFeedbackStatus, Map<String, Object> capability) {
    Map<String, Object> services = new LinkedHashMap<>();
    services.put("task_type_detection", writingFeedbackStatus);
    services.put("writing_feedback", writingFeedbackStatus);
    services.put("text_processing", "available");

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("status", status);
    payload.put("services", services);
    payload.put("version", "2.0.0");
    payload.put("capability", capability);
    return payload;
  }
}

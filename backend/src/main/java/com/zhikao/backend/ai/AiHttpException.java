package com.zhikao.backend.ai;

import java.util.Map;
import org.springframework.http.HttpStatus;

public class AiHttpException extends RuntimeException {
  private final HttpStatus status;
  private final Map<String, Object> detail;

  public AiHttpException(AiClassification classification) {
    super(classification.value());
    this.status = classification.httpStatus();
    this.detail =
        Map.of(
            "classification", classification.value(),
            "message", classification.userMessage(),
            "retryable", classification.retryable());
  }

  public HttpStatus status() {
    return status;
  }

  public Map<String, Object> detail() {
    return detail;
  }
}

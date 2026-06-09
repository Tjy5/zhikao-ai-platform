package com.zhikao.backend.ai;

import org.springframework.http.HttpStatus;

public enum AiClassification {
  UNAVAILABLE("unavailable", HttpStatus.SERVICE_UNAVAILABLE, true, "AI 服务暂不可用，请先配置模型 API key"),
  AUTHENTICATION("authentication", HttpStatus.UNAUTHORIZED, false, "AI 服务鉴权失败，请检查 API key"),
  TIMEOUT("timeout", HttpStatus.GATEWAY_TIMEOUT, true, "AI 服务请求超时，请稍后重试"),
  RATE_LIMIT("rate_limit", HttpStatus.TOO_MANY_REQUESTS, true, "AI 服务请求过于频繁，请稍后重试"),
  REFUSAL("refusal", HttpStatus.BAD_GATEWAY, false, "AI 服务拒绝处理本次内容"),
  MALFORMED_OUTPUT("malformed_output", HttpStatus.BAD_GATEWAY, true, "AI 服务返回结果格式异常"),
  PROVIDER_ERROR("provider_error", HttpStatus.BAD_GATEWAY, true, "AI 服务返回错误"),
  UNKNOWN("unknown", HttpStatus.BAD_GATEWAY, true, "AI 服务调用失败");

  private final String value;
  private final HttpStatus httpStatus;
  private final boolean retryable;
  private final String userMessage;

  AiClassification(String value, HttpStatus httpStatus, boolean retryable, String userMessage) {
    this.value = value;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    this.userMessage = userMessage;
  }

  public String value() {
    return value;
  }

  public HttpStatus httpStatus() {
    return httpStatus;
  }

  public boolean retryable() {
    return retryable;
  }

  public String userMessage() {
    return userMessage;
  }
}

package com.zhikao.backend.common;

import com.zhikao.backend.ai.AiHttpException;
import com.zhikao.backend.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
  private static final Logger logger = LoggerFactory.getLogger(ApiExceptionHandler.class);
  private final AppProperties properties;

  public ApiExceptionHandler(AppProperties properties) {
    this.properties = properties;
  }

  @ExceptionHandler(AiHttpException.class)
  ResponseEntity<Map<String, Object>> aiError(AiHttpException error) {
    return ResponseEntity.status(error.status()).body(Map.of("detail", error.detail()));
  }

  @ExceptionHandler(BadCredentialsException.class)
  ResponseEntity<Map<String, String>> badCredentials() {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(Map.of("detail", "无法验证当前用户"));
  }

  @ExceptionHandler(AccessDeniedException.class)
  ResponseEntity<Map<String, String>> accessDenied() {
    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("detail", "权限不足"));
  }

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<Map<String, String>> responseStatus(ResponseStatusException error) {
    return ResponseEntity.status(error.getStatusCode())
        .body(Map.of("detail", error.getReason() == null ? "请求失败" : error.getReason()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException error) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("detail", "请求参数无效");
    body.put(
        "errors",
        error.getBindingResult().getFieldErrors().stream()
            .map(ApiExceptionHandler::fieldError)
            .toList());
    return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(body);
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, Object>> unhandled(Exception error, HttpServletRequest request) {
    logger.error(
        "Unhandled exception method={} uri={}",
        request.getMethod(),
        request.getRequestURI(),
        error);
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("detail", "内部服务器错误");
    if (properties.debug()) {
      body.put("error_type", error.getClass().getName());
      body.put("error", error.getMessage());
      body.put("request_url", request.getRequestURI());
      body.put("request_method", request.getMethod());
    }
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
  }

  private static Map<String, String> fieldError(FieldError error) {
    return Map.of(
        "field", error.getField(),
        "message", error.getDefaultMessage() == null ? "invalid" : error.getDefaultMessage());
  }
}

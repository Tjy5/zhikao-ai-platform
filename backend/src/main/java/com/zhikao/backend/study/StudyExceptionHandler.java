package com.zhikao.backend.study;

import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Maps a malformed JSON request body (a {@link HttpMessageNotReadableException}, thrown by Jackson
 * during {@code @RequestBody} binding — before {@link StudyService} runs, so {@link
 * StudySectionShape} never sees it) to 400. Without this it falls through the generic {@code
 * Exception} handler in {@code ApiExceptionHandler} and returns 500.
 *
 * <p>This handler only registers {@link HttpMessageNotReadableException} (a universally-correct
 * 400), leaving every other exception type to {@code ApiExceptionHandler}. It lives in the study
 * package because that is the only endpoint surface that currently exercises malformed bodies in
 * tests, but the mapping is correct for any controller.
 *
 * <p>{@link Order}({@link Ordered#HIGHEST_PRECEDENCE}) is required because {@code
 * ApiExceptionHandler} declares a catch-all {@code @ExceptionHandler(Exception.class)} and Spring
 * resolves {@code @ControllerAdvice} in order, returning the first advice that matches; without the
 * explicit order that advice is consulted first and the catch-all would swallow this case (500).
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class StudyExceptionHandler {

  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<Map<String, String>> malformedJson(HttpMessageNotReadableException error) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(Map.of("detail", "请求体格式无效：content_json 必须是合法 JSON"));
  }
}

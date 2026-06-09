package com.zhikao.backend.writing;

import com.zhikao.backend.ai.AiHttpException;
import com.zhikao.backend.common.JsonService;
import com.zhikao.backend.security.CurrentUser;
import com.zhikao.backend.writing.WritingDtos.RawWritingFeedbackResult;
import com.zhikao.backend.writing.WritingDtos.WritingSubmission;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/writings")
public class WritingController {
  private final WritingService writingService;
  private final HistoryService historyService;
  private final AiStatusService aiStatusService;
  private final JsonService json;

  public WritingController(
      WritingService writingService,
      HistoryService historyService,
      AiStatusService aiStatusService,
      JsonService json) {
    this.writingService = writingService;
    this.historyService = historyService;
    this.aiStatusService = aiStatusService;
    this.json = json;
  }

  @PostMapping("/grade")
  public RawWritingFeedbackResult grade(
      Authentication authentication, @Valid @RequestBody WritingSubmission submission) {
    return writingService.grade(currentUser(authentication).id(), submission, "grade");
  }

  @PostMapping(value = "/grade-progressive", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public ResponseEntity<String> gradeProgressive(
      Authentication authentication, @Valid @RequestBody WritingSubmission submission) {
    Map<String, Object> event;
    try {
      RawWritingFeedbackResult result =
          writingService.grade(currentUser(authentication).id(), submission, "progressive");
      event = new LinkedHashMap<>();
      event.put("stage", 2);
      event.put("progress", 100);
      event.put("status", "评分完成");
      event.put("message", "AI评分已完成");
      event.put("partial", false);
      event.put("content", result.content());
      event.put("contentFormat", result.contentFormat());
    } catch (AiHttpException error) {
      Map<String, Object> detail = error.detail();
      event = new LinkedHashMap<>();
      event.put("stage", "error");
      event.put("progress", 0);
      event.put("status", "评分失败");
      event.put("message", detail.get("message"));
      event.put("classification", detail.get("classification"));
      event.put("retryable", detail.get("retryable"));
      event.put("partial", false);
    }
    return ResponseEntity.ok()
        .contentType(MediaType.TEXT_EVENT_STREAM)
        .cacheControl(CacheControl.noCache())
        .header(HttpHeaders.CONNECTION, "keep-alive")
        .header("X-Accel-Buffering", "no")
        .body("data: " + json.toJson(event) + "\n\n");
  }

  @GetMapping("/ai-status")
  public Map<String, Object> aiStatus(Authentication authentication) {
    return aiStatusService.status(currentUser(authentication).id());
  }

  @GetMapping("/history")
  public Map<String, Object> history(
      Authentication authentication, @RequestParam(required = false) Integer limit) {
    return historyService.list(currentUser(authentication).id(), limit);
  }

  @GetMapping("/history/{id}")
  public Map<String, Object> historyDetail(Authentication authentication, @PathVariable String id) {
    return historyService.detail(currentUser(authentication).id(), id);
  }

  @DeleteMapping("/history")
  public Map<String, Integer> clearHistory(Authentication authentication) {
    return historyService.clear(currentUser(authentication).id());
  }

  private static CurrentUser currentUser(Authentication authentication) {
    return (CurrentUser) authentication.getPrincipal();
  }
}

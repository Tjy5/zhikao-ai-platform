package com.zhikao.backend.writing;

import com.zhikao.backend.common.Clock;
import com.zhikao.backend.common.JsonService;
import com.zhikao.backend.data.HistoryRecord;
import com.zhikao.backend.data.HistoryRepository;
import com.zhikao.backend.writing.WritingDtos.RawWritingFeedbackResult;
import com.zhikao.backend.writing.WritingDtos.WritingSubmission;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class HistoryService {
  private final HistoryRepository history;
  private final JsonService json;
  private final Clock clock;

  public HistoryService(HistoryRepository history, JsonService json, Clock clock) {
    this.history = history;
    this.json = json;
    this.clock = clock;
  }

  public void append(
      long userId, String kind, WritingSubmission submission, RawWritingFeedbackResult result) {
    Instant now = clock.now();
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("content", submission.content());
    request.put("task_type", submission.taskType());
    Map<String, Object> response = responseMap(result);
    history.insert(
        UUID.randomUUID().toString(),
        userId,
        now,
        kind,
        submission.taskType(),
        null,
        json.toJson(request),
        json.toJson(response),
        null);
  }

  public Map<String, Object> list(long userId, Integer requestedLimit) {
    int limit = Math.max(1, Math.min(requestedLimit == null ? 50 : requestedLimit, 200));
    List<Map<String, Object>> items =
        history.listByUserId(userId, limit).stream().map(this::summary).toList();
    return Map.of("items", items);
  }

  public Map<String, Object> detail(long userId, String id) {
    HistoryRecord record =
        history
            .findByUserIdAndId(userId, id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "历史记录不存在"));
    Map<String, Object> detail = base(record);
    detail.put("request", json.toMap(record.requestJson()));
    detail.put("response", json.toMap(record.responseJson()));
    if (record.extraJson() != null && !record.extraJson().isBlank()) {
      detail.put("extra", json.toMap(record.extraJson()));
    }
    return detail;
  }

  public Map<String, Integer> clear(long userId) {
    return Map.of("deleted", history.clearByUserId(userId));
  }

  private Map<String, Object> summary(HistoryRecord record) {
    Map<String, Object> item = base(record);
    item.put("taskType", record.taskType());
    item.put("score", record.score());
    Map<String, Object> response = json.toMap(record.responseJson());
    item.put("content", response.get("content"));
    item.put("contentFormat", response.get("contentFormat"));
    return item;
  }

  private static Map<String, Object> responseMap(RawWritingFeedbackResult result) {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("content", result.content());
    response.put("contentFormat", result.contentFormat());
    return response;
  }

  private static Map<String, Object> base(HistoryRecord record) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("id", record.id());
    item.put("timestamp", record.createdAt().toString());
    item.put("type", record.kind());
    return item;
  }
}

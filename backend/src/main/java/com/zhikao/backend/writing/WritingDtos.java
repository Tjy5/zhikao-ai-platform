package com.zhikao.backend.writing;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public final class WritingDtos {
  private WritingDtos() {}

  public record WritingSubmission(
      @NotBlank String content, @JsonProperty("task_type") String taskType) {}

  public record RawWritingFeedbackResult(String content, String contentFormat) {
    public RawWritingFeedbackResult(String content) {
      this(content == null ? "" : content.trim(), "markdown");
    }
  }
}

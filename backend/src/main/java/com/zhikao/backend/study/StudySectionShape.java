package com.zhikao.backend.study;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * The 9 fixed {@code section_key}s (parent design.md §1) and their top-level {@code content_json}
 * shape. Acts as the section whitelist ({@link #forKey} throws 404 for unknown keys) and the
 * structural validator (top-level type + array-element type). Field-level / semantic validation is
 * intentionally NOT performed — the backend holds no content knowledge (parent §1).
 */
public enum StudySectionShape {
  STUDY_ROUTE("study-route", TopLevel.OBJECT),
  EXAM_SCAN("exam-scan", TopLevel.ARRAY),
  REVIEW_RULES("review-rules", TopLevel.ARRAY),
  MATERIAL_MOVES("material-moves", TopLevel.ARRAY),
  QUESTION_GUIDES("question-guides", TopLevel.ARRAY),
  FORMAT_MATRIX("format-matrix", TopLevel.ARRAY),
  ESSAY_RULES("essay-rules", TopLevel.ARRAY),
  PITFALLS("pitfalls", TopLevel.ARRAY),
  TRAINING_PLAN("training-plan", TopLevel.OBJECT);

  /** All 9 whitelisted keys, in declaration order. */
  public static final Set<String> KEYS =
      Stream.of(values()).map(StudySectionShape::key).collect(Collectors.toUnmodifiableSet());

  private final String sectionKey;
  private final TopLevel top;

  StudySectionShape(String sectionKey, TopLevel top) {
    this.sectionKey = sectionKey;
    this.top = top;
  }

  public String key() {
    return sectionKey;
  }

  /** Resolves a key to its shape; unknown keys throw 404 (per §1 whitelist). */
  public static StudySectionShape forKey(String key) {
    for (StudySectionShape shape : values()) {
      if (shape.sectionKey.equals(key)) {
        return shape;
      }
    }
    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未知的节：" + key);
  }

  /**
   * Structural validation of a parsed {@code content_json}: ② top-level type matches the shape;
   * ③ each array element is a JSON object. JSON parsability (①) is handled by Jackson during
   * request binding; the 64KB size limit (④) is enforced in {@link StudyService} (needs the
   * mapper).
   */
  public void validateStructure(JsonNode content) {
    if (content == null || content.isMissingNode() || content.isNull()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content_json 不能为空");
    }
    switch (top) {
      case OBJECT -> {
        if (!content.isObject()) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content_json 顶层必须是 JSON 对象");
        }
      }
      case ARRAY -> {
        if (!content.isArray()) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content_json 顶层必须是 JSON 数组");
        }
        int index = 0;
        for (JsonNode element : content) {
          if (!element.isObject()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "content_json 数组第 " + index + " 项必须是 JSON 对象");
          }
          index++;
        }
      }
    }
  }

  private enum TopLevel {
    ARRAY,
    OBJECT
  }
}

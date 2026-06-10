package com.zhikao.backend.eval;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.Test;

class WritingFeedbackEvalTests {
  private static final String BENCHMARK_RESOURCE = "/eval/writing-feedback-benchmark.json";
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void curatedFeedbackFixturesSatisfyOfflineWritingContract() throws Exception {
    JsonNode benchmark = loadBenchmark();

    for (JsonNode benchmarkCase : benchmark.path("cases")) {
      EvalResult result =
          evaluate(
              benchmark,
              benchmarkCase,
              benchmarkCase.path("passing_feedback").asText());

      assertThat(result.failures())
          .as("passing fixture should satisfy %s", benchmarkCase.path("id").asText())
          .isEmpty();
    }
  }

  @Test
  void weakFeedbackFixturesFailOfflineWritingContract() throws Exception {
    JsonNode benchmark = loadBenchmark();

    for (JsonNode benchmarkCase : benchmark.path("cases")) {
      EvalResult result =
          evaluate(
              benchmark,
              benchmarkCase,
              benchmarkCase.path("failing_feedback").asText());

      assertThat(result.failures())
          .as("failing fixture should be rejected for %s", benchmarkCase.path("id").asText())
          .isNotEmpty();
    }
  }

  private JsonNode loadBenchmark() throws Exception {
    try (InputStream stream = getClass().getResourceAsStream(BENCHMARK_RESOURCE)) {
      assertThat(stream).as("benchmark resource exists").isNotNull();
      return objectMapper.readTree(stream);
    }
  }

  private static EvalResult evaluate(JsonNode benchmark, JsonNode benchmarkCase, String feedback) {
    List<String> failures = new ArrayList<>();
    String normalized = normalize(feedback);
    if (normalized.isBlank()) {
      failures.add("feedback is blank");
      return new EvalResult(failures);
    }

    for (JsonNode section : benchmark.path("required_sections")) {
      String heading = section.asText();
      if (!hasMarkdownHeading(normalized, heading)) {
        failures.add("missing section: " + heading);
      }
    }

    int minimumLength = benchmark.path("minimum_feedback_length").asInt(320);
    if (normalized.length() < minimumLength) {
      failures.add("feedback is shorter than " + minimumLength + " characters");
    }

    int coveredDimensions = 0;
    for (JsonNode dimension : benchmarkCase.path("rubric_dimensions")) {
      if (containsIgnoreCase(normalized, dimension.asText())) {
        coveredDimensions++;
      }
    }
    int requiredDimensions = benchmarkCase.path("rubric_dimensions").size();
    if (coveredDimensions < requiredDimensions) {
      failures.add(
          "rubric coverage "
              + coveredDimensions
              + "/"
              + requiredDimensions
              + " for "
              + benchmarkCase.path("id").asText());
    }

    int minimumActionableMarkers = benchmark.path("minimum_actionable_markers").asInt(4);
    int actionableMarkers = countActionableMarkers(normalized);
    if (actionableMarkers < minimumActionableMarkers) {
      failures.add(
          "actionable marker count "
              + actionableMarkers
              + " is below "
              + minimumActionableMarkers);
    }

    return new EvalResult(failures);
  }

  private static boolean hasMarkdownHeading(String feedback, String heading) {
    return feedback.contains("## " + heading) || feedback.contains("# " + heading);
  }

  private static boolean containsIgnoreCase(String value, String needle) {
    return value.toLowerCase(Locale.ROOT).contains(needle.toLowerCase(Locale.ROOT));
  }

  private static String normalize(String value) {
    return value == null ? "" : value.replace("\r\n", "\n").trim();
  }

  private static int countActionableMarkers(String feedback) {
    String[] markers = {"建议", "可以", "应", "需要", "补充", "优化", "明确", "拆为", "建立"};
    int count = 0;
    for (String marker : markers) {
      int index = feedback.indexOf(marker);
      while (index >= 0) {
        count++;
        index = feedback.indexOf(marker, index + marker.length());
      }
    }
    return count;
  }

  private record EvalResult(List<String> failures) {}
}

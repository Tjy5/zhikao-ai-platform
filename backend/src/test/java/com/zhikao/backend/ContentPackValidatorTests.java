package com.zhikao.backend;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zhikao.backend.content.ContentPackValidationReport;
import com.zhikao.backend.content.ContentPackValidator;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ContentPackValidatorTests {
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final ContentPackValidator validator = new ContentPackValidator(objectMapper);

  @Test
  void bundledDemoPackIsValid() {
    ContentPackValidationReport report = validator.validate(Path.of("..", "content-samples"));

    assertThat(report.isValid()).isTrue();
    assertThat(report.getErrors()).isEmpty();
    assertThat(report.getPackId()).isEqualTo("open-civil-service-demo");
    assertThat(report.getItemCount()).isEqualTo(6);
  }

  @Test
  void missingLicenseOriginUnsafePathDuplicateAndPrivateTraceFail(@TempDir Path tmpDir)
      throws Exception {
    Path pack = writeMinimalPack(tmpDir);

    Map<String, Object> manifest = readJson(pack.resolve("manifest.json"));
    manifest.remove("license");
    writeJson(pack.resolve("manifest.json"), manifest);
    assertThat(validator.validate(pack).getErrors()).anyMatch(error -> error.contains("manifest: license"));

    pack = writeMinimalPack(tmpDir.resolve("missing-origin"));
    Map<String, Object> item = readJson(pack.resolve("questions/sample.json"));
    item.remove("originality_declaration");
    writeJson(pack.resolve("questions/sample.json"), item);
    assertThat(validator.validate(pack).getErrors())
        .anyMatch(error -> error.contains("original_only item needs originality_declaration"));

    pack = writeMinimalPack(tmpDir.resolve("unsafe"));
    manifest = readJson(pack.resolve("manifest.json"));
    ((Map<String, Object>) ((java.util.List<?>) manifest.get("items")).get(0)).put("path", "../outside.json");
    writeJson(pack.resolve("manifest.json"), manifest);
    assertThat(validator.validate(pack).getErrors()).anyMatch(error -> error.contains("escapes the pack directory"));

    pack = writeMinimalPack(tmpDir.resolve("duplicate"));
    manifest = readJson(pack.resolve("manifest.json"));
    Map<String, Object> duplicate =
        new java.util.LinkedHashMap<>((Map<String, Object>) ((java.util.List<?>) manifest.get("items")).get(0));
    duplicate.put("path", "questions/duplicate.json");
    ((java.util.List<Object>) manifest.get("items")).add(duplicate);
    writeJson(pack.resolve("manifest.json"), manifest);
    writeJson(pack.resolve("questions/duplicate.json"), readJson(pack.resolve("questions/sample.json")));
    assertThat(validator.validate(pack).getErrors()).anyMatch(error -> error.contains("duplicate item_id"));

    pack = writeMinimalPack(tmpDir.resolve("private-trace"));
    item = readJson(pack.resolve("questions/sample.json"));
    ((Map<String, Object>) item.get("body")).put("explanation", "private_material corpus text");
    writeJson(pack.resolve("questions/sample.json"), item);
    assertThat(validator.validate(pack).getErrors())
        .anyMatch(error -> error.contains("private or legacy trace"));
  }

  private Path writeMinimalPack(Path root) throws Exception {
    Path pack = root.resolve("pack");
    Files.createDirectories(pack.resolve("questions"));
    Map<String, Object> entry =
        new java.util.LinkedHashMap<>(
            Map.of(
                "path",
                "questions/sample.json",
                "item_id",
                "sample-question-001",
                "item_type",
                "practice_question",
                "title",
                "Sample Question",
                "license",
                "CC-BY-4.0",
                "origin_policy",
                "original_only",
                "review_status",
                "approved",
                "originality_declaration",
                "Created from scratch for tests."));
    Map<String, Object> manifest = new java.util.LinkedHashMap<>();
    manifest.put("schema_version", "1.0");
    manifest.put("pack_id", "test-pack");
    manifest.put("title", "Test Pack");
    manifest.put("description", "A minimal test pack.");
    manifest.put("version", "0.1.0");
    manifest.put("license", "CC-BY-4.0");
    manifest.put("copyright_holder", "Test contributors");
    manifest.put("origin_policy", "original_only");
    manifest.put("review_status", "approved");
    manifest.put("items", new java.util.ArrayList<>(java.util.List.of(entry)));

    Map<String, Object> item = new java.util.LinkedHashMap<>();
    item.put("item_id", "sample-question-001");
    item.put("item_type", "practice_question");
    item.put("title", "Sample Question");
    item.put("license", "CC-BY-4.0");
    item.put("copyright_holder", "Test contributors");
    item.put("origin_policy", "original_only");
    item.put("review_status", "approved");
    item.put("source_refs", java.util.List.of());
    item.put("originality_declaration", "Created from scratch for tests.");
    item.put(
        "body",
        new java.util.LinkedHashMap<>(
            Map.of(
                "stem",
                "Which option improves a public service workflow?",
                "answer_key",
                "B",
                "explanation",
                "This is an original unit-test item.")));
    writeJson(pack.resolve("manifest.json"), manifest);
    writeJson(pack.resolve("questions/sample.json"), item);
    return pack;
  }

  private Map<String, Object> readJson(Path path) throws Exception {
    return objectMapper.readValue(path.toFile(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
  }

  private void writeJson(Path path, Map<String, Object> payload) throws Exception {
    objectMapper.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), payload);
  }
}

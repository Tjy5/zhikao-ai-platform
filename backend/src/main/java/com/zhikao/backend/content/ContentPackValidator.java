package com.zhikao.backend.content;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class ContentPackValidator {
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
  private static final Set<String> PUBLIC_LICENSES = Set.of("CC-BY-4.0", "CC0-1.0", "Apache-2.0");
  private static final Set<String> PRIVATE_LICENSES =
      Set.of("LicenseRef-Private-Commercial", "LicenseRef-Internal-Only");
  private static final Set<String> ORIGIN_POLICIES =
      Set.of("original_only", "official_source_based", "mixed_with_review", "licensed_private");
  private static final Set<String> ITEM_TYPES =
      Set.of("knowledge_point", "practice_question", "writing_task");
  private static final Set<String> REVIEW_STATUSES =
      Set.of("draft", "needs_review", "approved", "rejected");
  private static final Set<String> MANIFEST_KEYS =
      Set.of(
          "schema_version",
          "pack_id",
          "title",
          "description",
          "version",
          "license",
          "copyright_holder",
          "origin_policy",
          "review_status",
          "source_refs",
          "items");
  private static final Set<String> ITEM_ENTRY_KEYS =
      Set.of(
          "path",
          "item_id",
          "item_type",
          "title",
          "license",
          "origin_policy",
          "review_status",
          "source_refs",
          "originality_declaration");
  private static final Set<String> ITEM_KEYS =
      Set.of(
          "item_id",
          "item_type",
          "title",
          "license",
          "copyright_holder",
          "origin_policy",
          "review_status",
          "source_refs",
          "originality_declaration",
          "body");
  private static final Set<String> PRIVATE_PATH_SEGMENTS =
      Set.of("private", "private-content", "private-material", "licensed-private", "legacy-corpus");
  private static final List<String> PRIVATE_TRACE_PATTERNS =
      List.of(
          "private_material",
          "private_corpus",
          "legacy_corpus",
          "licensed_private_pack",
          "commercial_training_pack",
          "unlicensed_question_bank",
          "local_private_backup");
  private static final List<Pattern> REAL_EXAM_PATTERNS =
      List.of(
          Pattern.compile("真题"),
          Pattern.compile("原题"),
          Pattern.compile("官方答案"),
          Pattern.compile("官方解析"),
          Pattern.compile("历年.{0,8}(试题|试卷|真题|原题)"),
          Pattern.compile("(19|20)\\d{2}.{0,16}(国考|省考|联考|公务员考试|事业单位考试).{0,16}(试题|试卷|真题|原题)"));

  private final ObjectMapper objectMapper;

  public ContentPackValidator(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public ContentPackValidationReport validate(Path packDir) {
    ContentPackValidationReport report = new ContentPackValidationReport(packDir.toString());
    Path manifestPath = packDir.resolve("manifest.json");
    if (!Files.exists(manifestPath)) {
      report.getErrors().add("manifest.json is missing");
      return finish(report);
    }
    Map<String, Object> manifest = loadJson(manifestPath, "manifest", report);
    if (manifest == null) {
      return finish(report);
    }
    appendTraceErrors(manifest, "manifest", report);
    validateObjectKeys("manifest", manifest, MANIFEST_KEYS, report);
    requireText(manifest, "license", "manifest", report);
    for (String required :
        List.of(
            "schema_version",
            "pack_id",
            "title",
            "description",
            "version",
            "copyright_holder",
            "origin_policy",
            "review_status")) {
      requireText(manifest, required, "manifest", report);
    }
    report.setPackId(asString(manifest.get("pack_id")));
    validateVocabulary("manifest.license", manifest.get("license"), licenseValues(), report);
    validateVocabulary("manifest.origin_policy", manifest.get("origin_policy"), ORIGIN_POLICIES, report);
    validateVocabulary("manifest.review_status", manifest.get("review_status"), REVIEW_STATUSES, report);
    if (!"approved".equals(asString(manifest.get("review_status")))) {
      report.getErrors().add("manifest.review_status must be approved for public validation");
    }
    if (looksLikePublicSample(packDir) && PRIVATE_LICENSES.contains(asString(manifest.get("license")))) {
      report.getErrors().add("content-samples cannot use a private license");
    }
    if (looksLikePublicSample(packDir) && "licensed_private".equals(asString(manifest.get("origin_policy")))) {
      report.getErrors().add("content-samples cannot use licensed_private origin_policy");
    }

    Object itemsValue = manifest.get("items");
    if (!(itemsValue instanceof List<?> items) || items.isEmpty()) {
      report.getErrors().add("manifest: items: must contain at least one item");
      return finish(report);
    }
    Set<String> seen = new HashSet<>();
    for (Object entryValue : items) {
      if (!(entryValue instanceof Map<?, ?> rawEntry)) {
        report.getErrors().add("manifest.items: item entry must be an object");
        continue;
      }
      Map<String, Object> entry = castMap(rawEntry);
      validateEntry(packDir, entry, seen, report);
    }
    report.setItemCount(seen.size());
    if (report.getErrors().isEmpty() && !"CC-BY-4.0".equals(asString(manifest.get("license")))) {
      report.getWarnings().add("public demo packs should normally use CC-BY-4.0");
    }
    return finish(report);
  }

  private void validateEntry(
      Path packDir, Map<String, Object> entry, Set<String> seen, ContentPackValidationReport report) {
    validateObjectKeys(asString(entry.get("path")), entry, ITEM_ENTRY_KEYS, report);
    for (String required :
        List.of("path", "item_id", "item_type", "title", "license", "origin_policy", "review_status")) {
      requireText(entry, required, asString(entry.get("path")), report);
    }
    validateVocabulary(asString(entry.get("path")) + ".item_type", entry.get("item_type"), ITEM_TYPES, report);
    validateVocabulary(asString(entry.get("path")) + ".license", entry.get("license"), licenseValues(), report);
    validateVocabulary(asString(entry.get("path")) + ".origin_policy", entry.get("origin_policy"), ORIGIN_POLICIES, report);
    validateVocabulary(asString(entry.get("path")) + ".review_status", entry.get("review_status"), REVIEW_STATUSES, report);
    validateOrigin(asString(entry.get("path")), entry, "manifest entry", report);
    Path itemPath = resolveItemPath(packDir, asString(entry.get("path")), report);
    if (itemPath == null) {
      return;
    }
    Map<String, Object> item = loadJson(itemPath, asString(entry.get("path")), report);
    if (item == null) {
      return;
    }
    appendTraceErrors(item, asString(entry.get("path")), report);
    validateObjectKeys(asString(entry.get("path")), item, ITEM_KEYS, report);
    validateOrigin(asString(entry.get("path")), item, "item", report);
    for (String field : List.of("item_id", "item_type", "title", "license", "origin_policy", "review_status")) {
      if (!asString(entry.get(field)).equals(asString(item.get(field)))) {
        report.getErrors().add(
            asString(entry.get("path")) + ": manifest " + field + " does not match item " + field);
      }
    }
    String itemId = asString(item.get("item_id"));
    if (seen.contains(itemId)) {
      report.getErrors().add("duplicate item_id: " + itemId);
    }
    seen.add(itemId);
    if (looksLikePublicSample(packDir) && PRIVATE_LICENSES.contains(asString(item.get("license")))) {
      report.getErrors().add(asString(entry.get("path")) + ": public sample item cannot use private license");
    }
  }

  private Path resolveItemPath(Path packDir, String relativePath, ContentPackValidationReport report) {
    if (relativePath == null || relativePath.isBlank()) {
      return null;
    }
    if (relativePath.contains("\\")) {
      report.getErrors().add(relativePath + ": item path must use forward slashes");
      return null;
    }
    Path candidate = Path.of(relativePath);
    if (candidate.isAbsolute()) {
      report.getErrors().add(relativePath + ": item path must be relative");
      return null;
    }
    if (!relativePath.endsWith(".json")) {
      report.getErrors().add(relativePath + ": item path must end with .json");
      return null;
    }
    for (Path part : candidate) {
      if (PRIVATE_PATH_SEGMENTS.contains(part.toString())) {
        report.getErrors().add(relativePath + ": item path contains a private content segment");
        return null;
      }
    }
    Path root = packDir.toAbsolutePath().normalize();
    Path resolved = root.resolve(candidate).normalize();
    if (!resolved.startsWith(root)) {
      report.getErrors().add(relativePath + ": item path escapes the pack directory");
      return null;
    }
    if (!Files.exists(resolved)) {
      report.getErrors().add(relativePath + ": item file does not exist");
      return null;
    }
    return resolved;
  }

  private Map<String, Object> loadJson(Path path, String label, ContentPackValidationReport report) {
    try {
      return objectMapper.readValue(path.toFile(), MAP_TYPE);
    } catch (JsonProcessingException error) {
      report.getErrors().add(label + ": invalid JSON: " + error.getOriginalMessage());
      return null;
    } catch (IOException error) {
      report.getErrors().add(label + ": cannot read JSON");
      return null;
    }
  }

  private void validateOrigin(
      String context, Map<String, Object> object, String label, ContentPackValidationReport report) {
    String origin = asString(object.get("origin_policy"));
    if (!"approved".equals(asString(object.get("review_status")))) {
      report.getErrors().add(context + ": " + label + " review_status must be approved");
    }
    if ("original_only".equals(origin) && !hasText(object.get("originality_declaration"))) {
      report.getErrors().add(context + ": original_only " + label + " needs originality_declaration");
    }
    if ("official_source_based".equals(origin) && !hasNonEmptyList(object.get("source_refs"))) {
      report.getErrors().add(context + ": official_source_based " + label + " needs source_refs");
    }
    if ("licensed_private".equals(origin) && !PRIVATE_LICENSES.contains(asString(object.get("license")))) {
      report.getErrors().add(context + ": licensed_private items must use a private LicenseRef");
    }
  }

  private void validateObjectKeys(
      String context, Map<String, Object> object, Set<String> allowed, ContentPackValidationReport report) {
    for (String key : object.keySet()) {
      if (!allowed.contains(key)) {
        report.getErrors().add(context + ": " + key + ": extra fields are not permitted");
      }
    }
  }

  private void requireText(
      Map<String, Object> object, String field, String context, ContentPackValidationReport report) {
    if (!hasText(object.get(field))) {
      report.getErrors().add(context + ": " + field + ": Field required");
    }
  }

  private void validateVocabulary(
      String context, Object value, Set<String> allowed, ContentPackValidationReport report) {
    if (hasText(value) && !allowed.contains(asString(value))) {
      report.getErrors().add(context + ": invalid value " + asString(value));
    }
  }

  private void appendTraceErrors(
      Map<String, Object> payload, String context, ContentPackValidationReport report) {
    String text;
    try {
      text = objectMapper.writeValueAsString(payload).toLowerCase();
    } catch (JsonProcessingException error) {
      text = payload.toString().toLowerCase();
    }
    for (String pattern : PRIVATE_TRACE_PATTERNS) {
      if (text.contains(pattern.toLowerCase())) {
        report.getErrors().add(context + ": contains private or legacy trace '" + pattern + "'");
      }
    }
    for (Pattern pattern : REAL_EXAM_PATTERNS) {
      if (pattern.matcher(text).find()) {
        report.getErrors().add(context + ": contains real-exam marker matching '" + pattern.pattern() + "'");
      }
    }
  }

  private ContentPackValidationReport finish(ContentPackValidationReport report) {
    report.setValid(report.getErrors().isEmpty());
    return report;
  }

  private static Set<String> licenseValues() {
    Set<String> values = new HashSet<>(PUBLIC_LICENSES);
    values.addAll(PRIVATE_LICENSES);
    return values;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Map<?, ?> map) {
    return (Map<String, Object>) map;
  }

  private static boolean looksLikePublicSample(Path packDir) {
    return "content-samples".equals(packDir.getFileName().toString());
  }

  private static boolean hasText(Object value) {
    return value instanceof String text && !text.trim().isBlank();
  }

  private static boolean hasNonEmptyList(Object value) {
    return value instanceof List<?> list && !list.isEmpty();
  }

  private static String asString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

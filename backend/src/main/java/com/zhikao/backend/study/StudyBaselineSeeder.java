package com.zhikao.backend.study;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zhikao.backend.common.Clock;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Seeds the 9 baseline sections on startup (after Flyway applies V3). For each whitelisted key: if
 * the section has no {@code published} revision, inserts one {@code published/action=seed} row with
 * {@code author_id=null} (system seed) and points the section's {@code current_revision_id} at it.
 * Idempotent — re-runs skip sections that already have a published row.
 *
 * <p>The seed JSON at {@code classpath:study/baseline/<key>.json} mirrors child-1's frontend
 * packaged constants verbatim, so the API live content and the frontend fallback render identically
 * (parent design.md §6, child-3 design.md §7).
 */
@Component
public class StudyBaselineSeeder implements ApplicationRunner {
  private static final Logger log = LoggerFactory.getLogger(StudyBaselineSeeder.class);
  private static final String BASELINE_DIR = "study/baseline/";

  private final StudySectionRepository sections;
  private final StudyRevisionRepository revisions;
  private final ObjectMapper mapper;
  private final Clock clock;

  public StudyBaselineSeeder(
      StudySectionRepository sections,
      StudyRevisionRepository revisions,
      ObjectMapper mapper,
      Clock clock) {
    this.sections = sections;
    this.revisions = revisions;
    this.mapper = mapper;
    this.clock = clock;
  }

  @Override
  public void run(ApplicationArguments args) {
    int seeded = 0;
    for (String key : StudySectionShape.KEYS) {
      if (seedKey(key)) {
        seeded++;
      }
    }
    if (seeded > 0) {
      log.info("Seeded {} baseline study sections (published/seed)", seeded);
    }
  }

  private boolean seedKey(String key) {
    if (sections.findById(key).isEmpty()) {
      sections.insert(key, clock.now());
    }
    if (revisions.hasPublished(key)) {
      return false; // already has a live baseline (or was edited) — idempotent skip
    }
    String content = readBaseline(key);
    Instant now = clock.now();
    long id =
        revisions.insert(
            new StudyRevisionRecord(
                null,
                key,
                content,
                null, // author_id null = system seed
                now,
                "初始基线内容",
                "published",
                "seed",
                null,
                null,
                null,
                null));
    sections.updateCurrent(key, id, now, null); // updated_by null = system seed
    return true;
  }

  private String readBaseline(String key) {
    try (InputStream in = new ClassPathResource(BASELINE_DIR + key + ".json").getInputStream()) {
      JsonNode node = mapper.readTree(in);
      return mapper.writeValueAsString(node);
    } catch (IOException error) {
      throw new IllegalStateException("无法读取基线内容 study/baseline/" + key + ".json", error);
    }
  }
}

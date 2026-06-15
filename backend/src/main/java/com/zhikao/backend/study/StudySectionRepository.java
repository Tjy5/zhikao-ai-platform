package com.zhikao.backend.study;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class StudySectionRepository {
  private final JdbcClient jdbc;

  public StudySectionRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<StudySectionRecord> findById(String key) {
    return jdbc.sql("select * from study_section where section_key = :key")
        .param("key", key)
        .query(StudySectionRepository::map)
        .optional();
  }

  public List<StudySectionRecord> findAll() {
    return jdbc.sql("select * from study_section order by section_key")
        .query(StudySectionRepository::map)
        .list();
  }

  /** Inserts a new section row with no current revision (system seed placeholder). */
  public void insert(String key, Instant now) {
    jdbc.sql(
            """
            insert into study_section (section_key, current_revision_id, updated_at, updated_by)
            values (:key, null, :now, null)
            """)
        .param("key", key)
        .param("now", now.toString())
        .update();
  }

  /** Points the section at its new live revision and stamps who/when. */
  public void updateCurrent(String key, Long revisionId, Instant updatedAt, Long updatedBy) {
    jdbc.sql(
            """
            update study_section
            set current_revision_id = :revisionId, updated_at = :updatedAt, updated_by = :updatedBy
            where section_key = :key
            """)
        .param("key", key)
        .param("revisionId", revisionId)
        .param("updatedAt", updatedAt.toString())
        .param("updatedBy", updatedBy)
        .update();
  }

  private static StudySectionRecord map(ResultSet rs, int rowNum) throws SQLException {
    // rs.wasNull() reflects the most recent getXxx call, so capture it immediately after each
    // nullable getLong (mirrors data.SqliteRows.nullableLong, which is package-private).
    long current = rs.getLong("current_revision_id");
    boolean currentNull = rs.wasNull();
    long updatedBy = rs.getLong("updated_by");
    boolean updatedByNull = rs.wasNull();
    return new StudySectionRecord(
        rs.getString("section_key"),
        currentNull ? null : current,
        Instant.parse(rs.getString("updated_at")),
        updatedByNull ? null : updatedBy);
  }
}

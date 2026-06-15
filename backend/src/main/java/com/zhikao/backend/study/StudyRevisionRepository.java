package com.zhikao.backend.study;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class StudyRevisionRepository {
  private final JdbcClient jdbc;

  public StudyRevisionRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /**
   * Inserts a revision and returns the generated id. Uses {@code last_insert_rowid()} which is safe
   * here: Flyway's SQLite datasource runs with a hikari pool of 1 and every writer is {@code
   * @Transactional}, so no other insert can interleave on this connection.
   */
  public long insert(StudyRevisionRecord r) {
    jdbc.sql(
            """
            insert into study_revision (
              section_key, content_json, author_id, created_at, change_summary,
              status, action, parent_revision_id, reviewer_id, reviewed_at, review_note
            ) values (
              :sectionKey, :contentJson, :authorId, :createdAt, :changeSummary,
              :status, :action, :parentRevisionId, :reviewerId, :reviewedAt, :reviewNote
            )
            """)
        .param("sectionKey", r.sectionKey())
        .param("contentJson", r.contentJson())
        .param("authorId", r.authorId())
        .param("createdAt", r.createdAt().toString())
        .param("changeSummary", r.changeSummary())
        .param("status", r.status())
        .param("action", r.action())
        .param("parentRevisionId", r.parentRevisionId())
        .param("reviewerId", r.reviewerId())
        .param("reviewedAt", r.reviewedAt() == null ? null : r.reviewedAt().toString())
        .param("reviewNote", r.reviewNote())
        .update();
    return jdbc.sql("select last_insert_rowid()").query(Long.class).single();
  }

  public Optional<StudyRevisionRecord> findById(long id) {
    return jdbc.sql("select * from study_revision where id = :id")
        .param("id", id)
        .query(StudyRevisionRepository::map)
        .optional();
  }

  /** Single-row transitions (status flow only; content_json is never mutated). */
  public int setStatus(long id, String status) {
    return jdbc.sql("update study_revision set status = :status where id = :id")
        .param("status", status)
        .param("id", id)
        .update();
  }

  /** Transitions a proposal to {@code rejected}, stamping the reviewer / note / time. */
  public int reject(long id, Long reviewerId, Instant reviewedAt, String note) {
    return jdbc.sql(
            """
            update study_revision
            set status = 'rejected', reviewer_id = :reviewerId,
                reviewed_at = :reviewedAt, review_note = :note
            where id = :id
            """)
        .param("reviewerId", reviewerId)
        .param("reviewedAt", reviewedAt.toString())
        .param("note", note)
        .param("id", id)
        .update();
  }

  /**
   * Marks the section's current {@code published} row as {@code superseded}. There is at most one
   * published row per section; returns the number of rows moved (0 or 1). Must run before a new
   * published row is inserted so it never sees the just-created row.
   */
  public int markCurrentPublishedSuperseded(String sectionKey) {
    return jdbc.sql(
            "update study_revision set status = 'superseded' "
                + "where section_key = :key and status = 'published'")
        .param("key", sectionKey)
        .update();
  }

  public boolean hasPublished(String sectionKey) {
    Integer count =
        jdbc.sql(
                "select count(*) from study_revision where section_key = :key and status = 'published'")
            .param("key", sectionKey)
            .query(Integer.class)
            .single();
    return count != null && count > 0;
  }

  public List<RevisionSummaryRow> listSummariesBySection(String key, int limit, int offset) {
    return jdbc.sql(
            """
            select r.id, r.section_key, r.action, r.status,
                   r.author_id, au.username as author_username,
                   r.created_at, r.change_summary,
                   r.reviewer_id, ru.username as reviewer_username,
                   r.reviewed_at, r.review_note,
                   r.parent_revision_id
            from study_revision r
            left join users au on r.author_id = au.id
            left join users ru on r.reviewer_id = ru.id
            where r.section_key = :key
            order by r.created_at desc, r.id desc
            limit :limit offset :offset
            """)
        .param("key", key)
        .param("limit", limit)
        .param("offset", offset)
        .query(StudyRevisionRepository::mapSummary)
        .list();
  }

  public int countBySection(String key) {
    Integer count =
        jdbc.sql("select count(*) from study_revision where section_key = :key")
            .param("key", key)
            .query(Integer.class)
            .single();
    return count == null ? 0 : count;
  }

  public List<RevisionSummaryRow> listProposedSummaries(int limit, int offset) {
    return jdbc.sql(
            """
            select r.id, r.section_key, r.action, r.status,
                   r.author_id, au.username as author_username,
                   r.created_at, r.change_summary,
                   r.reviewer_id, ru.username as reviewer_username,
                   r.reviewed_at, r.review_note,
                   r.parent_revision_id
            from study_revision r
            left join users au on r.author_id = au.id
            left join users ru on r.reviewer_id = ru.id
            where r.status = 'proposed'
            order by r.created_at desc, r.id desc
            limit :limit offset :offset
            """)
        .param("limit", limit)
        .param("offset", offset)
        .query(StudyRevisionRepository::mapSummary)
        .list();
  }

  public int countProposed() {
    Integer count =
        jdbc.sql("select count(*) from study_revision where status = 'proposed'")
            .query(Integer.class)
            .single();
    return count == null ? 0 : count;
  }

  /**
   * Summary row joined with author/reviewer usernames, used to build {@link
   * StudyDtos.RevisionSummary} without an N+1.
   */
  public record RevisionSummaryRow(
      Long id,
      String sectionKey,
      String action,
      String status,
      Long authorId,
      String authorUsername,
      Instant createdAt,
      String changeSummary,
      Long reviewerId,
      String reviewerUsername,
      Instant reviewedAt,
      String reviewNote,
      Long parentRevisionId) {}

  private static StudyRevisionRecord map(ResultSet rs, int rowNum) throws SQLException {
    long id = rs.getLong("id");
    long authorId = rs.getLong("author_id");
    boolean authorNull = rs.wasNull();
    long parent = rs.getLong("parent_revision_id");
    boolean parentNull = rs.wasNull();
    long reviewer = rs.getLong("reviewer_id");
    boolean reviewerNull = rs.wasNull();
    return new StudyRevisionRecord(
        id,
        rs.getString("section_key"),
        rs.getString("content_json"),
        authorNull ? null : authorId,
        Instant.parse(rs.getString("created_at")),
        rs.getString("change_summary"),
        rs.getString("status"),
        rs.getString("action"),
        parentNull ? null : parent,
        reviewerNull ? null : reviewer,
        nullableInstant(rs, "reviewed_at"),
        rs.getString("review_note"));
  }

  private static RevisionSummaryRow mapSummary(ResultSet rs, int rowNum) throws SQLException {
    long authorId = rs.getLong("author_id");
    boolean authorNull = rs.wasNull();
    long reviewer = rs.getLong("reviewer_id");
    boolean reviewerNull = rs.wasNull();
    long parent = rs.getLong("parent_revision_id");
    boolean parentNull = rs.wasNull();
    return new RevisionSummaryRow(
        rs.getLong("id"),
        rs.getString("section_key"),
        rs.getString("action"),
        rs.getString("status"),
        authorNull ? null : authorId,
        rs.getString("author_username"),
        Instant.parse(rs.getString("created_at")),
        rs.getString("change_summary"),
        reviewerNull ? null : reviewer,
        rs.getString("reviewer_username"),
        nullableInstant(rs, "reviewed_at"),
        rs.getString("review_note"),
        parentNull ? null : parent);
  }

  private static Instant nullableInstant(ResultSet rs, String column) throws SQLException {
    String value = rs.getString(column);
    return value == null ? null : Instant.parse(value);
  }
}

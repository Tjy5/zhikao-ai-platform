package com.zhikao.backend.data;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class HistoryRepository {
  private final JdbcClient jdbc;

  public HistoryRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public void insert(
      String id,
      long userId,
      Instant createdAt,
      String kind,
      String taskType,
      Double score,
      String requestJson,
      String responseJson,
      String extraJson) {
    jdbc.sql(
            """
            insert into history (
              id, user_id, created_at, kind, task_type, score,
              request_json, response_json, extra_json
            ) values (
              :id, :userId, :createdAt, :kind, :taskType, :score,
              :requestJson, :responseJson, :extraJson
            )
            """)
        .param("id", id)
        .param("userId", userId)
        .param("createdAt", createdAt.toString())
        .param("kind", kind)
        .param("taskType", taskType)
        .param("score", score)
        .param("requestJson", requestJson)
        .param("responseJson", responseJson)
        .param("extraJson", extraJson)
        .update();
  }

  public List<HistoryRecord> listByUserId(long userId, int limit) {
    return jdbc.sql(
            """
            select * from history
            where user_id = :userId
            order by created_at desc
            limit :limit
            """)
        .param("userId", userId)
        .param("limit", limit)
        .query(HistoryRepository::map)
        .list();
  }

  public Optional<HistoryRecord> findByUserIdAndId(long userId, String id) {
    return jdbc.sql("select * from history where user_id = :userId and id = :id")
        .param("userId", userId)
        .param("id", id)
        .query(HistoryRepository::map)
        .optional();
  }

  public int clearByUserId(long userId) {
    Integer count =
        jdbc.sql("select count(*) from history where user_id = :userId")
            .param("userId", userId)
            .query(Integer.class)
            .single();
    jdbc.sql("delete from history where user_id = :userId").param("userId", userId).update();
    return count == null ? 0 : count;
  }

  public int deleteById(long userId, String id) {
    return jdbc.sql("delete from history where user_id = :userId and id = :id")
        .param("userId", userId)
        .param("id", id)
        .update();
  }

  private static HistoryRecord map(ResultSet rs, int rowNum) throws SQLException {
    return new HistoryRecord(
        rs.getString("id"),
        SqliteRows.nullableLong(rs, "user_id"),
        SqliteRows.instant(rs, "created_at"),
        rs.getString("kind"),
        rs.getString("task_type"),
        SqliteRows.nullableDouble(rs, "score"),
        rs.getString("request_json"),
        rs.getString("response_json"),
        rs.getString("extra_json"));
  }
}

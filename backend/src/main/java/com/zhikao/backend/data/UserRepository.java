package com.zhikao.backend.data;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {
  private final JdbcClient jdbc;

  public UserRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<UserRecord> findById(long id) {
    return jdbc.sql("select * from users where id = :id")
        .param("id", id)
        .query(UserRepository::map)
        .optional();
  }

  public Optional<UserRecord> findByUsernameOrEmail(String username, String email) {
    return jdbc.sql("select * from users where username = :username or email = :email")
        .param("username", username)
        .param("email", email)
        .query(UserRepository::map)
        .optional();
  }

  public boolean existsByUsernameOrEmail(String username, String email) {
    Integer count =
        jdbc.sql("select count(*) from users where username = :username or email = :email")
            .param("username", username)
            .param("email", email)
            .query(Integer.class)
            .single();
    return count != null && count > 0;
  }

  public UserRecord insert(String username, String email, String hashedPassword, Instant now) {
    jdbc.sql(
            """
            insert into users (username, email, hashed_password, is_active, created_at, updated_at)
            values (:username, :email, :hashedPassword, 1, :createdAt, :updatedAt)
            """)
        .param("username", username)
        .param("email", email)
        .param("hashedPassword", hashedPassword)
        .param("createdAt", now.toString())
        .param("updatedAt", now.toString())
        .update();
    return findByUsernameOrEmail(username, email).orElseThrow();
  }

  private static UserRecord map(ResultSet rs, int rowNum) throws SQLException {
    return new UserRecord(
        rs.getLong("id"),
        rs.getString("username"),
        rs.getString("email"),
        rs.getString("hashed_password"),
        rs.getInt("is_active") != 0,
        SqliteRows.instant(rs, "created_at"),
        SqliteRows.instant(rs, "updated_at"));
  }
}

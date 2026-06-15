package com.zhikao.backend.data;

import com.zhikao.backend.common.Clock;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class UserRepository {
  private static final Set<String> ALLOWED_ROLES = Set.of("user", "admin");

  private final JdbcClient jdbc;
  private final Clock clock;

  public UserRepository(JdbcClient jdbc, Clock clock) {
    this.jdbc = jdbc;
    this.clock = clock;
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

  public int promoteAdmins(List<String> usernames) {
    if (usernames == null || usernames.isEmpty()) {
      return 0;
    }
    return jdbc.sql("update users set role = 'admin', updated_at = :now where username in (:names)")
        .param("now", clock.now().toString())
        .param("names", usernames)
        .update();
  }

  public int updateRole(long userId, String role) {
    if (!ALLOWED_ROLES.contains(role)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的角色");
    }
    return jdbc.sql("update users set role = :role, updated_at = :now where id = :id")
        .param("role", role)
        .param("now", clock.now().toString())
        .param("id", userId)
        .update();
  }

  private static UserRecord map(ResultSet rs, int rowNum) throws SQLException {
    return new UserRecord(
        rs.getLong("id"),
        rs.getString("username"),
        rs.getString("email"),
        rs.getString("hashed_password"),
        rs.getInt("is_active") != 0,
        SqliteRows.instant(rs, "created_at"),
        SqliteRows.instant(rs, "updated_at"),
        rs.getString("role"));
  }
}

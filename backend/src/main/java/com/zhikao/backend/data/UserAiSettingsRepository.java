package com.zhikao.backend.data;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UserAiSettingsRepository {
  private final JdbcClient jdbc;

  public UserAiSettingsRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<UserAiSettingsRecord> findByUserId(long userId) {
    return jdbc.sql("select * from user_ai_model_settings where user_id = :userId")
        .param("userId", userId)
        .query(UserAiSettingsRepository::map)
        .optional();
  }

  public UserAiSettingsRecord upsert(
      long userId,
      String providerName,
      String baseUrl,
      String modelName,
      String apiKeyEncrypted,
      String apiKeyHint,
      boolean jsonFallbackEnabled,
      boolean updateSecret,
      Instant now) {
    Optional<UserAiSettingsRecord> existing = findByUserId(userId);
    if (existing.isEmpty()) {
      jdbc.sql(
              """
              insert into user_ai_model_settings (
                user_id, provider_name, base_url, model_name, api_key_encrypted,
                api_key_hint, json_fallback_enabled, created_at, updated_at
              ) values (
                :userId, :providerName, :baseUrl, :modelName, :apiKeyEncrypted,
                :apiKeyHint, :jsonFallbackEnabled, :createdAt, :updatedAt
              )
              """)
          .param("userId", userId)
          .param("providerName", providerName)
          .param("baseUrl", baseUrl)
          .param("modelName", modelName)
          .param("apiKeyEncrypted", updateSecret ? apiKeyEncrypted : null)
          .param("apiKeyHint", updateSecret ? apiKeyHint : null)
          .param("jsonFallbackEnabled", jsonFallbackEnabled ? 1 : 0)
          .param("createdAt", now.toString())
          .param("updatedAt", now.toString())
          .update();
    } else {
      String secretSql =
          updateSecret
              ? ", api_key_encrypted = :apiKeyEncrypted, api_key_hint = :apiKeyHint, "
                  + "last_test_status = null, last_tested_at = null, "
                  + "last_failure_classification = null, last_successful_mode = null "
              : "";
      jdbc.sql(
              """
              update user_ai_model_settings
              set provider_name = :providerName,
                  base_url = :baseUrl,
                  model_name = :modelName,
                  json_fallback_enabled = :jsonFallbackEnabled,
                  updated_at = :updatedAt
              """
                  + secretSql
                  + " where user_id = :userId")
          .param("userId", userId)
          .param("providerName", providerName)
          .param("baseUrl", baseUrl)
          .param("modelName", modelName)
          .param("jsonFallbackEnabled", jsonFallbackEnabled ? 1 : 0)
          .param("updatedAt", now.toString())
          .param("apiKeyEncrypted", apiKeyEncrypted)
          .param("apiKeyHint", apiKeyHint)
          .update();
    }
    return findByUserId(userId).orElseThrow();
  }

  public void updateProviderStatus(
      long id,
      String lastTestStatus,
      Instant lastTestedAt,
      String lastFailureClassification,
      String lastSuccessfulMode) {
    jdbc.sql(
            """
            update user_ai_model_settings
            set last_test_status = :lastTestStatus,
                last_tested_at = :lastTestedAt,
                last_failure_classification = :lastFailureClassification,
                last_successful_mode = :lastSuccessfulMode
            where id = :id
            """)
        .param("id", id)
        .param("lastTestStatus", lastTestStatus)
        .param("lastTestedAt", lastTestedAt == null ? null : lastTestedAt.toString())
        .param("lastFailureClassification", lastFailureClassification)
        .param("lastSuccessfulMode", lastSuccessfulMode)
        .update();
  }

  private static UserAiSettingsRecord map(ResultSet rs, int rowNum) throws SQLException {
    return new UserAiSettingsRecord(
        rs.getLong("id"),
        rs.getLong("user_id"),
        rs.getString("provider_name"),
        rs.getString("base_url"),
        rs.getString("model_name"),
        rs.getString("api_key_encrypted"),
        rs.getString("api_key_hint"),
        rs.getInt("json_fallback_enabled") != 0,
        SqliteRows.instant(rs, "created_at"),
        SqliteRows.instant(rs, "updated_at"),
        rs.getString("last_test_status"),
        SqliteRows.instant(rs, "last_tested_at"),
        rs.getString("last_failure_classification"),
        rs.getString("last_successful_mode"));
  }
}

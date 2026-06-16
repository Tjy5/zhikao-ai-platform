package com.zhikao.backend.data;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class PlatformSettingsRepository {
  private static final long SINGLETON_ID = 1L;

  private final JdbcClient jdbc;

  public PlatformSettingsRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<PlatformSettingsRecord> find() {
    return jdbc.sql("select * from platform_settings where id = :id")
        .param("id", SINGLETON_ID)
        .query(PlatformSettingsRepository::map)
        .optional();
  }

  public PlatformSettingsRecord insertDefaults(
      String providerName,
      String baseUrl,
      String modelName,
      String apiKeyEncrypted,
      String apiKeyHint,
      boolean jsonFallbackEnabled,
      Instant now) {
    jdbc.sql(
            """
            insert or ignore into platform_settings (
              id, writing_provider_name, writing_base_url, writing_model_name,
              writing_api_key_encrypted, writing_api_key_hint,
              writing_json_fallback_enabled, public_registration_enabled,
              content_proposals_enabled, reject_note_required,
              admin_direct_publish_enabled, content_revert_enabled,
              created_at, updated_at
            ) values (
              :id, :providerName, :baseUrl, :modelName,
              :apiKeyEncrypted, :apiKeyHint,
              :jsonFallbackEnabled, 1,
              1, 0,
              1, 1,
              :createdAt, :updatedAt
            )
            """)
        .param("id", SINGLETON_ID)
        .param("providerName", providerName)
        .param("baseUrl", baseUrl)
        .param("modelName", modelName)
        .param("apiKeyEncrypted", apiKeyEncrypted)
        .param("apiKeyHint", apiKeyHint)
        .param("jsonFallbackEnabled", jsonFallbackEnabled ? 1 : 0)
        .param("createdAt", now.toString())
        .param("updatedAt", now.toString())
        .update();
    return find().orElseThrow();
  }

  public PlatformSettingsRecord update(
      String providerName,
      String baseUrl,
      String modelName,
      String apiKeyEncrypted,
      String apiKeyHint,
      boolean updateSecret,
      boolean jsonFallbackEnabled,
      boolean publicRegistrationEnabled,
      boolean contentProposalsEnabled,
      boolean rejectNoteRequired,
      boolean adminDirectPublishEnabled,
      boolean contentRevertEnabled,
      Instant now) {
    String secretSql =
        updateSecret
            ? ", writing_api_key_encrypted = :apiKeyEncrypted, writing_api_key_hint = :apiKeyHint, "
                + "last_test_status = null, last_tested_at = null, "
                + "last_failure_classification = null, last_successful_mode = null "
            : "";
    jdbc.sql(
            """
            update platform_settings
            set writing_provider_name = :providerName,
                writing_base_url = :baseUrl,
                writing_model_name = :modelName,
                writing_json_fallback_enabled = :jsonFallbackEnabled,
                public_registration_enabled = :publicRegistrationEnabled,
                content_proposals_enabled = :contentProposalsEnabled,
                reject_note_required = :rejectNoteRequired,
                admin_direct_publish_enabled = :adminDirectPublishEnabled,
                content_revert_enabled = :contentRevertEnabled,
                updated_at = :updatedAt
            """
                + secretSql
                + " where id = :id")
        .param("id", SINGLETON_ID)
        .param("providerName", providerName)
        .param("baseUrl", baseUrl)
        .param("modelName", modelName)
        .param("apiKeyEncrypted", apiKeyEncrypted)
        .param("apiKeyHint", apiKeyHint)
        .param("jsonFallbackEnabled", jsonFallbackEnabled ? 1 : 0)
        .param("publicRegistrationEnabled", publicRegistrationEnabled ? 1 : 0)
        .param("contentProposalsEnabled", contentProposalsEnabled ? 1 : 0)
        .param("rejectNoteRequired", rejectNoteRequired ? 1 : 0)
        .param("adminDirectPublishEnabled", adminDirectPublishEnabled ? 1 : 0)
        .param("contentRevertEnabled", contentRevertEnabled ? 1 : 0)
        .param("updatedAt", now.toString())
        .update();
    return find().orElseThrow();
  }

  public void updateProviderStatus(
      String lastTestStatus,
      Instant lastTestedAt,
      String lastFailureClassification,
      String lastSuccessfulMode) {
    jdbc.sql(
            """
            update platform_settings
            set last_test_status = :lastTestStatus,
                last_tested_at = :lastTestedAt,
                last_failure_classification = :lastFailureClassification,
                last_successful_mode = :lastSuccessfulMode
            where id = :id
            """)
        .param("id", SINGLETON_ID)
        .param("lastTestStatus", lastTestStatus)
        .param("lastTestedAt", lastTestedAt == null ? null : lastTestedAt.toString())
        .param("lastFailureClassification", lastFailureClassification)
        .param("lastSuccessfulMode", lastSuccessfulMode)
        .update();
  }

  private static PlatformSettingsRecord map(ResultSet rs, int rowNum) throws SQLException {
    return new PlatformSettingsRecord(
        rs.getLong("id"),
        rs.getString("writing_provider_name"),
        rs.getString("writing_base_url"),
        rs.getString("writing_model_name"),
        rs.getString("writing_api_key_encrypted"),
        rs.getString("writing_api_key_hint"),
        rs.getInt("writing_json_fallback_enabled") != 0,
        rs.getInt("public_registration_enabled") != 0,
        rs.getInt("content_proposals_enabled") != 0,
        rs.getInt("reject_note_required") != 0,
        rs.getInt("admin_direct_publish_enabled") != 0,
        rs.getInt("content_revert_enabled") != 0,
        SqliteRows.instant(rs, "created_at"),
        SqliteRows.instant(rs, "updated_at"),
        rs.getString("last_test_status"),
        SqliteRows.instant(rs, "last_tested_at"),
        rs.getString("last_failure_classification"),
        rs.getString("last_successful_mode"));
  }
}

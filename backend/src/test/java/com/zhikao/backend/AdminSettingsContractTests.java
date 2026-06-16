package com.zhikao.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zhikao.backend.data.UserRepository;
import com.zhikao.backend.settings.ApiKeyEncryptionService;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MvcResult;

class AdminSettingsContractTests extends IntegrationTestSupport {
  @Autowired private JdbcClient jdbc;
  @Autowired private UserRepository userRepository;
  @Autowired private ApiKeyEncryptionService encryption;

  @BeforeEach
  @AfterEach
  void resetPlatformSettings() {
    String now = Instant.now().toString();
    jdbc.sql(
            """
            insert or ignore into platform_settings (
              id, writing_provider_name, writing_base_url, writing_model_name,
              writing_json_fallback_enabled, public_registration_enabled,
              content_proposals_enabled, reject_note_required,
              admin_direct_publish_enabled, content_revert_enabled,
              created_at, updated_at
            ) values (
              1, 'openai-compatible', 'https://api.openai.com/v1', 'gpt-4o-mini',
              1, 1, 1, 0, 1, 1, :now, :now
            )
            """)
        .param("now", now)
        .update();
    jdbc.sql(
            """
            update platform_settings
            set writing_provider_name = 'openai-compatible',
                writing_base_url = 'https://api.openai.com/v1',
                writing_model_name = 'gpt-4o-mini',
                writing_api_key_encrypted = null,
                writing_api_key_hint = null,
                writing_json_fallback_enabled = 1,
                public_registration_enabled = 1,
                content_proposals_enabled = 1,
                reject_note_required = 0,
                admin_direct_publish_enabled = 1,
                content_revert_enabled = 1,
                last_test_status = null,
                last_tested_at = null,
                last_failure_classification = null,
                last_successful_mode = null,
                updated_at = :now
            where id = 1
            """)
        .param("now", now)
        .update();
  }

  @Test
  void adminSettingsEndpointsAreAdminOnly() throws Exception {
    Session user = registerAndLogin("admin_settings_user");
    Session admin = registerAndLoginAdmin("admin_settings_admin");

    mockMvc.perform(get("/api/v1/admin/settings")).andExpect(status().isUnauthorized());
    mockMvc
        .perform(get("/api/v1/admin/settings").header("Authorization", user.authHeader()))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            put("/api/v1/admin/settings")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            post("/api/v1/admin/settings/writing-ai/test")
                .header("Authorization", user.authHeader()))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            post("/api/v1/admin/settings/writing-ai/models")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isForbidden());

    mockMvc
        .perform(get("/api/v1/admin/settings").header("Authorization", admin.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.writing_ai.provider_name").value("openai-compatible"))
        .andExpect(jsonPath("$.operation_policy.public_registration_enabled").value(true));
  }

  @Test
  void globalSettingsEncryptRedactPreserveAndDriveModelTools() throws Exception {
    Session admin = registerAndLoginAdmin("admin_settings_global");
    String secret = "sk-global-secret-4444";

    saveAdminSettings(admin, "https://global.example.com/v1", "global-model", secret, defaultPolicy())
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.writing_ai.has_api_key").value(true))
        .andExpect(jsonPath("$.writing_ai.api_key_hint").value("****4444"))
        .andExpect(jsonPath("$.writing_ai.api_key").doesNotExist())
        .andExpect(jsonPath("$.writing_ai.api_key_encrypted").doesNotExist())
        .andExpect(jsonPath("$", not(containsString(secret))));

    String encrypted =
        jdbc.sql("select writing_api_key_encrypted from platform_settings where id = 1")
            .query(String.class)
            .single();
    assertThat(encrypted).doesNotContain(secret);
    assertThat(encryption.decrypt(encrypted)).isEqualTo(secret);

    saveAdminSettings(admin, "https://global.example.com/v2", "global-model-2", "", defaultPolicy())
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.writing_ai.base_url").value("https://global.example.com/v2"))
        .andExpect(jsonPath("$.writing_ai.api_key_hint").value("****4444"));
    String preserved =
        jdbc.sql("select writing_api_key_encrypted from platform_settings where id = 1")
            .query(String.class)
            .single();
    assertThat(encryption.decrypt(preserved)).isEqualTo(secret);

    mockMvc
        .perform(
            post("/api/v1/admin/settings/writing-ai/models")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("succeeded"))
        .andExpect(jsonPath("$.models[0].id").value("writing-model-a"));
    assertThat(fakeAiProvider.lastConfig().apiKey()).isEqualTo(secret);

    mockMvc
        .perform(
            post("/api/v1/admin/settings/writing-ai/test")
                .header("Authorization", admin.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("succeeded"));
  }

  @Test
  void personalSettingsOverrideGlobalDefaultsWhileUnconfiguredUsersInheritGlobal() throws Exception {
    Session admin = registerAndLoginAdmin("admin_settings_inherit_admin");
    Session inherited = registerAndLogin("admin_settings_inherit_user");
    Session personal = registerAndLogin("admin_settings_personal_user");

    saveAdminSettings(
            admin, "https://global.example.com/v1", "global-model", "sk-global-secret", defaultPolicy())
        .andExpect(status().isOk());
    savePersonalSettings(personal, "https://personal.example.com/v1", "personal-model", "sk-personal-secret")
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/api/v1/settings/writing-ai").header("Authorization", inherited.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.base_url").value("https://global.example.com/v1"))
        .andExpect(jsonPath("$.model_name").value("global-model"))
        .andExpect(jsonPath("$.has_api_key").value(true))
        .andExpect(jsonPath("$", not(containsString("sk-global-secret"))));
    mockMvc
        .perform(
            post("/api/v1/settings/writing-ai/test")
                .header("Authorization", inherited.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("succeeded"));
    assertThat(fakeAiProvider.lastConfig().apiKey()).isEqualTo("sk-global-secret");

    postGrade(inherited).andExpect(status().isOk());
    assertThat(fakeAiProvider.lastConfig().apiKey()).isEqualTo("sk-global-secret");
    assertThat(fakeAiProvider.lastConfig().modelName()).isEqualTo("global-model");

    postGrade(personal).andExpect(status().isOk());
    assertThat(fakeAiProvider.lastConfig().apiKey()).isEqualTo("sk-personal-secret");
    assertThat(fakeAiProvider.lastConfig().modelName()).isEqualTo("personal-model");
  }

  @Test
  void operationPolicyEndpointIsReadableByAuthenticatedUsers() throws Exception {
    Session admin = registerAndLoginAdmin("admin_settings_policy_read_admin");
    Session user = registerAndLogin("admin_settings_policy_read_user");

    saveAdminSettings(admin, null, null, null, policy(true, false, true, false, false))
        .andExpect(status().isOk());

    mockMvc.perform(get("/api/v1/settings/operation-policy")).andExpect(status().isUnauthorized());
    mockMvc
        .perform(get("/api/v1/settings/operation-policy").header("Authorization", user.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.public_registration_enabled").value(true))
        .andExpect(jsonPath("$.content_proposals_enabled").value(false))
        .andExpect(jsonPath("$.reject_note_required").value(true))
        .andExpect(jsonPath("$.admin_direct_publish_enabled").value(false))
        .andExpect(jsonPath("$.content_revert_enabled").value(false))
        .andExpect(jsonPath("$.writing_ai").doesNotExist())
        .andExpect(jsonPath("$.api_key").doesNotExist());
  }

  @Test
  void operationPolicyBlocksRegistrationProposalsRejectWithoutNoteDirectEditAndRevert() throws Exception {
    Session admin = registerAndLoginAdmin("admin_settings_policy_admin");
    Session user = registerAndLogin("admin_settings_policy_user");

    saveAdminSettings(admin, null, null, null, policy(false, true, false, true, true))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        Map.of(
                            "username",
                            unique("blocked_registration"),
                            "email",
                            unique("blocked_registration") + "@example.com",
                            "password",
                            "StrongPass123!"))))
        .andExpect(status().isForbidden());
    login(userUsername(user), "StrongPass123!");

    saveAdminSettings(admin, null, null, null, policy(true, false, false, true, true))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/v1/study/sections/pitfalls/propose")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(studyBody("[{\"issue\":\"blocked-proposal\"}]", "policy")))
        .andExpect(status().isForbidden());

    saveAdminSettings(admin, null, null, null, policy(true, true, true, true, true))
        .andExpect(status().isOk());
    long proposalId =
        json(
                mockMvc
                    .perform(
                        post("/api/v1/study/sections/pitfalls/propose")
                            .header("Authorization", user.authHeader())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(studyBody("[{\"issue\":\"needs-note\"}]", "policy")))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("id")
            .asLong();
    mockMvc
        .perform(
            post("/api/v1/study/revisions/" + proposalId + "/reject")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"review_note\":\"   \"}"))
        .andExpect(status().isUnprocessableEntity());
    mockMvc
        .perform(
            post("/api/v1/study/revisions/" + proposalId + "/reject")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"review_note\":\"说明明确\"}"))
        .andExpect(status().isOk());

    saveAdminSettings(admin, null, null, null, policy(true, true, false, false, true))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/v1/study/sections/pitfalls/edit")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(studyBody("[{\"issue\":\"blocked-edit\"}]", "policy")))
        .andExpect(status().isForbidden());

    long targetId =
        json(
                mockMvc
                    .perform(
                        get("/api/v1/study/sections/pitfalls/revisions")
                            .header("Authorization", admin.authHeader()))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("revisions")
            .get(0)
            .path("id")
            .asLong();
    saveAdminSettings(admin, null, null, null, policy(true, true, false, true, false))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/v1/study/sections/pitfalls/revert")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"target_revision_id\":" + targetId + "}"))
        .andExpect(status().isForbidden());
  }

  private org.springframework.test.web.servlet.ResultActions saveAdminSettings(
      Session admin, String baseUrl, String modelName, String apiKey, ObjectNode policy) throws Exception {
    MvcResult current =
        mockMvc
            .perform(get("/api/v1/admin/settings").header("Authorization", admin.authHeader()))
            .andExpect(status().isOk())
            .andReturn();
    ObjectNode body = objectMapper.createObjectNode();
    ObjectNode writing = objectMapper.createObjectNode();
    JsonNode currentWriting = json(current).path("writing_ai");
    writing.put("provider_name", currentWriting.path("provider_name").asText("openai-compatible"));
    writing.put("base_url", baseUrl == null ? currentWriting.path("base_url").asText() : baseUrl);
    writing.put("model_name", modelName == null ? currentWriting.path("model_name").asText() : modelName);
    if (apiKey != null) {
      writing.put("api_key", apiKey);
    }
    writing.put(
        "json_fallback_enabled",
        currentWriting.path("json_fallback_enabled").asBoolean(true));
    body.set("writing_ai", writing);
    body.set("operation_policy", policy);
    return mockMvc.perform(
        put("/api/v1/admin/settings")
            .header("Authorization", admin.authHeader())
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(body)));
  }

  private org.springframework.test.web.servlet.ResultActions savePersonalSettings(
      Session user, String baseUrl, String modelName, String apiKey) throws Exception {
    return mockMvc.perform(
        put("/api/v1/settings/writing-ai")
            .header("Authorization", user.authHeader())
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                objectMapper.writeValueAsString(
                    Map.of(
                        "provider_name",
                        "openai-compatible",
                        "base_url",
                        baseUrl,
                        "model_name",
                        modelName,
                        "api_key",
                        apiKey,
                        "json_fallback_enabled",
                        true))));
  }

  private org.springframework.test.web.servlet.ResultActions postGrade(Session user) throws Exception {
    return mockMvc.perform(
        post("/api/v1/writings/grade")
            .header("Authorization", user.authHeader())
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                objectMapper.writeValueAsString(
                    Map.of("content", "申论材料分析文本。", "task_type", "analysis"))));
  }

  private String studyBody(String contentJson, String summary) throws Exception {
    ObjectNode root = objectMapper.createObjectNode();
    root.set("content_json", objectMapper.readTree(contentJson));
    root.put("change_summary", summary);
    return objectMapper.writeValueAsString(root);
  }

  private ObjectNode defaultPolicy() {
    return policy(true, true, false, true, true);
  }

  private ObjectNode policy(
      boolean registration,
      boolean proposals,
      boolean rejectNote,
      boolean directPublish,
      boolean revert) {
    ObjectNode policy = objectMapper.createObjectNode();
    policy.put("public_registration_enabled", registration);
    policy.put("content_proposals_enabled", proposals);
    policy.put("reject_note_required", rejectNote);
    policy.put("admin_direct_publish_enabled", directPublish);
    policy.put("content_revert_enabled", revert);
    return policy;
  }

  private String userUsername(Session session) {
    return userRepository.findById(session.userId()).orElseThrow().username();
  }

  private Session registerAndLoginAdmin(String prefix) throws Exception {
    Session session = registerAndLogin(prefix);
    userRepository.updateRole(session.userId(), "admin");
    return session;
  }
}

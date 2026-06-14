package com.zhikao.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.zhikao.backend.ai.AiClassification;
import com.zhikao.backend.settings.ApiKeyEncryptionService;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MvcResult;

class BackendContractTests extends IntegrationTestSupport {
  private static final String SAMPLE_WRITING =
      "随着时代的发展，创新成为推动社会进步的重要力量。我们要坚持以人民为中心的发展思想。";

  @Autowired private JdbcClient jdbc;
  @Autowired private ApiKeyEncryptionService encryption;

  @Test
  void authRegisterLoginAndMePreserveBearerContract() throws Exception {
    String username = unique("auth");
    String password = "StrongPass123!";

    MvcResult register =
        mockMvc
            .perform(
                post("/api/v1/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            Map.of(
                                "username",
                                username,
                                "email",
                                username + "@example.com",
                                "password",
                                password))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.username").value(username))
            .andExpect(jsonPath("$.email").value(username + "@example.com"))
            .andExpect(jsonPath("$.is_active").value(true))
            .andExpect(jsonPath("$.password").doesNotExist())
            .andExpect(jsonPath("$.hashed_password").doesNotExist())
            .andReturn();

    long userId = json(register).path("id").asLong();
    String storedHash =
        jdbc.sql("select hashed_password from users where id = :id")
            .param("id", userId)
            .query(String.class)
            .single();
    assertThat(storedHash).isNotEqualTo(password);

    mockMvc
        .perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        Map.of(
                            "username",
                            username,
                            "email",
                            username + "@example.com",
                            "password",
                            password))))
        .andExpect(status().isConflict());

    MvcResult login = login(username, password);
    JsonNode token = json(login);
    assertThat(token.path("token_type").asText()).isEqualTo("bearer");
    assertThat(token.path("access_token").asText()).isNotBlank();
    assertThat(token.path("expires_in").asInt()).isGreaterThan(0);

    mockMvc
        .perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token.path("access_token").asText()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(userId))
        .andExpect(jsonPath("$.is_active").value(true));
  }

  @Test
  void protectedRoutesRejectMissingAndInvalidTokens() throws Exception {
    mockMvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
    mockMvc
        .perform(get("/api/v1/auth/me").header("Authorization", "Bearer not-a-real-token"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.detail").value("无法验证当前用户"));
    mockMvc
        .perform(post("/api/v1/writings/grade").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void settingsEncryptRedactPreserveAndIsolateApiKeys() throws Exception {
    Session userA = registerAndLogin("settingsA");
    Session userB = registerAndLogin("settingsB");
    String secretA = "sk-user-a-secret-1111";
    String secretB = "sk-user-b-secret-2222";

    mockMvc
        .perform(get("/api/v1/settings/writing-ai").header("Authorization", userA.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.has_api_key").value(false))
        .andExpect(jsonPath("$.api_key").doesNotExist())
        .andExpect(jsonPath("$.api_key_encrypted").doesNotExist());

    saveSettings(userA, "https://provider.example.com/v1", "writing-model", secretA)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.has_api_key").value(true))
        .andExpect(jsonPath("$.api_key_hint").value("****1111"))
        .andExpect(jsonPath("$.api_key").doesNotExist())
        .andExpect(jsonPath("$.api_key_encrypted").doesNotExist())
        .andExpect(jsonPath("$", not(containsString(secretA))));
    saveSettings(userB, "https://other.example.com/v1", "other-model", secretB)
        .andExpect(status().isOk());

    String encrypted =
        jdbc.sql("select api_key_encrypted from user_ai_model_settings where user_id = :userId")
            .param("userId", userA.userId())
            .query(String.class)
            .single();
    assertThat(encrypted).doesNotContain(secretA);
    assertThat(encryption.decrypt(encrypted)).isEqualTo(secretA);

    mockMvc
        .perform(
            put("/api/v1/settings/writing-ai")
                .header("Authorization", userA.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        Map.of(
                            "provider_name",
                            "openai-compatible",
                            "base_url",
                            "https://provider.example.com/v2",
                            "model_name",
                            "updated-model",
                            "json_fallback_enabled",
                            false))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.base_url").value("https://provider.example.com/v2"))
        .andExpect(jsonPath("$.api_key_hint").value("****1111"));
    String preserved =
        jdbc.sql("select api_key_encrypted from user_ai_model_settings where user_id = :userId")
            .param("userId", userA.userId())
            .query(String.class)
            .single();
    assertThat(encryption.decrypt(preserved)).isEqualTo(secretA);

    mockMvc
        .perform(get("/api/v1/settings/writing-ai").header("Authorization", userB.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.base_url").value("https://other.example.com/v1"))
        .andExpect(jsonPath("$.api_key_hint").value("****2222"));
  }

  @Test
  void modelDiscoveryUsesSavedCredentialsAndSafeFailurePayloads() throws Exception {
    Session user = registerAndLogin("models");
    saveSettings(user, "https://provider.example.com/v1", "writing-model", "sk-model-secret-7777")
        .andExpect(status().isOk());

    mockMvc
        .perform(
            post("/api/v1/settings/writing-ai/models")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("succeeded"))
        .andExpect(jsonPath("$.configured").value(true))
        .andExpect(jsonPath("$.model_count").value(2))
        .andExpect(jsonPath("$.models[0].id").value("writing-model-a"))
        .andExpect(jsonPath("$", not(containsString("sk-model-secret-7777"))));
    assertThat(fakeAiProvider.lastConfig().apiKey()).isEqualTo("sk-model-secret-7777");

    fakeAiProvider.failWith(AiClassification.AUTHENTICATION);
    mockMvc
        .perform(
            post("/api/v1/settings/writing-ai/models")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("failed"))
        .andExpect(jsonPath("$.last_failure_classification").value("authentication"));

    mockMvc
        .perform(
            post("/api/v1/settings/writing-ai/models")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"base_url\":\"ftp://provider.example.com/v1\",\"api_key\":\"sk-test\"}"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  void writingGradeSseAiStatusAndHistoryPreserveFrontendContract() throws Exception {
    Session user = registerAndLogin("writing");
    saveSettings(user, "https://provider.example.com/v1", "writing-model", "sk-writing-secret")
        .andExpect(status().isOk());

    MvcResult grade =
        mockMvc
            .perform(
                post("/api/v1/writings/grade")
                    .header("Authorization", user.authHeader())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            Map.of("content", SAMPLE_WRITING, "task_type", "analysis"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contentFormat").value("markdown"))
            .andExpect(jsonPath("$.content").value(containsString("综合评价")))
            .andExpect(jsonPath("$.score").doesNotExist())
            .andExpect(jsonPath("$.feedback").doesNotExist())
            .andReturn();
    assertThat(json(grade).path("content").asText()).contains("综合评价");

    MvcResult progressive =
        mockMvc
            .perform(
                post("/api/v1/writings/grade-progressive")
                    .header("Authorization", user.authHeader())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.TEXT_EVENT_STREAM)
                    .content(objectMapper.writeValueAsString(Map.of("content", SAMPLE_WRITING))))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Accel-Buffering", "no"))
            .andReturn();
    JsonNode event = parseSse(progressive);
    assertThat(event.path("stage").asInt()).isEqualTo(2);
    assertThat(event.path("progress").asInt()).isEqualTo(100);
    assertThat(event.path("contentFormat").asText()).isEqualTo("markdown");

    mockMvc
        .perform(get("/api/v1/writings/ai-status").header("Authorization", user.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("active"))
        .andExpect(jsonPath("$.capability.configured").value(true));

    MvcResult history =
        mockMvc
            .perform(get("/api/v1/writings/history").param("limit", "20").header("Authorization", user.authHeader()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].contentFormat").value("markdown"))
            .andReturn();
    String itemId = json(history).path("items").get(0).path("id").asText();
    mockMvc
        .perform(get("/api/v1/writings/history/" + itemId).header("Authorization", user.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.response.contentFormat").value("markdown"))
        .andExpect(jsonPath("$.response.content").value(containsString("综合评价")));
  }

  @Test
  void writingProviderErrorsMapToHttpAndSseErrorEvents() throws Exception {
    Session user = registerAndLogin("writingError");

    mockMvc
        .perform(
            post("/api/v1/writings/grade")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("content", SAMPLE_WRITING))))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.detail.classification").value("unavailable"));

    saveSettings(user, "https://provider.example.com/v1", "writing-model", "sk-timeout-secret")
        .andExpect(status().isOk());
    fakeAiProvider.failWith(AiClassification.TIMEOUT);

    mockMvc
        .perform(
            post("/api/v1/writings/grade")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("content", SAMPLE_WRITING))))
        .andExpect(status().isGatewayTimeout())
        .andExpect(jsonPath("$.detail.classification").value("timeout"))
        .andExpect(jsonPath("$.detail.retryable").value(true));

    MvcResult sse =
        mockMvc
            .perform(
                post("/api/v1/writings/grade-progressive")
                    .header("Authorization", user.authHeader())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.TEXT_EVENT_STREAM)
                    .content(objectMapper.writeValueAsString(Map.of("content", SAMPLE_WRITING))))
            .andExpect(status().isOk())
            .andReturn();
    JsonNode event = parseSse(sse);
    assertThat(event.path("stage").asText()).isEqualTo("error");
    assertThat(event.path("classification").asText()).isEqualTo("timeout");
    assertThat(event.path("partial").asBoolean()).isFalse();
  }

  @Test
  void historyIsCurrentUserScoped() throws Exception {
    Session userA = registerAndLogin("historyA");
    Session userB = registerAndLogin("historyB");
    saveSettings(userA, "https://provider.example.com/v1", "writing-model", "sk-a").andExpect(status().isOk());
    saveSettings(userB, "https://provider.example.com/v1", "writing-model", "sk-b").andExpect(status().isOk());

    postGrade(userA).andExpect(status().isOk());
    postGrade(userB).andExpect(status().isOk());

    String itemA =
        json(
                mockMvc
                    .perform(get("/api/v1/writings/history").header("Authorization", userA.authHeader()))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("items")
            .get(0)
            .path("id")
            .asText();
    String itemB =
        json(
                mockMvc
                    .perform(get("/api/v1/writings/history").header("Authorization", userB.authHeader()))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("items")
            .get(0)
            .path("id")
            .asText();
    assertThat(itemA).isNotEqualTo(itemB);

    mockMvc
        .perform(get("/api/v1/writings/history/" + itemB).header("Authorization", userA.authHeader()))
        .andExpect(status().isNotFound());

    mockMvc
        .perform(delete("/api/v1/writings/history").header("Authorization", userA.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.deleted").value(1));
    mockMvc
        .perform(get("/api/v1/writings/history").header("Authorization", userB.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value(itemB));
  }

  @Test
  void historySingleDeleteIsUserScopedAndIdempotent() throws Exception {
    Session userA = registerAndLogin("delA");
    Session userB = registerAndLogin("delB");
    saveSettings(userA, "https://provider.example.com/v1", "writing-model", "sk-a").andExpect(status().isOk());
    saveSettings(userB, "https://provider.example.com/v1", "writing-model", "sk-b").andExpect(status().isOk());

    postGrade(userA).andExpect(status().isOk());
    postGrade(userB).andExpect(status().isOk());

    String itemA =
        json(
                mockMvc
                    .perform(get("/api/v1/writings/history").header("Authorization", userA.authHeader()))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("items")
            .get(0)
            .path("id")
            .asText();
    String itemB =
        json(
                mockMvc
                    .perform(get("/api/v1/writings/history").header("Authorization", userB.authHeader()))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("items")
            .get(0)
            .path("id")
            .asText();
    assertThat(itemA).isNotEqualTo(itemB);

    mockMvc
        .perform(delete("/api/v1/writings/history/" + itemB).header("Authorization", userA.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.deleted").value(0));
    mockMvc
        .perform(get("/api/v1/writings/history").header("Authorization", userB.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value(itemB));

    mockMvc
        .perform(delete("/api/v1/writings/history/" + itemA).header("Authorization", userA.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.deleted").value(1));
    mockMvc
        .perform(get("/api/v1/writings/history").header("Authorization", userA.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty());

    mockMvc
        .perform(delete("/api/v1/writings/history/" + itemA).header("Authorization", userA.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.deleted").value(0));
  }

  @Test
  void configuredCorsOriginIsAllowed() throws Exception {
    mockMvc
        .perform(
            options("/api/v1/auth/login")
                .header("Origin", "http://localhost:3000")
                .header("Access-Control-Request-Method", "POST"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));
  }

  private Session registerAndLogin(String prefix) throws Exception {
    String username = unique(prefix);
    String password = "StrongPass123!";
    MvcResult register =
        mockMvc
            .perform(
                post("/api/v1/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            Map.of(
                                "username",
                                username,
                                "email",
                                username + "@example.com",
                                "password",
                                password))))
            .andExpect(status().isCreated())
            .andReturn();
    MvcResult login = login(username, password);
    return new Session(json(register).path("id").asLong(), json(login).path("access_token").asText());
  }

  private MvcResult login(String username, String password) throws Exception {
    return mockMvc
        .perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        Map.of("username_or_email", username, "password", password))))
        .andExpect(status().isOk())
        .andReturn();
  }

  private org.springframework.test.web.servlet.ResultActions saveSettings(
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
            .content(objectMapper.writeValueAsString(Map.of("content", SAMPLE_WRITING, "task_type", "analysis"))));
  }

  private JsonNode parseSse(MvcResult result) throws Exception {
    String body = result.getResponse().getContentAsString();
    assertThat(body).startsWith("data: ");
    return objectMapper.readTree(body.substring("data: ".length()).trim());
  }

  private record Session(long userId, String token) {
    String authHeader() {
      return "Bearer " + token;
    }
  }
}

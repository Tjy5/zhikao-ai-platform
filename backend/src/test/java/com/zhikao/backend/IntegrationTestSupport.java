package com.zhikao.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zhikao.backend.ai.AiClassification;
import com.zhikao.backend.ai.AiProvider;
import com.zhikao.backend.ai.AiProviderConfig;
import com.zhikao.backend.ai.AiProviderException;
import com.zhikao.backend.settings.SettingsDtos.ProviderModelInfo;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
    classes = {ZhikaoBackendApplication.class, IntegrationTestSupport.FakeAiProviderConfig.class})
@AutoConfigureMockMvc
public abstract class IntegrationTestSupport {
  private static final Path TEST_DB = createTempDb();

  @Autowired protected MockMvc mockMvc;
  @Autowired protected ObjectMapper objectMapper;
  @Autowired protected FakeAiProvider fakeAiProvider;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + sqlitePath(TEST_DB));
    registry.add("spring.datasource.hikari.maximum-pool-size", () -> "1");
    registry.add("app.secret-key", () -> "test-secret-key-with-enough-entropy");
    registry.add("app.model-settings-encryption-key", () -> "test-model-settings-encryption-key");
    registry.add("app.cors-origins", () -> "http://localhost:3000,http://127.0.0.1:3000");
  }

  @BeforeEach
  void resetFakeProvider() {
    fakeAiProvider.reset();
  }

  protected JsonNode json(MvcResult result) throws Exception {
    return objectMapper.readTree(result.getResponse().getContentAsString());
  }

  protected static String unique(String prefix) {
    return prefix + "_" + System.nanoTime();
  }

  protected Session registerAndLogin(String prefix) throws Exception {
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

  protected MvcResult login(String username, String password) throws Exception {
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

  protected record Session(long userId, String token) {
    String authHeader() {
      return "Bearer " + token;
    }
  }

  private static Path createTempDb() {
    try {
      Path file = Files.createTempFile("zhikao-backend-test-", ".db");
      file.toFile().deleteOnExit();
      return file;
    } catch (IOException error) {
      throw new IllegalStateException("Cannot create test database", error);
    }
  }

  private static String sqlitePath(Path path) {
    return path.toAbsolutePath().toString().replace('\\', '/');
  }

  @TestConfiguration
  public static class FakeAiProviderConfig {
    @Bean
    @Primary
    FakeAiProvider fakeAiProvider() {
      return new FakeAiProvider();
    }
  }

  public static class FakeAiProvider implements AiProvider {
    private String content = "# 写作反馈结果\n\n## 综合评价\n观点明确，结构完整。";
    private AiClassification failure;
    private List<ProviderModelInfo> models =
        new ArrayList<>(
            List.of(
                new ProviderModelInfo("writing-model-b", 1686935002L, "model", "provider"),
                new ProviderModelInfo("writing-model-a", 1686935001L, "model", "provider")));
    private AiProviderConfig lastConfig;

    void reset() {
      content = "# 写作反馈结果\n\n## 综合评价\n观点明确，结构完整。";
      failure = null;
      models =
          new ArrayList<>(
              List.of(
                  new ProviderModelInfo("writing-model-b", 1686935002L, "model", "provider"),
                  new ProviderModelInfo("writing-model-a", 1686935001L, "model", "provider")));
      lastConfig = null;
    }

    void failWith(AiClassification classification) {
      this.failure = classification;
    }

    AiProviderConfig lastConfig() {
      return lastConfig;
    }

    @Override
    public String gradeWritingRaw(AiProviderConfig config, String writingContent, String taskType) {
      lastConfig = config;
      if (failure != null) {
        throw new AiProviderException(failure, failure.value());
      }
      return content;
    }

    @Override
    public List<ProviderModelInfo> listModels(AiProviderConfig config) {
      lastConfig = config;
      if (failure != null) {
        throw new AiProviderException(failure, failure.value());
      }
      return models;
    }
  }
}

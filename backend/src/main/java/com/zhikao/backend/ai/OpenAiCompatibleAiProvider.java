package com.zhikao.backend.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zhikao.backend.settings.SettingsDtos.ProviderModelInfo;
import java.io.IOException;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class OpenAiCompatibleAiProvider implements AiProvider {
  private static final Logger logger = LoggerFactory.getLogger(OpenAiCompatibleAiProvider.class);
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  private final ObjectMapper objectMapper;
  private final WritingPromptBuilder promptBuilder;
  private final HttpClient httpClient;

  public OpenAiCompatibleAiProvider(ObjectMapper objectMapper, WritingPromptBuilder promptBuilder) {
    this.objectMapper = objectMapper;
    this.promptBuilder = promptBuilder;
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  }

  @Override
  public String gradeWritingRaw(AiProviderConfig config, String writingContent, String taskType) {
    requireConfigured(config);
    Map<String, Object> payload =
        Map.of(
            "model",
            config.modelName(),
            "messages",
            List.of(
                Map.of("role", "system", "content", promptBuilder.systemPrompt()),
                Map.of("role", "user", "content", promptBuilder.userPrompt(writingContent, taskType))));
    Map<String, Object> response = requestJson("POST", endpoint(config.baseUrl(), "chat/completions"), config.apiKey(), payload);
    Object choicesValue = response.get("choices");
    if (!(choicesValue instanceof List<?> choices) || choices.isEmpty()) {
      throw new AiProviderException(AiClassification.MALFORMED_OUTPUT, "missing choices");
    }
    Object first = choices.getFirst();
    if (!(first instanceof Map<?, ?> choice)) {
      throw new AiProviderException(AiClassification.MALFORMED_OUTPUT, "invalid choice");
    }
    Object messageValue = choice.get("message");
    if (!(messageValue instanceof Map<?, ?> message)) {
      throw new AiProviderException(AiClassification.MALFORMED_OUTPUT, "missing message");
    }
    Object refusal = message.get("refusal");
    if (refusal instanceof String value && !value.isBlank()) {
      throw new AiProviderException(AiClassification.REFUSAL, "model refusal");
    }
    Object contentValue = message.get("content");
    String content = contentValue instanceof String value ? value.trim() : "";
    if (content.isBlank()) {
      throw new AiProviderException(AiClassification.MALFORMED_OUTPUT, "empty content");
    }
    logger.info(
        "LLM raw grading success model={} acquisition_mode=raw_text content_length={}",
        config.modelName(),
        content.length());
    return content;
  }

  @Override
  public List<ProviderModelInfo> listModels(AiProviderConfig config) {
    requireConfigured(config);
    Map<String, Object> response = requestJson("GET", endpoint(config.baseUrl(), "models"), config.apiKey(), null);
    Object dataValue = response.get("data");
    if (!(dataValue instanceof List<?> data)) {
      throw new AiProviderException(AiClassification.MALFORMED_OUTPUT, "models data missing");
    }
    List<ProviderModelInfo> models = new ArrayList<>();
    for (Object item : data) {
      if (item instanceof Map<?, ?> model) {
        String id = asString(model.get("id"));
        if (!id.isBlank()) {
          models.add(
              new ProviderModelInfo(
                  id,
                  asLong(model.get("created")),
                  blankToNull(asString(model.get("object"))),
                  blankToNull(asString(model.get("owned_by")))));
        }
      }
    }
    models.sort(Comparator.comparing(ProviderModelInfo::id));
    logger.info("Provider model discovery success base_url={} count={}", config.baseUrl(), models.size());
    return models;
  }

  private Map<String, Object> requestJson(
      String method, URI uri, String apiKey, Map<String, Object> payload) {
    try {
      HttpRequest.Builder builder =
          HttpRequest.newBuilder(uri)
              .timeout(Duration.ofSeconds(30))
              .header("Authorization", "Bearer " + apiKey)
              .header("Accept", "application/json");
      if ("POST".equals(method)) {
        builder.header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)));
      } else {
        builder.GET();
      }
      HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw classifyStatus(response.statusCode());
      }
      return objectMapper.readValue(response.body(), MAP_TYPE);
    } catch (AiProviderException error) {
      throw error;
    } catch (HttpTimeoutException error) {
      throw new AiProviderException(AiClassification.TIMEOUT, "provider timeout");
    } catch (ConnectException error) {
      throw new AiProviderException(AiClassification.UNAVAILABLE, "provider unavailable");
    } catch (IOException error) {
      throw new AiProviderException(AiClassification.PROVIDER_ERROR, "provider io error");
    } catch (InterruptedException error) {
      Thread.currentThread().interrupt();
      throw new AiProviderException(AiClassification.TIMEOUT, "provider interrupted");
    }
  }

  private static AiProviderException classifyStatus(int statusCode) {
    if (statusCode == 401 || statusCode == 403) {
      return new AiProviderException(AiClassification.AUTHENTICATION, "provider authentication failed");
    }
    if (statusCode == 429) {
      return new AiProviderException(AiClassification.RATE_LIMIT, "provider rate limited");
    }
    if (statusCode >= 500) {
      return new AiProviderException(AiClassification.PROVIDER_ERROR, "provider server error");
    }
    return new AiProviderException(AiClassification.PROVIDER_ERROR, "provider request failed");
  }

  private static void requireConfigured(AiProviderConfig config) {
    if (config == null || !config.configured()) {
      throw new AiProviderException(AiClassification.UNAVAILABLE, "api key missing");
    }
  }

  private static URI endpoint(String baseUrl, String path) {
    String normalized = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    return URI.create(normalized + "/" + path);
  }

  private static String asString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private static Long asLong(Object value) {
    if (value instanceof Number number) {
      return number.longValue();
    }
    if (value instanceof String text && !text.isBlank()) {
      try {
        return Long.parseLong(text);
      } catch (NumberFormatException ignored) {
        return null;
      }
    }
    return null;
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}

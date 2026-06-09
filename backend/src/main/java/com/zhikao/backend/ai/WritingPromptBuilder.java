package com.zhikao.backend.ai;

import org.springframework.stereotype.Component;

@Component
public class WritingPromptBuilder {
  private static final String SYSTEM_PROMPT =
      """
      你是一位资深的写作评阅专家，请对用户作答进行批改。

      输出要求：直接输出 Markdown 格式的批改报告，禁止输出 JSON、代码块或内部说明。
      """;

  public String systemPrompt() {
    return SYSTEM_PROMPT;
  }

  public String userPrompt(String writingContent, String taskType) {
    StringBuilder prompt = new StringBuilder();
    if (taskType != null && !taskType.isBlank()) {
      prompt.append("【任务类型】").append(taskType.trim()).append("\n\n");
    }
    prompt.append("【材料与作答】\n").append(writingContent);
    return prompt.toString();
  }
}

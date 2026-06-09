package com.zhikao.backend.ai;

import com.zhikao.backend.settings.SettingsDtos.ProviderModelInfo;
import java.util.List;

public interface AiProvider {
  String gradeWritingRaw(AiProviderConfig config, String writingContent, String taskType);

  List<ProviderModelInfo> listModels(AiProviderConfig config);
}

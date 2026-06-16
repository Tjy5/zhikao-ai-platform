package com.zhikao.backend.writing;

import com.zhikao.backend.ai.AiHttpException;
import com.zhikao.backend.ai.AiProvider;
import com.zhikao.backend.ai.AiProviderException;
import com.zhikao.backend.common.Clock;
import com.zhikao.backend.settings.EffectiveAiSettings;
import com.zhikao.backend.settings.SettingsService;
import com.zhikao.backend.writing.WritingDtos.RawWritingFeedbackResult;
import com.zhikao.backend.writing.WritingDtos.WritingSubmission;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WritingService {
  private final SettingsService settingsService;
  private final AiProvider aiProvider;
  private final HistoryService historyService;
  private final Clock clock;

  public WritingService(
      SettingsService settingsService,
      AiProvider aiProvider,
      HistoryService historyService,
      Clock clock) {
    this.settingsService = settingsService;
    this.aiProvider = aiProvider;
    this.historyService = historyService;
    this.clock = clock;
  }

  @Transactional
  public RawWritingFeedbackResult grade(long userId, WritingSubmission submission, String kind) {
    EffectiveAiSettings effective = null;
    Instant now = clock.now();
    try {
      effective = settingsService.requireEffectiveSettings(userId);
      String content =
          aiProvider.gradeWritingRaw(
              settingsService.providerConfig(effective), submission.content(), submission.taskType());
      RawWritingFeedbackResult result = new RawWritingFeedbackResult(content);
      settingsService.recordSuccess(effective, now);
      historyService.append(userId, kind, submission, result);
      return result;
    } catch (AiProviderException error) {
      if (effective != null) {
        settingsService.recordFailure(effective, now, error.classification());
      }
      throw new AiHttpException(error.classification());
    }
  }
}

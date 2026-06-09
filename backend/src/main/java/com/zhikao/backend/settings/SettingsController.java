package com.zhikao.backend.settings;

import com.zhikao.backend.security.CurrentUser;
import com.zhikao.backend.settings.SettingsDtos.ProviderModelsResponse;
import com.zhikao.backend.settings.SettingsDtos.ProviderTestResponse;
import com.zhikao.backend.settings.SettingsDtos.WritingAIModelDiscoveryRequest;
import com.zhikao.backend.settings.SettingsDtos.WritingAISettingsResponse;
import com.zhikao.backend.settings.SettingsDtos.WritingAISettingsUpdate;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/settings/writing-ai")
public class SettingsController {
  private final SettingsService settingsService;

  public SettingsController(SettingsService settingsService) {
    this.settingsService = settingsService;
  }

  @GetMapping
  public WritingAISettingsResponse get(Authentication authentication) {
    return settingsService.get(currentUser(authentication).id());
  }

  @PutMapping
  public WritingAISettingsResponse update(
      Authentication authentication, @Valid @RequestBody WritingAISettingsUpdate request) {
    return settingsService.update(currentUser(authentication).id(), request);
  }

  @PostMapping("/models")
  public ProviderModelsResponse models(
      Authentication authentication, @RequestBody(required = false) WritingAIModelDiscoveryRequest request) {
    return settingsService.discoverModels(currentUser(authentication).id(), request);
  }

  @PostMapping("/test")
  public ProviderTestResponse test(Authentication authentication) {
    return settingsService.testProvider(currentUser(authentication).id());
  }

  private static CurrentUser currentUser(Authentication authentication) {
    return (CurrentUser) authentication.getPrincipal();
  }
}

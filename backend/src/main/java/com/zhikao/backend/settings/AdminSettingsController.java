package com.zhikao.backend.settings;

import com.zhikao.backend.settings.AdminSettingsDtos.AdminSettingsResponse;
import com.zhikao.backend.settings.AdminSettingsDtos.AdminSettingsUpdate;
import com.zhikao.backend.settings.SettingsDtos.ProviderModelsResponse;
import com.zhikao.backend.settings.SettingsDtos.ProviderTestResponse;
import com.zhikao.backend.settings.SettingsDtos.WritingAIModelDiscoveryRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/settings")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSettingsController {
  private final PlatformSettingsService platformSettingsService;

  public AdminSettingsController(PlatformSettingsService platformSettingsService) {
    this.platformSettingsService = platformSettingsService;
  }

  @GetMapping
  public AdminSettingsResponse get() {
    return platformSettingsService.getAdminSettings();
  }

  @PutMapping
  public AdminSettingsResponse update(@Valid @RequestBody AdminSettingsUpdate request) {
    return platformSettingsService.updateAdminSettings(request);
  }

  @PostMapping("/writing-ai/models")
  public ProviderModelsResponse models(@RequestBody(required = false) WritingAIModelDiscoveryRequest request) {
    return platformSettingsService.discoverModels(request);
  }

  @PostMapping("/writing-ai/test")
  public ProviderTestResponse test() {
    return platformSettingsService.testProvider();
  }
}

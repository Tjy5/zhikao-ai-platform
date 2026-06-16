package com.zhikao.backend.settings;

import com.zhikao.backend.settings.AdminSettingsDtos.OperationPolicyResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/settings/operation-policy")
public class OperationPolicyController {
  private final PlatformSettingsService platformSettingsService;

  public OperationPolicyController(PlatformSettingsService platformSettingsService) {
    this.platformSettingsService = platformSettingsService;
  }

  @GetMapping
  public OperationPolicyResponse get() {
    return platformSettingsService.getOperationPolicy();
  }
}

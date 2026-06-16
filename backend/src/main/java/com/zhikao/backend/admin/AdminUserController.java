package com.zhikao.backend.admin;

import com.zhikao.backend.admin.AdminUserDtos.ActiveUpdateRequest;
import com.zhikao.backend.admin.AdminUserDtos.AdminUserListResponse;
import com.zhikao.backend.admin.AdminUserDtos.AdminUserSummary;
import com.zhikao.backend.admin.AdminUserDtos.RoleUpdateRequest;
import com.zhikao.backend.security.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {
  private final AdminUserService adminUserService;

  public AdminUserController(AdminUserService adminUserService) {
    this.adminUserService = adminUserService;
  }

  @GetMapping
  public AdminUserListResponse list(
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String role,
      @RequestParam(required = false) Boolean active,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer offset) {
    return adminUserService.list(q, role, active, limit, offset);
  }

  @PatchMapping("/{id}/role")
  public AdminUserSummary updateRole(
      Authentication authentication,
      @PathVariable long id,
      @RequestBody(required = false) RoleUpdateRequest request) {
    return adminUserService.updateRole(currentUser(authentication), id, request);
  }

  @PatchMapping("/{id}/active")
  public AdminUserSummary updateActive(
      Authentication authentication,
      @PathVariable long id,
      @RequestBody(required = false) ActiveUpdateRequest request) {
    return adminUserService.updateActive(currentUser(authentication), id, request);
  }

  private static CurrentUser currentUser(Authentication authentication) {
    return (CurrentUser) authentication.getPrincipal();
  }
}

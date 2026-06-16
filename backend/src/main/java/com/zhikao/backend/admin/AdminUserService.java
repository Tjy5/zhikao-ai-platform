package com.zhikao.backend.admin;

import com.zhikao.backend.admin.AdminUserDtos.ActiveUpdateRequest;
import com.zhikao.backend.admin.AdminUserDtos.AdminUserListResponse;
import com.zhikao.backend.admin.AdminUserDtos.AdminUserSummary;
import com.zhikao.backend.admin.AdminUserDtos.RoleUpdateRequest;
import com.zhikao.backend.data.UserRecord;
import com.zhikao.backend.data.UserRepository;
import com.zhikao.backend.security.CurrentUser;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminUserService {
  private static final int DEFAULT_LIMIT = 20;
  private static final int MAX_LIMIT = 100;

  private final UserRepository users;

  public AdminUserService(UserRepository users) {
    this.users = users;
  }

  public AdminUserListResponse list(String q, String role, Boolean active, Integer limit, Integer offset) {
    String normalizedRole = normalizeRole(role);
    int normalizedLimit = normalizeLimit(limit);
    int normalizedOffset = Math.max(offset == null ? 0 : offset, 0);
    List<AdminUserSummary> items =
        users.listForAdmin(q, normalizedRole, active, normalizedLimit, normalizedOffset).stream()
            .map(AdminUserService::toSummary)
            .toList();
    int total = users.countForAdmin(q, normalizedRole, active);
    return new AdminUserListResponse(items, total, normalizedLimit, normalizedOffset);
  }

  public AdminUserSummary updateRole(CurrentUser admin, long targetUserId, RoleUpdateRequest request) {
    String role = request == null ? null : request.role();
    if (role == null || role.isBlank() || !users.isAllowedRole(role.trim())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的角色");
    }
    String normalizedRole = role.trim();
    UserRecord target = findTarget(targetUserId);
    if (admin.id() == target.id() && !"admin".equals(normalizedRole)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "不能移除自己的管理员权限");
    }
    users.updateRole(target.id(), normalizedRole);
    return users.findById(target.id()).map(AdminUserService::toSummary).orElseThrow();
  }

  public AdminUserSummary updateActive(CurrentUser admin, long targetUserId, ActiveUpdateRequest request) {
    if (request == null || request.active() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "is_active 不能为空");
    }
    UserRecord target = findTarget(targetUserId);
    if (admin.id() == target.id() && !request.active()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "不能停用自己的账号");
    }
    users.updateActive(target.id(), request.active());
    return users.findById(target.id()).map(AdminUserService::toSummary).orElseThrow();
  }

  private UserRecord findTarget(long targetUserId) {
    return users
        .findById(targetUserId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));
  }

  private String normalizeRole(String role) {
    if (role == null || role.isBlank()) {
      return null;
    }
    String normalized = role.trim();
    if (!users.isAllowedRole(normalized)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的角色");
    }
    return normalized;
  }

  private static int normalizeLimit(Integer limit) {
    if (limit == null) {
      return DEFAULT_LIMIT;
    }
    return Math.min(Math.max(limit, 1), MAX_LIMIT);
  }

  private static AdminUserSummary toSummary(UserRecord user) {
    return new AdminUserSummary(
        user.id(),
        user.username(),
        user.email(),
        user.active(),
        user.role(),
        user.createdAt(),
        user.updatedAt());
  }
}

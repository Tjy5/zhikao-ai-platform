package com.zhikao.backend;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zhikao.backend.config.AppProperties;
import com.zhikao.backend.data.UserRepository;
import com.zhikao.backend.security.AdminRoleBootstrap;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.server.ResponseStatusException;

class RbacContractTests extends IntegrationTestSupport {
  @Autowired private UserRepository userRepository;

  @Test
  void adminPingRejectsUnauthenticatedRequest() throws Exception {
    mockMvc.perform(get("/api/v1/admin/ping")).andExpect(status().isUnauthorized());
  }

  @Test
  void adminPingRejectsRegularUserWithConsistentBody() throws Exception {
    Session user = registerAndLogin("rbac_user");
    mockMvc
        .perform(get("/api/v1/admin/ping").header("Authorization", user.authHeader()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.detail").value("权限不足"));
  }

  @Test
  void adminPingAllowsAdminUser() throws Exception {
    Session admin = registerAndLoginAdmin("rbac_admin");
    mockMvc
        .perform(get("/api/v1/admin/ping").header("Authorization", admin.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ok").value(true));
  }

  @Test
  void authMeReportsRoleForUserAndAdmin() throws Exception {
    Session user = registerAndLogin("rbac_role");
    mockMvc
        .perform(get("/api/v1/auth/me").header("Authorization", user.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("user"));

    userRepository.updateRole(user.userId(), "admin");
    mockMvc
        .perform(get("/api/v1/auth/me").header("Authorization", user.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("admin"));
  }

  @Test
  void rolePromotionTakesEffectWithoutRelogin() throws Exception {
    Session user = registerAndLogin("rbac_promote");
    mockMvc
        .perform(get("/api/v1/admin/ping").header("Authorization", user.authHeader()))
        .andExpect(status().isForbidden());

    userRepository.updateRole(user.userId(), "admin");

    // Same bearer token, but the filter reloads the DB role each request.
    mockMvc
        .perform(get("/api/v1/admin/ping").header("Authorization", user.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ok").value(true));
  }

  @Test
  void adminRoleBootstrapPromotesConfiguredUsernames() throws Exception {
    Session user = registerAndLogin("rbac_bootstrap");
    mockMvc
        .perform(get("/api/v1/admin/ping").header("Authorization", user.authHeader()))
        .andExpect(status().isForbidden());

    String username = userRepository.findById(user.userId()).orElseThrow().username();
    AppProperties properties = new AppProperties(false, "", "k", 60, "k", "", "", "", true, username);
    new AdminRoleBootstrap(properties, userRepository).run(null);

    mockMvc
        .perform(get("/api/v1/admin/ping").header("Authorization", user.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ok").value(true));
    mockMvc
        .perform(get("/api/v1/auth/me").header("Authorization", user.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("admin"));
  }

  @Test
  void updateRoleRejectsInvalidRole() throws Exception {
    Session user = registerAndLogin("rbac_invalid");
    assertThatThrownBy(() -> userRepository.updateRole(user.userId(), "superadmin"))
        .isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void promoteAdminsIsIdempotent() throws Exception {
    Session user = registerAndLogin("rbac_idempotent");
    String username = userRepository.findById(user.userId()).orElseThrow().username();

    AppProperties properties = new AppProperties(false, "", "k", 60, "k", "", "", "", true, username);
    AdminRoleBootstrap bootstrap = new AdminRoleBootstrap(properties, userRepository);
    bootstrap.run(null);
    bootstrap.run(null);

    mockMvc
        .perform(get("/api/v1/admin/ping").header("Authorization", user.authHeader()))
        .andExpect(status().isOk());
  }

  private Session registerAndLoginAdmin(String prefix) throws Exception {
    Session session = registerAndLogin(prefix);
    userRepository.updateRole(session.userId(), "admin");
    return session;
  }
}

package com.zhikao.backend;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zhikao.backend.data.UserRepository;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class AdminUsersContractTests extends IntegrationTestSupport {
  @Autowired private UserRepository userRepository;

  @Test
  void adminUserEndpointsAreAdminOnlyBeforeValidation() throws Exception {
    Session user = registerAndLogin("admin_users_user_only");

    mockMvc.perform(get("/api/v1/admin/users")).andExpect(status().isUnauthorized());
    mockMvc
        .perform(get("/api/v1/admin/users").header("Authorization", user.authHeader()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.detail").value("权限不足"));
    mockMvc
        .perform(
            patch("/api/v1/admin/users/" + user.userId() + "/role")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.detail").value("权限不足"));
    mockMvc
        .perform(
            patch("/api/v1/admin/users/" + user.userId() + "/active")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.detail").value("权限不足"));
  }

  @Test
  void adminCanListSearchFilterAndPaginateUsers() throws Exception {
    Session admin = registerAndLoginAdmin("admin_users_list_admin");
    Session alpha = registerAndLogin("admin_users_list_alpha");
    Session beta = registerAndLogin("admin_users_list_beta");
    Session gamma = registerAndLogin("admin_users_list_gamma");
    userRepository.updateRole(beta.userId(), "admin");
    userRepository.updateActive(gamma.userId(), false);

    mockMvc
        .perform(
            get("/api/v1/admin/users")
                .header("Authorization", admin.authHeader())
                .param("q", "admin_users_list_")
                .param("limit", "2")
                .param("offset", "0"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(4))
        .andExpect(jsonPath("$.limit").value(2))
        .andExpect(jsonPath("$.offset").value(0))
        .andExpect(jsonPath("$.users.length()").value(2));

    mockMvc
        .perform(
            get("/api/v1/admin/users")
                .header("Authorization", admin.authHeader())
                .param("q", userRepository.findById(alpha.userId()).orElseThrow().email()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.users[0].id").value(alpha.userId()));

    mockMvc
        .perform(
            get("/api/v1/admin/users")
                .header("Authorization", admin.authHeader())
                .param("q", "admin_users_list_")
                .param("role", "admin"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(2));

    mockMvc
        .perform(
            get("/api/v1/admin/users")
                .header("Authorization", admin.authHeader())
                .param("q", "admin_users_list_")
                .param("active", "false"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.users[0].id").value(gamma.userId()));
  }

  @Test
  void adminCanUpdateRoleAndActiveStatusForAnotherUser() throws Exception {
    Session admin = registerAndLoginAdmin("admin_users_mutate_admin");
    Session user = registerAndLogin("admin_users_mutate_target");

    mockMvc
        .perform(
            patch("/api/v1/admin/users/" + user.userId() + "/role")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"admin\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(user.userId()))
        .andExpect(jsonPath("$.role").value("admin"))
        .andExpect(jsonPath("$.hashed_password").doesNotExist());

    mockMvc
        .perform(get("/api/v1/auth/me").header("Authorization", user.authHeader()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("admin"));

    mockMvc
        .perform(
            patch("/api/v1/admin/users/" + user.userId() + "/active")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"is_active\":false}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(user.userId()))
        .andExpect(jsonPath("$.is_active").value(false));
  }

  @Test
  void invalidRoleIsRejected() throws Exception {
    Session admin = registerAndLoginAdmin("admin_users_invalid_admin");
    Session user = registerAndLogin("admin_users_invalid_target");

    mockMvc
        .perform(
            get("/api/v1/admin/users")
                .header("Authorization", admin.authHeader())
                .param("role", "superadmin"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.detail").value("无效的角色"));

    mockMvc
        .perform(
            patch("/api/v1/admin/users/" + user.userId() + "/role")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"superadmin\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.detail").value("无效的角色"));
  }

  @Test
  void adminUserOutputNeverExposesPasswordHashesOrProviderSecrets() throws Exception {
    Session admin = registerAndLoginAdmin("admin_users_safe_admin");
    Session user = registerAndLogin("admin_users_safe_target");
    String secret = "sk-admin-user-secret-9999";
    savePersonalSettings(user, secret);

    mockMvc
        .perform(
            get("/api/v1/admin/users")
                .header("Authorization", admin.authHeader())
                .param("q", "admin_users_safe_"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.users[0].hashed_password").doesNotExist())
        .andExpect(jsonPath("$.users[0].api_key").doesNotExist())
        .andExpect(jsonPath("$.users[0].api_key_encrypted").doesNotExist())
        .andExpect(jsonPath("$", not(containsString(secret))))
        .andExpect(jsonPath("$", not(containsString("hashed_password"))))
        .andExpect(jsonPath("$", not(containsString("api_key"))));
  }

  @Test
  void selfDeactivationAndSelfDemotionAreRejected() throws Exception {
    Session admin = registerAndLoginAdmin("admin_users_self_admin");

    mockMvc
        .perform(
            patch("/api/v1/admin/users/" + admin.userId() + "/active")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"is_active\":false}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.detail").value("不能停用自己的账号"));

    mockMvc
        .perform(
            patch("/api/v1/admin/users/" + admin.userId() + "/role")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"user\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.detail").value("不能移除自己的管理员权限"));

    mockMvc
        .perform(get("/api/v1/admin/users").header("Authorization", admin.authHeader()))
        .andExpect(status().isOk());
  }

  private Session registerAndLoginAdmin(String prefix) throws Exception {
    Session session = registerAndLogin(prefix);
    userRepository.updateRole(session.userId(), "admin");
    return session;
  }

  private void savePersonalSettings(Session user, String apiKey) throws Exception {
    mockMvc
        .perform(
            put("/api/v1/settings/writing-ai")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        Map.of(
                            "provider_name",
                            "openai-compatible",
                            "base_url",
                            "https://safe.example.com/v1",
                            "model_name",
                            "safe-model",
                            "api_key",
                            apiKey,
                            "json_fallback_enabled",
                            true))))
        .andExpect(status().isOk());
  }
}

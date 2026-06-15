package com.zhikao.backend.security;

import com.zhikao.backend.config.AppProperties;
import com.zhikao.backend.data.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class AdminRoleBootstrap implements ApplicationRunner {
  private final AppProperties properties;
  private final UserRepository users;

  public AdminRoleBootstrap(AppProperties properties, UserRepository users) {
    this.properties = properties;
    this.users = users;
  }

  @Override
  public void run(ApplicationArguments args) {
    users.promoteAdmins(properties.adminUsernameList());
  }
}

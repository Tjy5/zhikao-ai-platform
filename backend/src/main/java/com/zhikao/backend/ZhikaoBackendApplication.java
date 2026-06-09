package com.zhikao.backend;

import com.zhikao.backend.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class ZhikaoBackendApplication {
  public static void main(String[] args) {
    SpringApplication.run(ZhikaoBackendApplication.class, args);
  }
}

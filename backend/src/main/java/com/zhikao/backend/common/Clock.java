package com.zhikao.backend.common;

import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class Clock {
  public Instant now() {
    return Instant.now();
  }
}

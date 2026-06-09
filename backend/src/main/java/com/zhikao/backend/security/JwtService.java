package com.zhikao.backend.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.zhikao.backend.common.Clock;
import com.zhikao.backend.config.AppProperties;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
  private final AppProperties properties;
  private final Clock clock;
  private final Algorithm algorithm;
  private final JWTVerifier verifier;

  public JwtService(AppProperties properties, Clock clock) {
    this.properties = properties;
    this.clock = clock;
    this.algorithm = Algorithm.HMAC256(properties.secretKey());
    this.verifier = JWT.require(algorithm).withIssuer("zhikao-backend").build();
  }

  public String createAccessToken(long userId) {
    Instant now = clock.now();
    Instant expiresAt = now.plus(properties.accessTokenExpireMinutes(), ChronoUnit.MINUTES);
    return JWT.create()
        .withIssuer("zhikao-backend")
        .withSubject(Long.toString(userId))
        .withIssuedAt(Date.from(now))
        .withExpiresAt(Date.from(expiresAt))
        .sign(algorithm);
  }

  public long verifyUserId(String token) {
    try {
      String subject = verifier.verify(token).getSubject();
      return Long.parseLong(subject);
    } catch (JWTVerificationException | NumberFormatException error) {
      throw new InvalidJwtException();
    }
  }

  public int expiresInSeconds() {
    return Math.max(1, properties.accessTokenExpireMinutes() * 60);
  }
}

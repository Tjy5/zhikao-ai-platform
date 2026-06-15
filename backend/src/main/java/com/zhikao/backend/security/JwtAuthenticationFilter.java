package com.zhikao.backend.security;

import com.zhikao.backend.data.UserRecord;
import com.zhikao.backend.data.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
  private final JwtService jwtService;
  private final UserRepository users;

  public JwtAuthenticationFilter(JwtService jwtService, UserRepository users) {
    this.jwtService = jwtService;
    this.users = users;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String header = request.getHeader("Authorization");
    if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
      authenticate(header.substring(7).trim());
    }
    filterChain.doFilter(request, response);
  }

  private void authenticate(String token) {
    try {
      long userId = jwtService.verifyUserId(token);
      UserRecord user = users.findById(userId).filter(UserRecord::active).orElseThrow();
      CurrentUser currentUser =
          new CurrentUser(
              user.id(), user.username(), user.email(), user.active(), user.role());
      List<SimpleGrantedAuthority> authorities = new ArrayList<>();
      authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
      if ("admin".equals(user.role())) {
        authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
      }
      UsernamePasswordAuthenticationToken authentication =
          new UsernamePasswordAuthenticationToken(currentUser, null, authorities);
      SecurityContextHolder.getContext().setAuthentication(authentication);
    } catch (RuntimeException error) {
      SecurityContextHolder.clearContext();
    }
  }
}

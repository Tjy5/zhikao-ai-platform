package com.zhikao.backend.security;

public record CurrentUser(long id, String username, String email, boolean active) {}

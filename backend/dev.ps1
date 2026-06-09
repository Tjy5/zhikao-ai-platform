#!/usr/bin/env pwsh

param(
  [int]$Port = 8001,
  [string]$DatabaseUrl = "jdbc:sqlite:./dev.db",
  [string]$CorsOrigins = "http://localhost:3000,http://127.0.0.1:3000",
  [switch]$SkipTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mvn = Join-Path $backendDir 'mvnw.cmd'
Push-Location $backendDir
try {
  if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw "未找到 Java。请先安装 Java 21，并确认 java 位于 PATH。"
  }
  if (-not (Test-Path $mvn)) {
    if (Get-Command mvn -ErrorAction SilentlyContinue) {
      $mvn = 'mvn'
    } else {
      throw "未找到 Maven wrapper 或全局 Maven。请确认 backend/mvnw.cmd 存在，或安装 Maven 3.9+。"
    }
  }

  $env:BACKEND_PORT = [string]$Port
  $env:JDBC_DATABASE_URL = $DatabaseUrl
  $env:BACKEND_CORS_ORIGINS = $CorsOrigins
  if (-not $env:APP_SECRET_KEY) { $env:APP_SECRET_KEY = "dev-only-change-me" }
  if (-not $env:MODEL_SETTINGS_ENCRYPTION_KEY) {
    $env:MODEL_SETTINGS_ENCRYPTION_KEY = "dev-only-model-settings-key-change-me"
  }

  if (-not $SkipTests) {
    & $mvn test
    if ($LASTEXITCODE -ne 0) { throw "后端测试失败" }
  }

  & $mvn spring-boot:run
  if ($LASTEXITCODE -ne 0) { throw "Spring Boot 启动失败" }
} finally {
  Pop-Location
}

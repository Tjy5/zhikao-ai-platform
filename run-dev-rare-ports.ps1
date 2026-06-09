#!/usr/bin/env pwsh

<##
启动/复用前后端开发环境，同时同步端口配置。

示例：
  .\run-dev-rare-ports.ps1                 # 使用默认端口 65123/65124
  .\run-dev-rare-ports.ps1 -BackendPort 8001 -FrontendPort 3000
##>

param(
  [int]$BackendPort,
  [int]$FrontendPort,
  [switch]$ShowLogs
)

if (-not $BackendPort) { $BackendPort = 65123 }
if (-not $FrontendPort) { $FrontendPort = 65124 }

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Quiet = -not $ShowLogs
$script:PortFiles = @()

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory = $true)][string]$Action,
    [switch]$QuietOutput,
    [string]$WorkingDirectory
  )

  $previous = Get-Location
  if ($WorkingDirectory) { Set-Location $WorkingDirectory }
  try {
    if ($QuietOutput) {
      $output = & $FilePath @Arguments 2>&1
      $exitCode = $LASTEXITCODE
      if ($exitCode -ne 0) {
        if ($output) { $output | Out-Host }
        throw "$Action 失败，退出码 $exitCode"
      }
      return
    }

    & $FilePath @Arguments 2>&1 | Out-Host
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
      throw "$Action 失败，退出码 $exitCode"
    }
  } finally {
    Set-Location $previous
  }
}

function Assert-PortValid {
  param([Parameter(Mandatory = $true)][int]$Port,[string]$Name)
  if ($Port -lt 1 -or $Port -gt 65535) {
    throw "${Name} 端口必须在 1-65535 之间，当前为 $Port"
  }
}

function Test-PortInUse {
  param([Parameter(Mandatory = $true)][int]$PortToTest)
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $PortToTest, $null, $null)
    $completed = $iar.AsyncWaitHandle.WaitOne(600)
    if ($completed -and $client.Connected) { $client.Close(); return $true }
    $client.Close(); return $false
  } catch {
    return $false
  }
}

function Wait-ForPortUp {
  param([Parameter(Mandatory = $true)][int]$Port,[int]$TimeoutSec = 60)
  $elapsed = 0
  while ($elapsed -lt $TimeoutSec) {
    if (Test-PortInUse -PortToTest $Port) { return $true }
    Start-Sleep -Seconds 1
    $elapsed++
  }
  return (Test-PortInUse -PortToTest $Port)
}

function Write-PortFile {
  param([string]$Name,[int]$Port)
  $file = Join-Path $PSScriptRoot "${Name}_port.txt"
  $Port | Out-File -FilePath $file -Encoding utf8 -NoNewline
  if (-not ($script:PortFiles -contains $file)) { $script:PortFiles += $file }
  return $file
}

function Assert-FrontendApiConfig {
  $configPath = Join-Path (Join-Path $PSScriptRoot 'frontend') 'src/config/api.ts'
  if (-not (Test-Path $configPath)) {
    throw "[前端] 缺少 API 配置文件：$configPath"
  }
  $existing = Get-Content $configPath -Raw
  if ($existing -notmatch 'import\.meta\.env\.VITE_API_URL' -or $existing -notmatch 'import\.meta\.env\.VITE_FRONTEND_URL') {
    throw "[前端] API 配置必须使用 Vite 环境变量 VITE_API_URL / VITE_FRONTEND_URL"
  }
  Write-Host "[前端] API 配置使用 Vite 环境变量" -ForegroundColor DarkGreen
}

function Write-FrontendEnvLocal {
  param([int]$Frontend,[int]$Backend)
  $envPath = Join-Path (Join-Path $PSScriptRoot 'frontend') '.env.local'
  $content = @(
    "PORT=$Frontend",
    "VITE_API_URL=http://localhost:$Backend",
    "VITE_FRONTEND_URL=http://localhost:$Frontend",
    "VITE_IMAGE_PATH=/api/v1/tasks/images/**",
    "VITE_DEBUG=false",
    ""
  ) -join "`n"
  if ((Test-Path $envPath) -and ((Get-Content $envPath -Raw) -eq $content)) {
    Write-Host "[前端] .env.local 未变化" -ForegroundColor DarkGreen
    return
  }
  Set-Content -Path $envPath -Value $content -Encoding UTF8
  Write-Host "[前端] 已同步 .env.local：后端=$Backend，前端=$Frontend" -ForegroundColor DarkCyan
}

function Ensure-JavaBackendReady {
  $backendDir = Join-Path $PSScriptRoot 'backend'
  if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw "未找到 Java。请安装 Java 21 并加入 PATH。"
  }
  $mvn = Resolve-MavenCommand -BackendDir $backendDir
  Write-Host "[后端] 运行 Java 后端测试" -ForegroundColor Yellow
  Invoke-CheckedCommand -FilePath $mvn -Arguments @('test') -Action '[后端] Maven test' -QuietOutput:$Quiet -WorkingDirectory $backendDir
}

function Resolve-MavenCommand {
  param([Parameter(Mandatory = $true)][string]$BackendDir)
  $wrapper = Join-Path $BackendDir 'mvnw.cmd'
  if (Test-Path $wrapper) { return $wrapper }
  if (Get-Command mvn -ErrorAction SilentlyContinue) { return 'mvn' }
  throw "未找到 Maven wrapper 或全局 Maven。请确认 backend/mvnw.cmd 存在，或安装 Maven 3.9+。"
}

function Ensure-FrontendDeps {
  $frontendDir = Join-Path $PSScriptRoot 'frontend'
  if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
    Write-Host "[前端] 安装 Node 依赖 (npm install)" -ForegroundColor Yellow
    Invoke-CheckedCommand -FilePath 'npm' -Arguments @('install') -Action '[前端] 安装 Node 依赖' -QuietOutput:$Quiet -WorkingDirectory $frontendDir
  }
}

function Start-Backend {
  param([int]$Port,[int]$FrontendPort)
  if (Test-PortInUse -PortToTest $Port) {
    Write-Host "后端已在运行: http://localhost:$Port" -ForegroundColor Cyan
    Write-PortFile -Name 'backend' -Port $Port | Out-Null
    return $null
  }
  Write-Host "启动 Java 后端: http://localhost:$Port" -ForegroundColor Yellow
  $job = Start-Job -ScriptBlock {
    param($root, $port, $frontendPort)
    Set-Location (Join-Path $root 'backend')
    $env:BACKEND_PORT = [string]$port
    $env:JDBC_DATABASE_URL = "jdbc:sqlite:./dev.db"
    $env:BACKEND_CORS_ORIGINS = "http://localhost:$frontendPort,http://127.0.0.1:$frontendPort"
    if (-not $env:APP_SECRET_KEY) { $env:APP_SECRET_KEY = "dev-only-change-me" }
    if (-not $env:MODEL_SETTINGS_ENCRYPTION_KEY) {
      $env:MODEL_SETTINGS_ENCRYPTION_KEY = "dev-only-model-settings-key-change-me"
    }
    $mvn = Join-Path (Get-Location) 'mvnw.cmd'
    if (-not (Test-Path $mvn)) { $mvn = 'mvn' }
    & $mvn spring-boot:run 2>&1
  } -ArgumentList $PSScriptRoot, $Port, $FrontendPort
  return $job
}

function Start-Frontend {
  param([int]$Port,[int]$BackendPort)
  $frontendDir = Join-Path $PSScriptRoot 'frontend'
  if (Test-PortInUse -PortToTest $Port) {
    Write-Host "前端已在运行: http://localhost:$Port" -ForegroundColor Cyan
    Assert-FrontendApiConfig
    Write-PortFile -Name 'frontend' -Port $Port | Out-Null
    return $null
  }
  Ensure-FrontendDeps
  Assert-FrontendApiConfig
  Write-FrontendEnvLocal -Frontend $Port -Backend $BackendPort
  Write-Host "启动前端: http://localhost:$Port" -ForegroundColor Yellow
  $job = Start-Job -ScriptBlock {
    param($root, $port, $backendPort)
    Set-Location (Join-Path $root 'frontend')
    $env:NODE_OPTIONS = "--max_old_space_size=4096"
    $env:FRONTEND_PORT = [string]$port
    $env:PORT = [string]$port
    $env:VITE_API_URL = "http://localhost:$backendPort"
    $env:VITE_FRONTEND_URL = "http://localhost:$port"
    & node start-server.js 2>&1
  } -ArgumentList $PSScriptRoot, $Port, $BackendPort
  return $job
}

Assert-PortValid -Port $BackendPort -Name 'Backend'
Assert-PortValid -Port $FrontendPort -Name 'Frontend'

Write-Host "启动全栈开发（Java 后端）" -ForegroundColor Green
Write-Host ("-" * 60) -ForegroundColor Gray

Write-PortFile -Name 'backend' -Port $BackendPort | Out-Null
Write-PortFile -Name 'frontend' -Port $FrontendPort | Out-Null
Assert-FrontendApiConfig
Write-FrontendEnvLocal -Frontend $FrontendPort -Backend $BackendPort
Ensure-JavaBackendReady

$backendJob = Start-Backend -Port $BackendPort -FrontendPort $FrontendPort
if ($backendJob) {
  Write-Host "[后端] 等待后端就绪..." -ForegroundColor Yellow
  if (-not (Wait-ForPortUp -Port $BackendPort -TimeoutSec 75)) {
    Write-Warning "[后端] 未在超时内开放端口 $BackendPort，请查看错误信息"
    $backendOutput = Receive-Job -Id $backendJob.Id -ErrorAction SilentlyContinue
    if ($backendOutput) { Write-Host "[后端] 输出：`n$backendOutput" -ForegroundColor Red }
  } else {
    Write-Host "[后端] 已成功启动" -ForegroundColor Green
  }
} else {
  Write-Host "[后端] 使用已有实例" -ForegroundColor Cyan
}

Start-Sleep -Seconds 2
$frontendJob = Start-Frontend -Port $FrontendPort -BackendPort $BackendPort
if ($frontendJob) {
  Write-Host "[前端] 等待前端就绪..." -ForegroundColor Yellow
  if (-not (Wait-ForPortUp -Port $FrontendPort -TimeoutSec 60)) {
    Write-Warning "[前端] 未在超时内开放端口 $FrontendPort，请查看错误信息"
    $frontendOutput = Receive-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue
    if ($frontendOutput) { Write-Host "[前端] 输出：`n$frontendOutput" -ForegroundColor Red }
  } else {
    Write-Host "[前端] 已成功启动" -ForegroundColor Green
  }
} else {
  Write-Host "[前端] 使用已有实例" -ForegroundColor Cyan
}

Write-Host ""
Write-Host ("-" * 60) -ForegroundColor Green
Write-Host "服务已就绪" -ForegroundColor Green
Write-Host ("-" * 60) -ForegroundColor Green
Write-Host "前端:  http://localhost:$FrontendPort" -ForegroundColor Cyan
Write-Host "后端:  http://localhost:$BackendPort" -ForegroundColor Magenta
Write-Host "健康:  http://localhost:$BackendPort/health" -ForegroundColor Magenta
Write-Host ""
Write-Host "关闭：按 Ctrl+C 结束" -ForegroundColor Yellow
Write-Host ("-" * 60) -ForegroundColor Green

try {
  while ($true) {
    $shouldBreak = $false
    if ($backendJob -and (Get-Job -Id $backendJob.Id -ErrorAction SilentlyContinue)) {
      $state = (Get-Job -Id $backendJob.Id).State
      if ($state -ne 'Running') {
        Write-Warning "[后端] Job 状态=$state，已停止"
        $output = Receive-Job -Id $backendJob.Id -ErrorAction SilentlyContinue
        if ($output) { Write-Host "[后端] 最后输出：`n$output" -ForegroundColor Yellow }
        $shouldBreak = $true
      }
    }
    if ($frontendJob -and (Get-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue)) {
      $state = (Get-Job -Id $frontendJob.Id).State
      if ($state -ne 'Running') {
        Write-Warning "[前端] Job 状态=$state，已停止"
        $output = Receive-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue
        if ($output) { Write-Host "[前端] 最后输出：`n$output" -ForegroundColor Yellow }
        $shouldBreak = $true
      }
    }
    if ($shouldBreak) { break }
    Start-Sleep -Seconds 5
  }
} catch {
  Write-Host "`n停止服务..." -ForegroundColor Yellow
} finally {
  if ($backendJob) { Stop-Job -Id $backendJob.Id -PassThru | Remove-Job | Out-Null }
  if ($frontendJob) { Stop-Job -Id $frontendJob.Id -PassThru | Remove-Job | Out-Null }
  foreach ($file in $script:PortFiles) {
    if (Test-Path $file) { Remove-Item $file -Force -ErrorAction SilentlyContinue }
  }
  Write-Host "已停止。" -ForegroundColor Gray
}

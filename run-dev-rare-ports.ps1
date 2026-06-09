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

# 默认安静模式，只输出必要中文；如需详细日志，追加 -ShowLogs
$Quiet = -not $ShowLogs

$script:PortFiles = @()

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory = $true)][string]$Action,
    [switch]$QuietOutput
  )

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
}

function Get-PythonLauncher {
  if (Get-Command python -ErrorAction SilentlyContinue) {
    return [pscustomobject]@{ FilePath = 'python'; Arguments = @() }
  }

  if (Get-Command py -ErrorAction SilentlyContinue) {
    return [pscustomobject]@{ FilePath = 'py'; Arguments = @('-3') }
  }

  throw "未找到 Python，请先安装 Python 3.x 并加入 PATH"
}

function Assert-PortValid {
  param(
    [Parameter(Mandatory = $true)][int]$Port,
    [string]$Name
  )

  if ($Port -lt 1 -or $Port -gt 65535) {
    throw "${Name} 端口必须在 1-65535 之间，当前为 $Port"
  }
}

Assert-PortValid -Port $BackendPort -Name 'Backend'
Assert-PortValid -Port $FrontendPort -Name 'Frontend'

Write-Host "启动全栈开发（固定端口）" -ForegroundColor Green
Write-Host ("-" * 60) -ForegroundColor Gray

function Test-PortInUse {
  param([Parameter(Mandatory = $true)][int]$PortToTest)
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $PortToTest, $null, $null)
    $completed = $iar.AsyncWaitHandle.WaitOne(600)
    if ($completed -and $client.Connected) { $client.Close(); return $true }
    $client.Close(); return $false
  } catch { return $false }
}

function Wait-ForPortUp {
  param([Parameter(Mandatory = $true)][int]$Port,[int]$TimeoutSec = 20)
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
  if (-not ($script:PortFiles -contains $file)) {
    $script:PortFiles += $file
  }
  return $file
}

function Sync-PortFiles {
  # Keep dynamic-port files available before the backend imports app.main.
  Write-PortFile -Name 'backend' -Port $BackendPort | Out-Null
  Write-PortFile -Name 'frontend' -Port $FrontendPort | Out-Null
}

function Ensure-BackendVenvAndDeps {
  $backendDir = Join-Path $PSScriptRoot 'backend'
  $venvPath = Join-Path $backendDir '.venv'
  Push-Location $backendDir
  try {
    if (-not (Test-Path $venvPath)) {
      Write-Host "创建后端虚拟环境 (.venv)" -ForegroundColor Yellow
      $pythonLauncher = Get-PythonLauncher
      $venvArgs = @($pythonLauncher.Arguments) + @('-m', 'venv', '.venv')
      Invoke-CheckedCommand -FilePath $pythonLauncher.FilePath -Arguments $venvArgs -Action '创建后端虚拟环境' -QuietOutput:$Quiet
    }
    $pythonExe = Join-Path $venvPath 'Scripts/python.exe'
    if (-not (Test-Path $pythonExe)) { throw "Python venv not created correctly at $venvPath" }
    if (Test-Path (Join-Path $backendDir 'requirements.txt')) {
      Write-Host "安装后端依赖" -ForegroundColor Yellow
      Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--upgrade', 'pip') -Action '升级后端 pip' -QuietOutput:$Quiet
      Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '-r', (Join-Path $backendDir 'requirements.txt')) -Action '安装后端依赖' -QuietOutput:$Quiet
    }
    return $pythonExe
  } finally {
    Pop-Location
  }
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
  $needsUpdate = $true
  if (Test-Path $envPath) {
    $existing = Get-Content $envPath -Raw
    if ($existing -eq $content) {
      $needsUpdate = $false
    }
  }
  if ($needsUpdate) {
    Set-Content -Path $envPath -Value $content -Encoding UTF8
    Write-Host "[前端] 已同步 .env.local：后端=$Backend，前端=$Frontend" -ForegroundColor DarkCyan
  } else {
    Write-Host "[前端] .env.local 未变化" -ForegroundColor DarkGreen
  }
}

function Ensure-FrontendDeps {
  $frontendDir = Join-Path $PSScriptRoot 'frontend'
  Push-Location $frontendDir
  try {
    if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
      Write-Host "[前端] 安装 Node 依赖 (npm install)" -ForegroundColor Yellow
      Invoke-CheckedCommand -FilePath 'npm' -Arguments @('install') -Action '[前端] 安装 Node 依赖' -QuietOutput:$Quiet
    }
  } finally {
    Pop-Location
  }
}

function Run-DBMigrations {
  param([string]$BackendDir,[string]$PythonExe,[int]$Retries = 3)
  for ($i=0; $i -lt $Retries; $i++) {
    try {
      Push-Location $BackendDir
      $env:DATABASE_URL = "sqlite:///./dev.db"
      $alembicCmd = Join-Path (Split-Path $PythonExe -Parent) 'alembic.exe'
      if (Test-Path $alembicCmd) {
        Invoke-CheckedCommand -FilePath $alembicCmd -Arguments @('upgrade', 'head') -Action '数据库迁移' -QuietOutput:$Quiet
      } else {
        Invoke-CheckedCommand -FilePath $PythonExe -Arguments @('-m', 'alembic', 'upgrade', 'head') -Action '数据库迁移' -QuietOutput:$Quiet
      }
      Write-Host "数据库迁移完成" -ForegroundColor Green
      return
    } catch {
      Write-Warning "[db] 迁移失败(第$($i+1)次)：$($_.Exception.Message)"
      Start-Sleep -Seconds 3
    } finally {
      Pop-Location
    }
  }
  throw "[db] 多次尝试迁移仍失败，请检查 SQLite 文件权限"
}

function Start-Backend {
  param([int]$Port,[string]$PythonExe)
  if (Test-PortInUse -PortToTest $Port) {
    Write-Host "后端已在运行: http://localhost:$Port" -ForegroundColor Cyan
    Write-PortFile -Name 'backend' -Port $Port | Out-Null
    return $null
  }
  $pythonExe = if ($PythonExe) { $PythonExe } else { Ensure-BackendVenvAndDeps }
  Write-Host "启动后端: http://localhost:$Port" -ForegroundColor Yellow
  $job = Start-Job -ScriptBlock {
    param($root, $py, $port)
    Set-Location (Join-Path $root 'backend')
    $env:DATABASE_URL = "sqlite:///./dev.db"
    & $py -m uvicorn app.main:app --reload --host 0.0.0.0 --port $port
  } -ArgumentList $PSScriptRoot, $pythonExe, $Port
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
  # 改进：始终显示输出（包括错误）以便诊断
  $job = Start-Job -ScriptBlock {
    param($root, $port, $backendPort)
    Set-Location (Join-Path $root 'frontend')
    $env:NODE_OPTIONS = "--max_old_space_size=4096"
    $env:FRONTEND_PORT = $port
    $env:PORT = $port
    $env:VITE_API_URL = "http://localhost:$backendPort"
    $env:VITE_FRONTEND_URL = "http://localhost:$port"
    & node start-server.js 2>&1  # 捕获stdout和stderr
  } -ArgumentList $PSScriptRoot, $Port, $BackendPort
  return $job
}

# 启动顺序：同步配置 → SQLite 迁移 → 启动/复用后端 → 启动/复用前端
$backendDir = Join-Path $PSScriptRoot 'backend'
Sync-PortFiles
Assert-FrontendApiConfig
Write-FrontendEnvLocal -Frontend $FrontendPort -Backend $BackendPort
$pyExeForMigrate = Ensure-BackendVenvAndDeps
Run-DBMigrations -BackendDir $backendDir -PythonExe $pyExeForMigrate

$backendJob = Start-Backend -Port $BackendPort -PythonExe $pyExeForMigrate
if ($backendJob) {
  Write-Host "[后端] 等待后端就绪..." -ForegroundColor Yellow
  if (-not (Wait-ForPortUp -Port $BackendPort -TimeoutSec 45)) {
    Write-Warning "[后端] 未在超时内开放端口 $BackendPort，请查看错误信息"
    $backendOutput = Receive-Job -Id $backendJob.Id -ErrorAction SilentlyContinue
    if ($backendOutput) { Write-Host "[后端] 错误输出：`n$backendOutput" -ForegroundColor Red }
  } else {
    Write-Host "[后端] 已成功启动" -ForegroundColor Green
  }
} else {
  Write-Host "[后端] 使用已有实例" -ForegroundColor Cyan
}
Write-PortFile -Name 'backend' -Port $BackendPort | Out-Null

# 等待后端完全就绪后再启动前端，确保可以建立初始连接
Write-Host "[启动] 延迟2秒以确保后端完全初始化..." -ForegroundColor DarkCyan
Start-Sleep -Seconds 2

$frontendJob = Start-Frontend -Port $FrontendPort -BackendPort $BackendPort
if ($frontendJob) {
  Write-Host "[前端] 等待前端就绪..." -ForegroundColor Yellow
  if (-not (Wait-ForPortUp -Port $FrontendPort -TimeoutSec 60)) {
    Write-Warning "[前端] 未在超时内开放端口 $FrontendPort，请查看错误信息"
    $frontendOutput = Receive-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue
    if ($frontendOutput) { Write-Host "[前端] 错误输出：`n$frontendOutput" -ForegroundColor Red }
  } else {
    Write-Host "[前端] 已成功启动" -ForegroundColor Green
  }
} else {
  Write-Host "[前端] 使用已有实例" -ForegroundColor Cyan
}
Write-PortFile -Name 'frontend' -Port $FrontendPort | Out-Null

Write-Host ""; Write-Host ("-" * 60) -ForegroundColor Green
Write-Host "服务已就绪" -ForegroundColor Green
Write-Host ("-" * 60) -ForegroundColor Green
Write-Host "前端:  http://localhost:$FrontendPort" -ForegroundColor Cyan
Write-Host "后端:  http://localhost:$BackendPort" -ForegroundColor Magenta
Write-Host "文档:  http://localhost:$BackendPort/docs" -ForegroundColor Magenta
Write-Host ""; Write-Host "关闭：按 Ctrl+C 结束" -ForegroundColor Yellow
Write-Host ("-" * 60) -ForegroundColor Green

try {
  while ($true) {
    $shouldBreak = $false

    if ($backendJob -and (Get-Job -Id $backendJob.Id -ErrorAction SilentlyContinue)) {
      $bState = (Get-Job -Id $backendJob.Id).State
      if ($bState -ne 'Running') {
        Write-Warning "[后端] Job 状态=$bState，已停止"
        $backendJobOutput = Receive-Job -Id $backendJob.Id -ErrorAction SilentlyContinue
        if ($backendJobOutput) { Write-Host "[后端] 最后输出：`n$backendJobOutput" -ForegroundColor Yellow }
        $shouldBreak = $true
      }
    }

    if ($frontendJob -and (Get-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue)) {
      $fState = (Get-Job -Id $frontendJob.Id).State
      if ($fState -ne 'Running') {
        Write-Warning "[前端] Job 状态=$fState，已停止"
        $frontendJobOutput = Receive-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue
        if ($frontendJobOutput) { Write-Host "[前端] 最后输出：`n$frontendJobOutput" -ForegroundColor Yellow }
        $shouldBreak = $true
      }
    }

    if ($shouldBreak) { break }
    Start-Sleep -Seconds 5
  }
} catch {
  Write-Host "`n🛑 停止服务..." -ForegroundColor Yellow
} finally {
  if ($backendJob) { Stop-Job -Id $backendJob.Id -PassThru | Remove-Job | Out-Null }
  if ($frontendJob) { Stop-Job -Id $frontendJob.Id -PassThru | Remove-Job | Out-Null }
  foreach ($file in $script:PortFiles) {
    if (Test-Path $file) {
      Remove-Item $file -Force -ErrorAction SilentlyContinue
    }
  }
  Write-Host "🧹 已停止。" -ForegroundColor Gray
}

#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "[dev] Backend one-click dev starting..." -ForegroundColor Cyan

function Ensure-Venv {
  $venvPath = Join-Path $PSScriptRoot ".venv"
  if (-not (Test-Path $venvPath)) {
    Write-Host "[dev] Creating virtualenv at .venv" -ForegroundColor Yellow
    python -m venv $venvPath
  }
  Write-Host "[dev] Activating virtualenv" -ForegroundColor Yellow
  & (Join-Path $venvPath "Scripts/Activate.ps1")
}

function Ensure-Deps {
  if (Test-Path (Join-Path $PSScriptRoot "requirements.txt")) {
    Write-Host "[dev] Installing Python dependencies" -ForegroundColor Yellow
    python -m pip install --upgrade pip > $null
    pip install -r (Join-Path $PSScriptRoot "requirements.txt")
  }
}

function Maybe-Start-DB {
  $composeAtRoot = Join-Path (Split-Path $PSScriptRoot -Parent) "docker-compose.yml"
  if (Test-Path $composeAtRoot) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
      Write-Host "[dev] Starting Postgres via docker compose (if not running)" -ForegroundColor Yellow
      Push-Location (Split-Path $PSScriptRoot -Parent)
      try {
        docker compose up -d db | Out-Host
      } catch {
        Write-Warning "[dev] docker compose failed: $($_.Exception.Message)"
      } finally {
        Pop-Location
      }
      # Wait briefly for port 5432
      Write-Host "[dev] Waiting for database port 5432..." -ForegroundColor Yellow
      $attempts = 0
      while ($attempts -lt 30) {
        $conn = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet
        if ($conn) { break }
        Start-Sleep -Seconds 1
        $attempts++
      }
      if ($attempts -ge 30) {
        Write-Warning "[dev] Database may not be up yet; continuing..."
      }
    } else {
      Write-Host "[dev] Docker not found; skipping DB startup" -ForegroundColor DarkYellow
    }
  }
}

function Maybe-Migrate {
  if (Test-Path (Join-Path $PSScriptRoot "alembic.ini")) {
    Write-Host "[dev] Applying DB migrations (alembic upgrade head)" -ForegroundColor Yellow
    try {
      alembic upgrade head | Out-Host
    } catch {
      Write-Warning "[dev] Alembic migration failed: $($_.Exception.Message)"
    }
  }
}

function Find-FreePort {
  param(
    [int]$StartPort = 8001,
    [int]$MaxAttempts = 100
  )
  
  for ($i = 0; $i -lt $MaxAttempts; $i++) {
    $port = $StartPort + $i
    try {
      # Try to bind to the port to see if it's available
      $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
      $listener.Start()
      $listener.Stop()
      # If we get here, port is available
      Write-Host "[dev] Found free port: $port" -ForegroundColor Green
      return $port
    } catch {
      # Port is in use, try next one
      continue
    }
  }
  
  throw "No free port found in range $StartPort-$($StartPort + $MaxAttempts - 1)"
}

Push-Location $PSScriptRoot
try {
  Ensure-Venv
  Ensure-Deps
  Maybe-Start-DB
  Maybe-Migrate
  
  # Find a free port for the backend
  $backendPort = Find-FreePort -StartPort 8001
  
  # Write port to file for other processes to read
  $backendPortFile = Join-Path (Split-Path $PSScriptRoot -Parent) "backend_port.txt"
  $backendPort | Out-File -FilePath $backendPortFile -Encoding utf8 -NoNewline
  Write-Host "[dev] Backend port saved to: $backendPortFile" -ForegroundColor Green
  
  Write-Host "[dev] Starting Backend with uvicorn on port $backendPort" -ForegroundColor Green
  Write-Host "[dev] Backend URL: http://localhost:$backendPort" -ForegroundColor Cyan
  Write-Host "[dev] API Docs: http://localhost:$backendPort/docs" -ForegroundColor Cyan
  
  uvicorn app.main:app --reload --host 0.0.0.0 --port $backendPort
} finally {
  # Clean up port file when server stops
  $backendPortFile = Join-Path (Split-Path $PSScriptRoot -Parent) "backend_port.txt"
  if (Test-Path $backendPortFile) {
    Remove-Item $backendPortFile -Force
    Write-Host "[dev] Cleaned up backend port file" -ForegroundColor Yellow
  }
  Pop-Location
}


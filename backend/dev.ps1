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

Push-Location $PSScriptRoot
try {
  Ensure-Venv
  Ensure-Deps
  Maybe-Start-DB
  Maybe-Migrate
  Write-Host "[dev] Starting Uvicorn on http://localhost:8001 (reload)" -ForegroundColor Green
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
} finally {
  Pop-Location
}


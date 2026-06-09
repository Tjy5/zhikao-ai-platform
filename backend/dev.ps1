#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "[dev] Backend one-click dev starting with SQLite..." -ForegroundColor Cyan

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

function Maybe-Migrate {
  if (Test-Path (Join-Path $PSScriptRoot "alembic.ini")) {
    Write-Host "[dev] Applying DB migrations (alembic upgrade head)" -ForegroundColor Yellow
    try {
      $env:DATABASE_URL = "sqlite:///./dev.db"
      # Try to run migration, but don't let it block for too long
      # Use python -m alembic to ensure we use the virtual environment
      $alembicCmd = if (Get-Command alembic -ErrorAction SilentlyContinue) {
        "alembic"
      } else {
        $venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
        if (Test-Path $venvPython) {
          "$venvPython -m alembic"
        } else {
          "python -m alembic"
        }
      }

      # Run migration with timeout
      $job = Start-Job -ScriptBlock {
        param($Cmd, $WorkingDir)
        Set-Location $WorkingDir
        Invoke-Expression "$Cmd upgrade head 2>&1"
      } -ArgumentList $alembicCmd, $PSScriptRoot

      $result = $job | Wait-Job -Timeout 15
      if ($result.State -eq 'Running') {
        Stop-Job $job
        Remove-Job $job
        Write-Warning "[dev] Migration timed out after 15 seconds, skipping..."
      } else {
        $output = Receive-Job $job
        Remove-Job $job
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
          Write-Warning "[dev] Alembic migration returned non-zero exit code, but continuing..."
        } else {
          Write-Host "[dev] Migration completed successfully" -ForegroundColor Green
        }
      }
    } catch {
      Write-Warning "[dev] Alembic migration failed: $($_.Exception.Message)"
      Write-Host "[dev] Continuing with server startup using SQLite" -ForegroundColor Yellow
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

  # Find a free port for the backend early, so we can create the port file.
  $backendPort = Find-FreePort -StartPort 8001

  # Write port to file early for other processes to read
  # Use PROJECT_ROOT environment variable if set, otherwise use Split-Path
  $projectRoot = if ($env:PROJECT_ROOT) { $env:PROJECT_ROOT } else { Split-Path $PSScriptRoot -Parent }
  $backendPortFile = Join-Path $projectRoot "backend_port.txt"
  $backendPort | Out-File -FilePath $backendPortFile -Encoding utf8 -NoNewline
  Write-Host "[dev] Backend port saved to: $backendPortFile" -ForegroundColor Green

  Maybe-Migrate

  Write-Host "[dev] Starting Backend with uvicorn on port $backendPort" -ForegroundColor Green
  Write-Host "[dev] Backend URL: http://localhost:$backendPort" -ForegroundColor Cyan
  Write-Host "[dev] API Docs: http://localhost:$backendPort/docs" -ForegroundColor Cyan

  # Use python -m uvicorn to ensure we use the virtual environment
  $pythonCmd = if (Test-Path (Join-Path $PSScriptRoot ".venv\Scripts\python.exe")) {
    Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
  } else {
    "python"
  }

  $env:DATABASE_URL = "sqlite:///./dev.db"
  & $pythonCmd -m uvicorn app.main:app --reload --host 0.0.0.0 --port $backendPort
} finally {
  # Clean up port file when server stops
  $projectRoot = if ($env:PROJECT_ROOT) { $env:PROJECT_ROOT } else { Split-Path $PSScriptRoot -Parent }
  $backendPortFile = Join-Path $projectRoot "backend_port.txt"
  if (Test-Path $backendPortFile) {
    Remove-Item $backendPortFile -Force
    Write-Host "[dev] Cleaned up backend port file" -ForegroundColor Yellow
  }
  Pop-Location
}

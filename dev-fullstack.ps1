#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "🚀 Starting Full Stack Development Environment" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Gray

# Function to start backend in background
function Start-Backend {
    Write-Host "📡 Starting Backend..." -ForegroundColor Yellow
    Push-Location "backend"
    try {
        $backendJob = Start-Job -ScriptBlock {
            Set-Location $using:PWD
            & ./dev.ps1
        }
        Write-Host "✅ Backend started (Job ID: $($backendJob.Id))" -ForegroundColor Green
        return $backendJob
    } finally {
        Pop-Location
    }
}

# Function to start frontend in background
function Start-Frontend {
    Write-Host "🌐 Starting Frontend..." -ForegroundColor Yellow
    Push-Location "frontend"
    try {
        $frontendJob = Start-Job -ScriptBlock {
            Set-Location $using:PWD
            npm run dev
        }
        Write-Host "✅ Frontend started (Job ID: $($frontendJob.Id))" -ForegroundColor Green
        return $frontendJob
    } finally {
        Pop-Location
    }
}

# Function to wait for port files and display URLs
function Show-URLs {
    Write-Host "`n⏳ Waiting for services to start..." -ForegroundColor Yellow
    
    $timeout = 30
    $elapsed = 0
    
    while ($elapsed -lt $timeout) {
        $backendPort = $null
        $frontendPort = $null
        
        # Check for backend port
        if (Test-Path "backend_port.txt") {
            $backendPort = Get-Content "backend_port.txt" -Raw | ForEach-Object { $_.Trim() }
        }
        
        # Check for frontend port
        if (Test-Path "frontend_port.txt") {
            $frontendPort = Get-Content "frontend_port.txt" -Raw | ForEach-Object { $_.Trim() }
        }
        
        # If both ports are available, show URLs
        if ($backendPort -and $frontendPort) {
            Write-Host "`n" + ("=" * 80) -ForegroundColor Green
            Write-Host "🎉 DEVELOPMENT SERVERS READY!" -ForegroundColor Green
            Write-Host ("=" * 80) -ForegroundColor Green
            Write-Host ""
            Write-Host "🌐 Frontend (React/Next.js):" -ForegroundColor Cyan
            Write-Host "   👉 http://localhost:$frontendPort" -ForegroundColor White
            Write-Host ""
            Write-Host "📡 Backend (FastAPI):" -ForegroundColor Magenta  
            Write-Host "   👉 http://localhost:$backendPort" -ForegroundColor White
            Write-Host "   📖 API Docs: http://localhost:$backendPort/docs" -ForegroundColor White
            Write-Host ""
            Write-Host "🔧 To stop services: Press Ctrl+C" -ForegroundColor Yellow
            Write-Host ("=" * 80) -ForegroundColor Green
            return $true
        }
        
        Start-Sleep -Seconds 1
        $elapsed++
    }
    
    Write-Warning "Timeout waiting for services to start. Check the individual terminals for errors."
    return $false
}

try {
    # Start both services
    $backendJob = Start-Backend
    Start-Sleep -Seconds 2  # Give backend a head start
    $frontendJob = Start-Frontend
    
    # Wait for URLs and display them
    $success = Show-URLs
    
    if ($success) {
        # Keep script running and monitor jobs
        Write-Host "`n📡 Monitoring services... (Press Ctrl+C to stop)" -ForegroundColor Gray
        
        while ($true) {
            # Check if jobs are still running
            $backendRunning = (Get-Job -Id $backendJob.Id).State -eq "Running"
            $frontendRunning = (Get-Job -Id $frontendJob.Id).State -eq "Running"
            
            if (-not $backendRunning) {
                Write-Warning "Backend service stopped!"
                break
            }
            
            if (-not $frontendRunning) {
                Write-Warning "Frontend service stopped!"
                break
            }
            
            Start-Sleep -Seconds 5
        }
    }
    
} catch [System.Management.Automation.PipelineStoppedException] {
    Write-Host "`n🛑 Stopping development servers..." -ForegroundColor Yellow
} finally {
    # Clean up jobs
    if ($backendJob) {
        Stop-Job -Id $backendJob.Id -PassThru | Remove-Job
    }
    if ($frontendJob) {
        Stop-Job -Id $frontendJob.Id -PassThru | Remove-Job
    }
    
    # Clean up port files
    if (Test-Path "backend_port.txt") { Remove-Item "backend_port.txt" -Force }
    if (Test-Path "frontend_port.txt") { Remove-Item "frontend_port.txt" -Force }
    
    Write-Host "👋 Development environment stopped." -ForegroundColor Gray
}
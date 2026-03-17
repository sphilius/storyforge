# ============================================================================
# StoryForge — Dev Server Launcher (Windows PowerShell)
# ============================================================================
#
# USAGE:
#   .\scripts\dev.ps1
#
# WHAT THIS DOES:
#   Starts BOTH the backend (FastAPI/uvicorn on :8000) and frontend 
#   (Vite on :5173) in parallel, in a single terminal window.
#
#   Press Ctrl+C to stop both.
#
# HOW IT WORKS:
#   Uses PowerShell background jobs to run both processes. The script
#   monitors them and streams their output, color-coded:
#     [BACKEND]  — blue
#     [FRONTEND] — green
#
# PREREQUISITES:
#   Run .\scripts\setup.ps1 first to install dependencies.
#
# ============================================================================

$ErrorActionPreference = "Stop"

# ── Navigate to project root ──────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  STORYFORGE — Starting Dev Servers" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Load .env into current session ────────────────────────────────
# This ensures the backend can read GOOGLE_API_KEY and other vars.
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        # Skip comments and empty lines
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        # Parse KEY=VALUE
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $Matches[1].Trim()
            $value = $Matches[2].Trim()
            # Set as environment variable for this session
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "  Loaded .env" -ForegroundColor Gray
} else {
    Write-Host "  WARNING: No .env file found. Run .\scripts\setup.ps1 first." -ForegroundColor Red
}

# ── Check API key ─────────────────────────────────────────────────
$apiKey = [Environment]::GetEnvironmentVariable("GOOGLE_API_KEY", "Process")
if (-Not $apiKey -or $apiKey -eq "your-api-key-here") {
    Write-Host ""
    Write-Host "  WARNING: GOOGLE_API_KEY is not set!" -ForegroundColor Red
    Write-Host "  The backend will start but ADK agents won't work." -ForegroundColor Red
    Write-Host "  Edit .env and add your key from https://aistudio.google.com/apikey" -ForegroundColor Red
    Write-Host ""
}

# ── Detect package manager ────────────────────────────────────────
$frontendCmd = "npm"
try {
    & pnpm --version 2>&1 | Out-Null
    $frontendCmd = "pnpm"
} catch { }

# ── Start Backend ─────────────────────────────────────────────────
Write-Host "  Starting backend (uvicorn :8000)..." -ForegroundColor Blue
$backendJob = Start-Job -ScriptBlock {
    param($root, $envVars)
    Set-Location $root
    
    # Re-set environment variables in the job context
    foreach ($kv in $envVars) {
        [Environment]::SetEnvironmentVariable($kv.Key, $kv.Value, "Process")
    }
    
    & "$root\.venv\Scripts\python.exe" -m uvicorn backend.app.main:app --reload --port 8000 2>&1
} -ArgumentList $ProjectRoot, @(
    # Pass environment variables to the job
    Get-ChildItem Env: | Where-Object { $_.Name -match "GOOGLE_|GEMINI_|CORS_" } | ForEach-Object {
        @{ Key = $_.Name; Value = $_.Value }
    }
)

# ── Start Frontend ────────────────────────────────────────────────
Write-Host "  Starting frontend ($frontendCmd dev :5173)..." -ForegroundColor Green

$frontendJob = Start-Job -ScriptBlock {
    param($root, $cmd)
    Set-Location "$root\frontend"
    & $cmd run dev 2>&1
} -ArgumentList $ProjectRoot, $frontendCmd

# ── Monitor both processes ────────────────────────────────────────
Write-Host ""
Write-Host "  Both servers starting..." -ForegroundColor Cyan
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor Green
Write-Host "  Backend:   http://localhost:8000" -ForegroundColor Blue
Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor Blue
Write-Host ""
Write-Host "  Press Ctrl+C to stop both servers." -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Stream output from both jobs until Ctrl+C
try {
    while ($true) {
        # Read backend output
        $backendOutput = Receive-Job -Job $backendJob -ErrorAction SilentlyContinue
        if ($backendOutput) {
            foreach ($line in $backendOutput) {
                Write-Host "[BACKEND]  $line" -ForegroundColor Blue
            }
        }

        # Read frontend output
        $frontendOutput = Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue
        if ($frontendOutput) {
            foreach ($line in $frontendOutput) {
                Write-Host "[FRONTEND] $line" -ForegroundColor Green
            }
        }

        # Check if either job has failed
        if ($backendJob.State -eq "Failed") {
            Write-Host "[BACKEND]  CRASHED — check errors above" -ForegroundColor Red
        }
        if ($frontendJob.State -eq "Failed") {
            Write-Host "[FRONTEND] CRASHED — check errors above" -ForegroundColor Red
        }

        Start-Sleep -Milliseconds 500
    }
} finally {
    # ── Cleanup on Ctrl+C ─────────────────────────────────────────
    Write-Host ""
    Write-Host "  Stopping servers..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "  Servers stopped." -ForegroundColor Green
}

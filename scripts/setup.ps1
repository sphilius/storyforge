# ============================================================================
# StoryForge — Dev Environment Setup (Windows PowerShell)
# ============================================================================
# 
# USAGE:
#   .\scripts\setup.ps1
#
# WHAT THIS DOES:
#   1. Checks that Python 3.12+ and Node 20+ are installed
#   2. Checks for pnpm (preferred) or npm
#   3. Creates a Python virtual environment in .venv/
#   4. Installs backend Python dependencies
#   5. Installs frontend Node dependencies
#   6. Creates .env from .env.example if missing
#   7. Prints a summary of what's ready and what needs manual action
#
# AFTER RUNNING THIS:
#   .\scripts\dev.ps1    — starts both backend and frontend
#
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  STORYFORGE — Dev Environment Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Navigate to project root ──────────────────────────────────────
# This script lives in scripts/, so go up one level to project root.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot
Write-Host "[1/7] Project root: $ProjectRoot" -ForegroundColor Gray

# ── Check Python ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/7] Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = & python --version 2>&1
    Write-Host "  Found: $pythonVersion" -ForegroundColor Green
    
    # Extract version number and check >= 3.12
    $versionMatch = [regex]::Match($pythonVersion, '(\d+)\.(\d+)')
    $major = [int]$versionMatch.Groups[1].Value
    $minor = [int]$versionMatch.Groups[2].Value
    
    if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 12)) {
        Write-Host "  WARNING: Python 3.12+ recommended. You have $major.$minor" -ForegroundColor Red
        Write-Host "  Download from: https://www.python.org/downloads/" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERROR: Python not found!" -ForegroundColor Red
    Write-Host "  Install Python 3.12+ from https://www.python.org/downloads/" -ForegroundColor Red
    Write-Host "  Make sure 'Add to PATH' is checked during installation." -ForegroundColor Red
    exit 1
}

# ── Check Node.js ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/7] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = & node --version 2>&1
    Write-Host "  Found: Node $nodeVersion" -ForegroundColor Green
    
    $nodeMatch = [regex]::Match($nodeVersion, 'v(\d+)')
    $nodeMajor = [int]$nodeMatch.Groups[1].Value
    
    if ($nodeMajor -lt 20) {
        Write-Host "  WARNING: Node 20+ recommended. You have v$nodeMajor" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERROR: Node.js not found!" -ForegroundColor Red
    Write-Host "  Install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# ── Check pnpm or npm ─────────────────────────────────────────────
Write-Host ""
Write-Host "[4/7] Checking package manager..." -ForegroundColor Yellow
$usePnpm = $false
try {
    $pnpmVersion = & pnpm --version 2>&1
    Write-Host "  Found: pnpm $pnpmVersion (preferred)" -ForegroundColor Green
    $usePnpm = $true
} catch {
    Write-Host "  pnpm not found, checking npm..." -ForegroundColor Gray
    try {
        $npmVersion = & npm --version 2>&1
        Write-Host "  Found: npm $npmVersion" -ForegroundColor Green
        Write-Host "  TIP: Install pnpm for faster installs: npm install -g pnpm" -ForegroundColor Gray
    } catch {
        Write-Host "  ERROR: Neither pnpm nor npm found!" -ForegroundColor Red
        exit 1
    }
}

# ── Create Python venv + install backend deps ─────────────────────
Write-Host ""
Write-Host "[5/7] Setting up Python backend..." -ForegroundColor Yellow

if (-Not (Test-Path ".venv")) {
    Write-Host "  Creating virtual environment..." -ForegroundColor Gray
    & python -m venv .venv
    Write-Host "  Created .venv/" -ForegroundColor Green
} else {
    Write-Host "  .venv/ already exists" -ForegroundColor Green
}

# Activate and install
Write-Host "  Installing backend dependencies..." -ForegroundColor Gray
& .venv\Scripts\python.exe -m pip install --upgrade pip --quiet
& .venv\Scripts\pip.exe install -r backend\requirements.txt --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Some backend dependencies may have failed" -ForegroundColor Red
    Write-Host "  Try manually: .venv\Scripts\Activate.ps1 && pip install -r backend\requirements.txt" -ForegroundColor Red
}

# ── Install frontend deps ─────────────────────────────────────────
Write-Host ""
Write-Host "[6/7] Setting up frontend..." -ForegroundColor Yellow

Push-Location frontend
if ($usePnpm) {
    Write-Host "  Running pnpm install..." -ForegroundColor Gray
    & pnpm install --silent 2>$null
} else {
    Write-Host "  Running npm install..." -ForegroundColor Gray
    & npm install --silent 2>$null
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Frontend install had issues. Check output above." -ForegroundColor Red
}
Pop-Location

# ── Create .env if missing ────────────────────────────────────────
Write-Host ""
Write-Host "[7/7] Checking .env..." -ForegroundColor Yellow

if (-Not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "  Created .env from .env.example" -ForegroundColor Green
        Write-Host "  ACTION NEEDED: Edit .env and add your GOOGLE_API_KEY" -ForegroundColor Red
    } else {
        # Create a minimal .env
        @"
# StoryForge Environment Variables
# Get your key from: https://aistudio.google.com/apikey
GOOGLE_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-3.1-flash-lite-preview
"@ | Out-File -FilePath ".env" -Encoding utf8
        Write-Host "  Created .env (minimal template)" -ForegroundColor Green
        Write-Host "  ACTION NEEDED: Edit .env and add your GOOGLE_API_KEY" -ForegroundColor Red
    }
} else {
    Write-Host "  .env already exists" -ForegroundColor Green
    
    # Check if API key is set
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "your-api-key-here" -or $envContent -match "GOOGLE_API_KEY=$") {
        Write-Host "  WARNING: GOOGLE_API_KEY appears unset in .env" -ForegroundColor Red
    }
}

# ── Summary ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SETUP COMPLETE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To start developing:" -ForegroundColor White
Write-Host "    .\scripts\dev.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Or start manually:" -ForegroundColor White
Write-Host "    Terminal 1:  .venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "                 uvicorn backend.app.main:app --reload --port 8000" -ForegroundColor Gray
Write-Host "    Terminal 2:  cd frontend && pnpm dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Useful URLs (after starting):" -ForegroundColor White
Write-Host "    Frontend:    http://localhost:5173" -ForegroundColor Gray
Write-Host "    Backend:     http://localhost:8000" -ForegroundColor Gray
Write-Host "    API Docs:    http://localhost:8000/docs" -ForegroundColor Gray
Write-Host "    Health:      http://localhost:8000/health" -ForegroundColor Gray
Write-Host ""

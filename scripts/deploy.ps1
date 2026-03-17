# ============================================================================
# StoryForge — Deploy to Google Cloud Run (Windows PowerShell)
# ============================================================================
#
# USAGE:
#   .\scripts\deploy.ps1
#   .\scripts\deploy.ps1 -ProjectId "my-project" -Region "us-east1"
#
# WHAT THIS DOES:
#   1. Loads GOOGLE_API_KEY from .env
#   2. Submits Docker build to Google Cloud Build (no local Docker needed)
#   3. Deploys the built image to Cloud Run
#   4. Prints the live service URL
#
# PREREQUISITES:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - GCP project with Cloud Run + Cloud Build APIs enabled
#   - GOOGLE_API_KEY set in .env
#
# ============================================================================

param(
    [string]$ProjectId = "gemini-live-agent-488820",
    [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"

# ── Navigate to project root ──────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

# ── Load .env ─────────────────────────────────────────────────────
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $Matches[1].Trim()
            $value = $Matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$ApiKey = $env:GOOGLE_API_KEY
if (-Not $ApiKey -or $ApiKey -eq "your-api-key-here") {
    Write-Host "ERROR: GOOGLE_API_KEY not set. Edit .env first." -ForegroundColor Red
    exit 1
}

$Image = "gcr.io/$ProjectId/director-mode"
$ServiceName = "director-mode"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  STORYFORGE — Deploying to Cloud Run" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Project:  $ProjectId" -ForegroundColor Gray
Write-Host "  Region:   $Region" -ForegroundColor Gray
Write-Host "  Image:    ${Image}:latest" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Build in the cloud ────────────────────────────────────
Write-Host "[1/2] Building Docker image via Cloud Build..." -ForegroundColor Yellow
& gcloud builds submit --tag "${Image}:latest" --project $ProjectId .

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cloud Build failed. Check output above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/2] Deploying to Cloud Run..." -ForegroundColor Yellow
& gcloud run deploy $ServiceName `
    --image "${Image}:latest" `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --set-env-vars "GOOGLE_API_KEY=$ApiKey" `
    --memory 1Gi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 10 `
    --port 8080 `
    --timeout 300 `
    --project $ProjectId

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cloud Run deploy failed. Check output above." -ForegroundColor Red
    exit 1
}

# ── Print results ─────────────────────────────────────────────────
$ServiceUrl = & gcloud run services describe $ServiceName `
    --region $Region `
    --project $ProjectId `
    --format "value(status.url)" 2>$null

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  URL:      $ServiceUrl" -ForegroundColor White
Write-Host "  Health:   $ServiceUrl/health" -ForegroundColor Gray
Write-Host "  API Docs: $ServiceUrl/docs" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

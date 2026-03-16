#!/usr/bin/env bash
# ===========================================================================
# Director Mode — Cloud Run Deployment Script
# ===========================================================================
#
# WHAT THIS DOES:
#   1. Builds a Docker image containing both frontend + backend
#   2. Pushes it to Google Container Registry (GCR)
#   3. Deploys it to Cloud Run as a managed service
#
# USAGE:
#   ./deploy.sh [project-id] [region]
#
# EXAMPLES:
#   ./deploy.sh gemini-live-agent-488820 us-central1
#   ./deploy.sh                           # Uses defaults
#
# PREREQUISITES:
#   - gcloud CLI installed and authenticated
#   - Docker installed and running
#   - GOOGLE_API_KEY (or GEMINI_API_KEY) environment variable set
#   - Google Cloud project with Cloud Run API enabled
#
# WHAT JUDGES SEE:
#   This script IS your IaC (Infrastructure as Code) bonus point.
#   Having a working deploy.sh in your public repo demonstrates
#   reproducible deployment. Make sure it's committed to GitHub.
#
# ===========================================================================

set -euo pipefail  # Exit on any error, undefined vars, or pipe failures

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
# If no arguments provided, use these defaults.
# Replace with your actual GCP project ID.
PROJECT_ID="${1:-gemini-live-agent-488820}"
REGION="${2:-us-central1}"
IMAGE="gcr.io/${PROJECT_ID}/director-mode"
SERVICE_NAME="director-mode"

# Get the API key from environment (check both variable names)
API_KEY="${GOOGLE_API_KEY:-${GEMINI_API_KEY:-}}"

if [ -z "$API_KEY" ]; then
    echo "ERROR: Neither GOOGLE_API_KEY nor GEMINI_API_KEY is set."
    echo "Set one of them before running this script:"
    echo "  export GOOGLE_API_KEY=your-key-here"
    exit 1
fi

echo "============================================================"
echo "  DIRECTOR MODE — Deploying to Cloud Run"
echo "============================================================"
echo "  Project:  ${PROJECT_ID}"
echo "  Region:   ${REGION}"
echo "  Service:  ${SERVICE_NAME}"
echo "  Image:    ${IMAGE}:latest"
echo "============================================================"

# ---------------------------------------------------------------------------
# Step 1: Build the Docker image
# ---------------------------------------------------------------------------
# This runs both stages of the Dockerfile:
#   Stage 1: Builds the React frontend (npm install + npm run build)
#   Stage 2: Sets up Python backend with ADK dependencies
echo ""
echo "==> [1/3] Building Docker image..."
docker build -t "${IMAGE}:latest" .

# ---------------------------------------------------------------------------
# Step 2: Push to Google Container Registry
# ---------------------------------------------------------------------------
# GCR stores your Docker images so Cloud Run can pull them.
# The image URL format is: gcr.io/PROJECT_ID/IMAGE_NAME
echo ""
echo "==> [2/3] Pushing to Container Registry..."
docker push "${IMAGE}:latest"

# ---------------------------------------------------------------------------
# Step 3: Deploy to Cloud Run
# ---------------------------------------------------------------------------
# Key flags explained:
#   --image: The Docker image to deploy
#   --region: Which Google Cloud region to deploy in
#   --platform managed: Use Cloud Run's fully managed platform
#   --allow-unauthenticated: Make the service publicly accessible
#     (required for the demo — judges need to access it)
#   --set-env-vars: Set environment variables in the container
#     GOOGLE_API_KEY: Used by ADK to authenticate with Gemini
#   --memory 1Gi: More memory than default (ADK + Gemini needs it)
#   --cpu 1: One vCPU (sufficient for demo workloads)
#   --min-instances 0: Scale to zero when idle (saves money)
#   --max-instances 10: Allow up to 10 instances under load
#   --port 8080: The port uvicorn listens on inside the container
#   --timeout 300: Allow up to 5 minutes per request (Gemini can be slow)
echo ""
echo "==> [3/3] Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE}:latest" \
    --region "${REGION}" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "GOOGLE_API_KEY=${API_KEY}" \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --port 8080 \
    --timeout 300

# ---------------------------------------------------------------------------
# Done — Print the service URL
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  DEPLOYMENT COMPLETE"
echo "============================================================"
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region "${REGION}" \
    --format "value(status.url)")
echo "  Service URL: ${SERVICE_URL}"
echo ""
echo "  Health check: ${SERVICE_URL}/health"
echo "  API docs:     ${SERVICE_URL}/docs"
echo "  Director API: ${SERVICE_URL}/api/direct"
echo "  Search API:   ${SERVICE_URL}/api/ground"
echo ""
echo "  Test it:"
echo "    curl -X POST ${SERVICE_URL}/api/direct \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"prompt\": \"Scene one. Tokyo alley at midnight.\"}'"
echo "============================================================"

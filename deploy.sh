#!/usr/bin/env bash
# deploy.sh — Deploy Director Mode to Google Cloud Run
# Usage: ./deploy.sh [PROJECT_ID] [REGION]
# Bonus: This script counts as IaC for hackathon bonus points

set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project)}"
REGION="${2:-us-central1}"
SERVICE_NAME="director-mode"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🎬 Director Mode — Cloud Run Deployment"
echo "   Project: ${PROJECT_ID}"
echo "   Region:  ${REGION}"
echo "   Image:   ${IMAGE}"
echo ""

# Build container image
echo "📦 Building container..."
gcloud builds submit \
  --project="${PROJECT_ID}" \
  --tag="${IMAGE}" \
  --timeout=600 \
  .

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --image="${IMAGE}" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --timeout=300

# Get URL
URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format="value(status.url)")

echo ""
echo "✅ Deployed successfully!"
echo "🌐 URL: ${URL}"
echo ""
echo "📹 For demo video, show:"
echo "   1. gcloud run services describe ${SERVICE_NAME} --region=${REGION}"
echo "   2. gcloud logging read 'resource.type=\"cloud_run_revision\"' --limit=10"

#!/usr/bin/env bash
# ===========================================================================
# Director Mode — Quick Backend Test
# ===========================================================================
# Run this AFTER starting the backend with:
#   uvicorn backend.app.main:app --reload --port 8000
#
# Tests each endpoint to verify the ADK integration is working.
# ===========================================================================

BASE_URL="${1:-http://localhost:8000}"

echo "Testing Director Mode Backend at ${BASE_URL}"
echo "=============================================="

# Test 1: Health check
echo ""
echo "[1] Health check..."
curl -s "${BASE_URL}/health" | python3 -m json.tool
echo ""

# Test 2: Legacy ping
echo "[2] Director ping..."
curl -s "${BASE_URL}/director/ping" | python3 -m json.tool
echo ""

# Test 3: Director Agent — scene description
echo "[3] Director Agent — scene direction..."
curl -s -X POST "${BASE_URL}/api/direct" \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Scene one. A rain-soaked Tokyo alley at midnight. Neon signs reflected in puddles.", "session_id": "test-1"}' \
    | python3 -m json.tool
echo ""

# Test 4: Director Agent — character introduction
echo "[4] Director Agent — character intro..."
curl -s -X POST "${BASE_URL}/api/direct" \
    -H "Content-Type: application/json" \
    -d '{"prompt": "A woman in a red coat walks toward camera. She is Detective Yuki Tanaka, mid-30s, sharp eyes, carrying a case file.", "session_id": "test-1"}' \
    | python3 -m json.tool
echo ""

# Test 5: Search Agent — grounding
echo "[5] Search Agent — Google Search grounding..."
curl -s -X POST "${BASE_URL}/api/ground" \
    -H "Content-Type: application/json" \
    -d '{"query": "What are the visual conventions of film noir cinematography?"}' \
    | python3 -m json.tool
echo ""

# Test 6: Session info
echo "[6] Session info..."
curl -s "${BASE_URL}/api/session/test-1" | python3 -m json.tool
echo ""

echo "=============================================="
echo "All tests complete. Check responses above."
echo "If Director/Search tests show errors, verify GOOGLE_API_KEY is set."

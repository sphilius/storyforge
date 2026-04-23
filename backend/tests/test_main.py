import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from backend.app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "director-mode",
        "version": "1.0.0",
        "agents": ["director_agent", "search_agent"],
    }

def test_direct_endpoint_error_handling():
    with patch("backend.app.main.run_agent") as mock_run_agent:
        mock_run_agent.side_effect = Exception("Simulated Director Agent error")

        response = client.post(
            "/api/direct",
            json={"session_id": "test-session", "prompt": "Test prompt"}
        )

        assert response.status_code == 500
        assert response.json() == {"detail": "Director Agent error: Simulated Director Agent error"}

def test_ground_endpoint_error_handling():
    with patch("backend.app.main.run_agent") as mock_run_agent:
        mock_run_agent.side_effect = Exception("Simulated Search Agent error")

        response = client.post(
            "/api/ground",
            json={"session_id": "test-session", "query": "Test query"}
        )

        assert response.status_code == 500
        assert response.json() == {"detail": "Search Agent error: Simulated Search Agent error"}

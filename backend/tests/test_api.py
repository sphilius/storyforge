import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_ground_success(monkeypatch):
    from backend.app.main import run_agent

    async def mock_run_agent(*args, **kwargs):
        return {
            "response_text": "Here is the grounded answer.",
            "trace": ["Search action 1", "Search action 2"]
        }

    monkeypatch.setattr("backend.app.main.run_agent", mock_run_agent)

    response = client.post(
        "/api/ground",
        json={"query": "test query", "session_id": "test_session"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["response_text"] == "Here is the grounded answer."
    assert data["grounded"] is True
    assert data["trace"] == ["Search action 1", "Search action 2"]

def test_ground_error_handling(monkeypatch):
    from backend.app.main import run_agent

    async def mock_run_agent(*args, **kwargs):
        raise Exception("Mock error")

    monkeypatch.setattr("backend.app.main.run_agent", mock_run_agent)

    response = client.post("/api/ground", json={"query": "test query", "session_id": "test_session"})
    assert response.status_code == 500
    assert response.json() == {"detail": "Search Agent error: Mock error"}

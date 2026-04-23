import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_reset_session_success():
    with patch("backend.app.main.session_service.delete_session", new_callable=AsyncMock) as mock_delete:
        response = client.post("/api/session/test-session/reset")
        assert response.status_code == 200
        assert response.json() == {"status": "reset", "session_id": "test-session"}
        mock_delete.assert_called_once()

def test_reset_session_error():
    with patch("backend.app.main.session_service.delete_session", new_callable=AsyncMock) as mock_delete:
        mock_delete.side_effect = Exception("Session not found")
        response = client.post("/api/session/test-session/reset")
        assert response.status_code == 200
        assert response.json() == {"status": "reset", "session_id": "test-session"}
        mock_delete.assert_called_once()

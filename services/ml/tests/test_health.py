"""Tests for the ML service health endpoint."""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.anyio
async def test_health_endpoint():
    """Health endpoint should return 200 with model_ready false before training."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["model_ready"] is False  # No model artifact trained yet
    assert data["model_version"] is None
    assert "service_version" in data

"""Tests for the ML service health endpoint."""

import pytest
from httpx import AsyncClient, ASGITransport

from app.category_model import category_model
from app.main import app


@pytest.mark.anyio
async def test_health_reports_model_unready_without_loaded_artifact(monkeypatch):
    """An untrained service reports model_ready false."""
    monkeypatch.setattr(category_model, "_pipeline", None)
    monkeypatch.setattr(category_model, "_model_version", None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["model_ready"] is False
    assert data["model_version"] is None
    assert "service_version" in data


@pytest.mark.anyio
async def test_category_prediction_response_shape(monkeypatch):
    monkeypatch.setattr(
        category_model,
        "predict",
        lambda _description: ("road_damage", 0.81, False),
    )
    monkeypatch.setattr(category_model, "_model_version", "test-model-v1")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/predict-category",
            json={"description": "A pothole is blocking the road near the school"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "suggestedCategory": "road_damage",
        "confidence": 0.81,
        "modelVersion": "test-model-v1",
        "needsHumanReview": False,
    }


@pytest.mark.anyio
async def test_predict_category_no_model():
    """Prediction should return null suggestion when model is not loaded."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/predict-category",
            json={"description": "A large pothole on Main Street"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["suggestedCategory"] is None
    assert data["needsHumanReview"] is True
    assert data["confidence"] == 0.0


@pytest.mark.anyio
async def test_predict_category_empty_description():
    """Empty description should return 422 validation error."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/predict-category",
            json={"description": ""},
        )

    assert response.status_code == 422


@pytest.mark.anyio
async def test_predict_category_rejects_whitespace_and_extra_fields():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        blank_response = await client.post(
            "/predict-category",
            json={"description": "   "},
        )
        extra_field_response = await client.post(
            "/predict-category",
            json={"description": "A valid issue description", "role": "admin"},
        )

    assert blank_response.status_code == 422
    assert extra_field_response.status_code == 422

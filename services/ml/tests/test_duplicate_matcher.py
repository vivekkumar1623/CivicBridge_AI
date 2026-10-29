"""Tests for nearby duplicate scoring and request validation."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.duplicate_matcher import score_duplicates
from app.main import app


def test_score_duplicates_ranks_text_and_compares_selected_category():
    scored = score_duplicates(
        "A large pothole blocks the road near the school entrance",
        "road_damage",
        [
            {
                "id": "matching",
                "description": "A large pothole blocks the road near the school entrance.",
                "category": "road_damage",
                "distanceMeters": 40,
            },
            {
                "id": "unrelated",
                "description": "Streetlight is not working beside the bus shelter.",
                "category": "streetlight",
                "distanceMeters": 80,
            },
        ],
    )

    assert [candidate["id"] for candidate in scored] == ["matching", "unrelated"]
    assert scored[0]["textSimilarity"] > scored[1]["textSimilarity"]
    assert scored[0]["sameCategory"] is True
    assert scored[1]["sameCategory"] is False


def test_score_duplicates_handles_text_without_analyzable_tokens():
    scored = score_duplicates(
        "is a the and",
        "other",
        [
            {
                "id": "stop-words",
                "description": "is a the and",
                "category": "other",
                "distanceMeters": 5,
            }
        ],
    )

    assert scored == [
        {
            "id": "stop-words",
            "textSimilarity": 0.0,
            "distanceMeters": 5,
            "sameCategory": True,
        }
    ]


@pytest.mark.anyio
async def test_score_duplicates_endpoint_response_shape():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/score-duplicates",
            json={
                "newDescription": "A pothole blocks the road near the school entrance.",
                "newCategory": "road_damage",
                "candidates": [
                    {
                        "id": "candidate-1",
                        "description": "A pothole blocks the road near the school entrance.",
                        "category": "road_damage",
                        "distanceMeters": 40,
                    }
                ],
            },
        )

    assert response.status_code == 200
    assert response.json() == {
        "scoredCandidates": [
            {
                "id": "candidate-1",
                "textSimilarity": 1.0,
                "distanceMeters": 40.0,
                "sameCategory": True,
            }
        ]
    }


@pytest.mark.anyio
async def test_score_duplicates_endpoint_rejects_invalid_candidate_data():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/score-duplicates",
            json={
                "newDescription": "A pothole blocks the road near the school entrance.",
                "newCategory": "road_damage",
                "candidates": [
                    {
                        "id": "candidate-1",
                        "description": "A pothole blocks the road near the school entrance.",
                        "category": "road_damage",
                        "distanceMeters": 501,
                    }
                ],
            },
        )

    assert response.status_code == 422

"""CivicBridge AI ML Service — FastAPI application.

Provides:
- GET /health — service and model readiness status
- POST /predict-category — category prediction for report descriptions
- POST /score-duplicates — text similarity scoring for duplicate detection

This service is stateless at request time and does not access MongoDB or store
user identity. It receives input from the Express backend only.
"""

from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager

from .config import SERVICE_VERSION
from .schemas import (
    HealthResponse,
    CategoryPredictionRequest,
    CategoryPredictionResponse,
    DuplicateScoreRequest,
    DuplicateScoreResponse,
    ScoredCandidate,
)
from .category_model import category_model
from .duplicate_matcher import score_duplicates


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: attempt to load the model. Graceful if it doesn't exist yet."""
    loaded = category_model.load()
    if loaded:
        print(f"[ML] Category model loaded: version={category_model.model_version}")
    else:
        print("[ML] Category model not found. Service will run without predictions.")
        print("[ML] Train the model first — see training/train_category_model.py")
    yield


app = FastAPI(
    title="CivicBridge AI ML Service",
    version=SERVICE_VERSION,
    docs_url="/docs",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.
    Reports model readiness honestly — model_ready is false before training.
    """
    return HealthResponse(
        status="ok",
        model_ready=category_model.is_ready,
        model_version=category_model.model_version,
        service_version=SERVICE_VERSION,
    )


@app.post("/predict-category", response_model=CategoryPredictionResponse)
async def predict_category(request: CategoryPredictionRequest):
    """
    Predict the category for a report description.
    Returns null suggestion with needsHumanReview=true if model is not ready
    or confidence is below threshold.
    """
    description = request.description.strip()
    if not description:
        raise HTTPException(status_code=422, detail="Description must not be empty")

    suggested, confidence, needs_review = category_model.predict(description)

    return CategoryPredictionResponse(
        suggestedCategory=suggested,
        confidence=round(confidence, 4),
        modelVersion=category_model.model_version,
        needsHumanReview=needs_review,
    )


@app.post("/score-duplicates", response_model=DuplicateScoreResponse)
async def score_duplicates_endpoint(request: DuplicateScoreRequest):
    """
    Score candidate reports for text similarity with a new description.
    Returns at most 5 candidates sorted by similarity descending.
    """
    new_desc = request.newDescription.strip()
    if not new_desc:
        raise HTTPException(status_code=422, detail="Description must not be empty")

    candidates = [
        {
            "id": c.id,
            "description": c.description,
            "category": c.category,
            "distanceMeters": c.distanceMeters,
        }
        for c in request.candidates
    ]

    scored = score_duplicates(new_desc, request.newCategory, candidates)

    return DuplicateScoreResponse(
        scoredCandidates=[
            ScoredCandidate(
                id=s["id"],
                textSimilarity=s["textSimilarity"],
                distanceMeters=s["distanceMeters"],
                sameCategory=s["sameCategory"],
            )
            for s in scored
        ]
    )

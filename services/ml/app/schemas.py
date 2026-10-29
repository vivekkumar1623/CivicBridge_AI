"""Pydantic schemas for ML service request/response validation."""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Category = Literal[
    "road_damage",
    "waste_management",
    "streetlight",
    "water_drainage",
    "public_property",
    "other",
]


class HealthResponse(BaseModel):
    """Health check response."""

    model_config = ConfigDict(extra="forbid")

    status: str
    model_ready: bool
    model_version: Optional[str] = None
    service_version: str


class CategoryPredictionRequest(BaseModel):
    """Request body for category prediction."""

    model_config = ConfigDict(extra="forbid")

    description: str = Field(..., min_length=1, max_length=5000)


class CategoryPredictionResponse(BaseModel):
    """Response body for category prediction."""

    model_config = ConfigDict(extra="forbid")

    suggestedCategory: Optional[Category] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    modelVersion: Optional[str] = None
    needsHumanReview: bool = True


class DuplicateCandidate(BaseModel):
    """A single candidate report for duplicate scoring."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=2000)
    category: Optional[Category] = None
    distanceMeters: Optional[float] = Field(default=None, ge=0, le=500)


class DuplicateScoreRequest(BaseModel):
    """Request body for duplicate scoring."""

    model_config = ConfigDict(extra="forbid")

    newDescription: str = Field(..., min_length=20, max_length=2000)
    newCategory: Category
    candidates: list[DuplicateCandidate] = Field(..., max_length=50)


class ScoredCandidate(BaseModel):
    """A scored candidate in the duplicate response."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    textSimilarity: float = Field(..., ge=0, le=1)
    distanceMeters: Optional[float] = Field(default=None, ge=0, le=500)
    sameCategory: bool = False


class DuplicateScoreResponse(BaseModel):
    """Response body for duplicate scoring."""
    model_config = ConfigDict(extra="forbid")

    scoredCandidates: list[ScoredCandidate] = Field(..., max_length=5)


class ErrorResponse(BaseModel):
    """Error response."""
    detail: str

"""Configuration for the ML service."""

import os
from pathlib import Path

# Base directory of the ML service
BASE_DIR = Path(__file__).resolve().parent.parent

# Model artifact path
MODEL_DIR = BASE_DIR / "models"
CATEGORY_MODEL_PATH = MODEL_DIR / "category_classifier.joblib"

# Confidence threshold — below this, return null suggestion with needsHumanReview=true
# This is a conservative product behavior threshold, not a calibrated certainty claim
CONFIDENCE_THRESHOLD = float(os.getenv("ML_CONFIDENCE_THRESHOLD", "0.55"))

# Valid categories (exact enum values from the playbook)
VALID_CATEGORIES = [
    "road_damage",
    "waste_management",
    "streetlight",
    "water_drainage",
    "public_property",
    "other",
]

# Service version
SERVICE_VERSION = "0.1.0"

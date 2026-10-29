"""Category classification model loader and predictor.

The model is a scikit-learn pipeline (TfidfVectorizer + LogisticRegression)
persisted with joblib. This module handles loading, readiness checks, and prediction.
It does NOT train the model — see training/train_category_model.py for that.
"""

import logging
import math
import joblib
from pathlib import Path
from typing import Any, Optional, Tuple

from .config import CATEGORY_MODEL_PATH, CONFIDENCE_THRESHOLD, VALID_CATEGORIES

logger = logging.getLogger(__name__)


class CategoryModel:
    """Manages the category classification model lifecycle."""

    def __init__(
        self,
        model_path: Path = CATEGORY_MODEL_PATH,
        confidence_threshold: float = CONFIDENCE_THRESHOLD,
    ) -> None:
        self._pipeline: Any = None
        self._model_version: Optional[str] = None
        self._model_path = model_path
        self._confidence_threshold = confidence_threshold

    @property
    def is_ready(self) -> bool:
        return self._pipeline is not None

    @property
    def model_version(self) -> Optional[str]:
        return self._model_version

    def load(self) -> bool:
        """Load the model artifact from disk. Returns True if successful."""
        self._pipeline = None
        self._model_version = None
        if not self._model_path.exists():
            return False

        try:
            artifact = joblib.load(self._model_path)
            if not isinstance(artifact, dict):
                raise ValueError("Expected a model artifact object.")

            pipeline = artifact.get("pipeline")
            version = artifact.get("version")
            classes = getattr(pipeline, "classes_", None)
            if (
                not callable(getattr(pipeline, "predict_proba", None))
                or not isinstance(version, str)
                or not version.strip()
                or classes is None
                or set(classes) != set(VALID_CATEGORIES)
            ):
                raise ValueError("Model artifact is missing a compatible pipeline or metadata.")

            self._pipeline = pipeline
            self._model_version = version
            return True
        except Exception:
            logger.exception("Failed to load category model artifact at %s", self._model_path)
            return False

    def predict(self, description: str) -> Tuple[Optional[str], float, bool]:
        """
        Predict the category for a description.

        Returns:
            (suggestedCategory, confidence, needsHumanReview)
            - suggestedCategory is None if model is not ready or confidence is below threshold
            - confidence is 0.0 if model is not ready
            - needsHumanReview is True if confidence is below threshold or model is not ready
        """
        if not self.is_ready or self._pipeline is None:
            return None, 0.0, True

        try:
            probabilities = self._pipeline.predict_proba([description])[0]
            max_prob = float(probabilities.max())
            predicted_idx = probabilities.argmax()
            predicted_category = self._pipeline.classes_[predicted_idx]

            if (
                not math.isfinite(max_prob)
                or not 0 <= max_prob <= 1
                or predicted_category not in VALID_CATEGORIES
            ):
                return None, 0.0, True

            if max_prob < self._confidence_threshold:
                return None, max_prob, True

            return predicted_category, max_prob, False
        except Exception:
            logger.exception("Category model inference failed")
            return None, 0.0, True


# Singleton instance
category_model = CategoryModel()

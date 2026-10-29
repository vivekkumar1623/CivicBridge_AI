"""Tests for category model artifact lifecycle and confidence fallback."""

import joblib
import numpy as np
from pathlib import Path

from app.category_model import CategoryModel
from app.config import VALID_CATEGORIES


class FakePipeline:
    def __init__(
        self,
        probabilities: list[float],
        categories: list[str] | None = None,
    ) -> None:
        self.classes_ = np.array(categories or VALID_CATEGORIES)
        self.probabilities = np.array(probabilities)

    def predict_proba(self, _descriptions: list[str]) -> np.ndarray:
        return np.array([self.probabilities])


def write_artifact(path: Path, probabilities: list[float] | None = None) -> None:
    joblib.dump(
        {
            "pipeline": FakePipeline(
                probabilities
                or [0.05, 0.05, 0.8, 0.03, 0.04, 0.03]
            ),
            "version": "test-model-v1",
        },
        path,
    )


def test_missing_artifact_is_not_ready(tmp_path: Path) -> None:
    model = CategoryModel(tmp_path / "missing.joblib")

    assert model.load() is False
    assert model.is_ready is False
    assert model.model_version is None
    assert model.predict("A streetlight is out near the park") == (None, 0.0, True)


def test_loads_model_artifact_and_predicts_fixed_category(tmp_path: Path) -> None:
    artifact_path = tmp_path / "category.joblib"
    write_artifact(artifact_path)
    model = CategoryModel(artifact_path)

    assert model.load() is True
    assert model.is_ready is True
    assert model.model_version == "test-model-v1"
    assert model.predict("A streetlight is out near the park") == (
        "streetlight",
        0.8,
        False,
    )


def test_low_confidence_abstains_and_requests_human_review(tmp_path: Path) -> None:
    artifact_path = tmp_path / "category.joblib"
    write_artifact(artifact_path, [0.25, 0.2, 0.18, 0.15, 0.12, 0.1])
    model = CategoryModel(artifact_path, confidence_threshold=0.55)

    assert model.load() is True
    assert model.predict("There is a problem near the public space") == (
        None,
        0.25,
        True,
    )


def test_invalid_artifact_does_not_leave_stale_model_ready(tmp_path: Path) -> None:
    artifact_path = tmp_path / "category.joblib"
    write_artifact(artifact_path)
    model = CategoryModel(artifact_path)

    assert model.load() is True
    artifact_path.write_bytes(b"not a joblib artifact")

    assert model.load() is False
    assert model.is_ready is False
    assert model.model_version is None


def test_artifact_with_incomplete_category_classes_is_rejected(tmp_path: Path) -> None:
    artifact_path = tmp_path / "category.joblib"
    artifact = {
        "pipeline": FakePipeline(
            [0.2, 0.2, 0.2, 0.2, 0.2],
            categories=VALID_CATEGORIES[:-1],
        ),
        "version": "test-model-v1",
    }
    joblib.dump(artifact, artifact_path)
    model = CategoryModel(artifact_path)

    assert model.load() is False
    assert model.is_ready is False

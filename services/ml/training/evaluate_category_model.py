"""Evaluate a persisted model on the fixed, held-out test split."""

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.pipeline import Pipeline

from app.config import CATEGORY_MODEL_PATH, CONFIDENCE_THRESHOLD, VALID_CATEGORIES
from training.data_utils import DATA_PATH, load_dataset, split_dataset


def build_evaluation(
    pipeline: Pipeline,
    train_labels,
    test_texts,
    test_labels,
    validation_sample_count: int,
) -> dict[str, Any]:
    predictions = pipeline.predict(test_texts)
    probabilities = pipeline.predict_proba(test_texts)
    confidence = probabilities.max(axis=1)
    accepted = confidence >= CONFIDENCE_THRESHOLD
    labels = list(VALID_CATEGORIES)
    majority_label = train_labels.value_counts().sort_values(ascending=False).index[0]
    majority_predictions = np.full(len(test_labels), majority_label)

    return {
        "sample_counts": {
            "validation": int(validation_sample_count),
            "test": int(len(test_labels)),
            "test_per_category": {
                label: int((test_labels == label).sum()) for label in labels
            },
        },
        "majority_class_baseline": {
            "category": majority_label,
            "macro_f1": float(
                f1_score(
                    test_labels,
                    majority_predictions,
                    labels=labels,
                    average="macro",
                    zero_division=0,
                )
            ),
        },
        "confidence_fallback_threshold": CONFIDENCE_THRESHOLD,
        "confidence_fallback_effect": {
            "suggestions_returned": int(accepted.sum()),
            "suggestions_abstained": int((~accepted).sum()),
            "coverage": float(accepted.mean()) if len(accepted) else 0.0,
            "macro_f1_when_suggestion_returned": (
                float(
                    f1_score(
                        test_labels.iloc[accepted],
                        predictions[accepted],
                        labels=labels,
                        average="macro",
                        zero_division=0,
                    )
                )
                if accepted.any()
                else None
            ),
        },
        "model": {
            "macro_f1": float(
                f1_score(
                    test_labels,
                    predictions,
                    labels=labels,
                    average="macro",
                    zero_division=0,
                )
            ),
            "per_class": classification_report(
                test_labels,
                predictions,
                labels=labels,
                output_dict=True,
                zero_division=0,
            ),
            "confusion_matrix": confusion_matrix(
                test_labels,
                predictions,
                labels=labels,
            ).tolist(),
            "confusion_matrix_labels": labels,
        },
    }


def evaluate(
    model_path: Path = CATEGORY_MODEL_PATH, data_path: Path = DATA_PATH
) -> dict[str, Any]:
    if not model_path.is_file():
        raise FileNotFoundError(
            f"Model artifact not found at {model_path}. "
            "Train it with `python -m training.train_category_model` first."
        )

    artifact = joblib.load(model_path)
    if not isinstance(artifact, dict) or "pipeline" not in artifact:
        raise ValueError("Model artifact has an unsupported format.")

    frame = load_dataset(data_path)
    train_frame, validation_frame, test_frame = split_dataset(frame)
    evaluation = build_evaluation(
        pipeline=artifact["pipeline"],
        train_labels=train_frame["category"],
        test_texts=test_frame["description"],
        test_labels=test_frame["category"],
        validation_sample_count=len(validation_frame),
    )
    result = {
        "model_version": artifact.get("version", "unknown"),
        "random_seed": artifact.get("metadata", {}).get("random_seed"),
        "dataset_sha256": hashlib.sha256(data_path.read_bytes()).hexdigest(),
        **evaluation,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=CATEGORY_MODEL_PATH)
    parser.add_argument("--data", type=Path, default=DATA_PATH)
    args = parser.parse_args()
    evaluate(args.model, args.data)


if __name__ == "__main__":
    main()

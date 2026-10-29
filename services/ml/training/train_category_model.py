"""Train and persist the reproducible TF-IDF/logistic-regression category model."""

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from app.config import CATEGORY_MODEL_PATH, CONFIDENCE_THRESHOLD
from training.data_utils import DATA_PATH, RANDOM_SEED, load_dataset, split_dataset
from training.evaluate_category_model import build_evaluation

MODEL_VERSION = "tfidf-logreg-v2"


def train(data_path: Path = DATA_PATH, output_path: Path = CATEGORY_MODEL_PATH) -> dict:
    frame = load_dataset(data_path)
    train_frame, validation_frame, test_frame = split_dataset(frame)

    pipeline = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    strip_accents="unicode",
                    ngram_range=(1, 2),
                    sublinear_tf=True,
                ),
            ),
            (
                "classifier",
                LogisticRegression(
                    class_weight="balanced",
                    max_iter=1000,
                    random_state=RANDOM_SEED,
                ),
            ),
        ]
    )
    pipeline.fit(train_frame["description"], train_frame["category"])

    evaluation = build_evaluation(
        pipeline=pipeline,
        train_labels=train_frame["category"],
        test_texts=test_frame["description"],
        test_labels=test_frame["category"],
        validation_sample_count=len(validation_frame),
    )

    digest = hashlib.sha256(data_path.read_bytes()).hexdigest()
    artifact = {
        "pipeline": pipeline,
        "version": MODEL_VERSION,
        "metadata": {
            "random_seed": RANDOM_SEED,
            "confidence_threshold": CONFIDENCE_THRESHOLD,
            "dataset_name": data_path.stem,
            "dataset_sha256": digest,
            "dataset_source_counts": frame["source"].value_counts().sort_index().to_dict(),
            "sample_counts": {
                "total": len(frame),
                "train": len(train_frame),
                "validation": len(validation_frame),
                "test": len(test_frame),
                "per_category": frame["category"].value_counts().sort_index().to_dict(),
            },
            "trained_at_utc": datetime.now(timezone.utc).isoformat(),
            "test_metrics": evaluation,
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, output_path)
    print(f"Saved {MODEL_VERSION} to {output_path}")
    print(json.dumps(evaluation, indent=2, sort_keys=True))
    return artifact


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA_PATH)
    parser.add_argument("--output", type=Path, default=CATEGORY_MODEL_PATH)
    args = parser.parse_args()
    train(args.data, args.output)


if __name__ == "__main__":
    main()

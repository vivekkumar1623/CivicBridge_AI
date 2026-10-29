"""Dataset validation and deterministic, leakage-aware split helpers."""

from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

from app.config import VALID_CATEGORIES

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "category_examples.csv"
DATA_COLUMNS = ["description", "category", "source", "language", "split_group"]
VALID_SOURCES = {"public_open_data", "volunteer_labeled", "synthetic_demo"}
RANDOM_SEED = 42


def load_dataset(path: Path = DATA_PATH) -> pd.DataFrame:
    frame = pd.read_csv(path, dtype=str, keep_default_na=False)
    if list(frame.columns) != DATA_COLUMNS:
        raise ValueError(f"Dataset columns must be exactly: {', '.join(DATA_COLUMNS)}")
    if frame.empty:
        raise ValueError("Dataset must contain at least one example.")

    for column in DATA_COLUMNS:
        frame[column] = frame[column].str.strip()
        if (frame[column] == "").any():
            raise ValueError(f"Dataset column '{column}' must not contain empty values.")

    invalid_categories = sorted(set(frame["category"]) - set(VALID_CATEGORIES))
    if invalid_categories:
        raise ValueError(f"Dataset contains unsupported categories: {invalid_categories}")

    invalid_sources = sorted(set(frame["source"]) - VALID_SOURCES)
    if invalid_sources:
        raise ValueError(f"Dataset contains unsupported sources: {invalid_sources}")

    group_counts = frame.groupby("split_group")["category"].nunique()
    if (group_counts > 1).any():
        raise ValueError("Each split_group must contain examples from exactly one category.")

    normalized = frame["description"].str.casefold().str.replace(r"\s+", " ", regex=True)
    if normalized.duplicated().any():
        raise ValueError("Dataset contains duplicate descriptions after normalization.")

    missing_categories = sorted(set(VALID_CATEGORIES) - set(frame["category"]))
    if missing_categories:
        raise ValueError(f"Dataset is missing categories: {missing_categories}")

    return frame


def split_dataset(
    frame: pd.DataFrame, random_seed: int = RANDOM_SEED
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    groups = frame[["split_group", "category"]].drop_duplicates()
    if groups["split_group"].duplicated().any():
        raise ValueError("A split_group cannot map to multiple categories.")

    train_validation_groups, test_groups = train_test_split(
        groups["split_group"].to_numpy(),
        test_size=0.15,
        random_state=random_seed,
        stratify=groups["category"].to_numpy(),
    )
    group_categories = groups.set_index("split_group")["category"]
    validation_fraction_of_remainder = 0.15 / 0.85
    train_groups, validation_groups = train_test_split(
        train_validation_groups,
        test_size=validation_fraction_of_remainder,
        random_state=random_seed,
        stratify=group_categories.loc[train_validation_groups].to_numpy(),
    )

    train = frame[frame["split_group"].isin(train_groups)].copy()
    validation = frame[frame["split_group"].isin(validation_groups)].copy()
    test = frame[frame["split_group"].isin(test_groups)].copy()

    train_group_set = set(train["split_group"])
    validation_group_set = set(validation["split_group"])
    test_group_set = set(test["split_group"])
    if (
        train_group_set & validation_group_set
        or train_group_set & test_group_set
        or validation_group_set & test_group_set
    ):
        raise ValueError("Grouped split leaked examples between train, validation, and test.")

    return train, validation, test

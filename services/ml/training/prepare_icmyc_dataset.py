"""Prepare a privacy-filtered, explicitly mapped I Change My City dataset."""

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

import pandas as pd

from training.data_utils import DATA_COLUMNS, DATA_PATH

RAW_DATA_PATH = DATA_PATH.parent / "raw" / "i_change_my_city.csv"
PROCESSED_DATA_PATH = DATA_PATH.parent / "processed" / "i_change_my_city_category_examples.csv"
MANIFEST_PATH = DATA_PATH.parent / "processed" / "i_change_my_city_manifest.json"
SOURCE_NAME = "I Change My City Complaints Log (2019-2022)"
SOURCE_URL = (
    "https://data.opencity.in/dataset/9183b0b2-b49a-40a9-b36d-275e1eaedb3f/"
    "resource/a60abf5c-3a15-4967-af32-c3074248580f"
)
SOURCE_LICENSE = "CC BY-SA 2.0"

CATEGORY_MAPPING = {
    "Mobility - Roads, Footpaths and Infrastructure": "road_damage",
    "Roads and Footpaths": "road_damage",
    "Garbage and Unsanitary Practices": "waste_management",
    "Solid Waste Management": "waste_management",
    "Waste Management": "waste_management",
    "Street lighting": "streetlight",
    "Streetlights": "streetlight",
    "Water Supply and Services": "water_drainage",
    "Sewerage Systems": "water_drainage",
    "Storm Water Drains": "water_drainage",
    "Water Supply": "water_drainage",
    "Community Infrastructure and Services": "public_property",
    "Parks & Recreation": "public_property",
    "Public Toilets": "public_property",
    "Playgrounds": "public_property",
    "Parks & Garden": "public_property",
    "Others": "other",
}

REQUIRED_SOURCE_COLUMNS = {"title", "description", "category_title"}
EMAIL_PATTERN = re.compile(r"(?i)\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b")
PHONE_PATTERN = re.compile(
    r"(?<!\d)(?:\+?91[\s().-]*)?(?:0[\s.-]*)?[6-9](?:[\s().-]*\d){9}(?!\d)"
)
POSTAL_CODE_PATTERN = re.compile(r"(?<!\d)[1-9]\d{5}(?!\d)")
HOUSE_ADDRESS_PATTERN = re.compile(
    r"(?i)\b(?:house|flat|door|plot|site)\s*"
    r"(?:no\.?|number|#)?\s*[:#-]?\s*[A-Z0-9/-]+\b"
)
WHITESPACE_PATTERN = re.compile(r"\s+")


def _read_source(path: Path) -> pd.DataFrame:
    try:
        return pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    except UnicodeDecodeError:
        return pd.read_csv(path, dtype=str, keep_default_na=False, encoding="cp1252")


def _redact_text(value: str) -> tuple[str, set[str]]:
    redactions: set[str] = set()
    for pattern, label in (
        (EMAIL_PATTERN, "[EMAIL]"),
        (PHONE_PATTERN, "[PHONE]"),
        (POSTAL_CODE_PATTERN, "[POSTAL_CODE]"),
        (HOUSE_ADDRESS_PATTERN, "[ADDRESS]"),
    ):
        value, count = pattern.subn(label, value)
        if count:
            redactions.add(label)
    return WHITESPACE_PATTERN.sub(" ", value).strip(), redactions


def prepare_frame(source: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    missing_columns = sorted(REQUIRED_SOURCE_COLUMNS - set(source.columns))
    if missing_columns:
        raise ValueError(f"Source CSV is missing required columns: {missing_columns}")

    rows = pd.DataFrame(
        {
            "title": source["title"].fillna("").astype(str).str.strip(),
            "description": source["description"].fillna("").astype(str).str.strip(),
            "source_category": source["category_title"].fillna("").astype(str).str.strip(),
        }
    )
    input_rows = len(rows)
    empty_text = rows["title"].eq("") & rows["description"].eq("")
    rows = rows.loc[~empty_text].copy()
    rows["category"] = rows["source_category"].map(CATEGORY_MAPPING)
    unmapped_counts = (
        rows.loc[rows["category"].isna(), "source_category"]
        .value_counts()
        .sort_index()
        .to_dict()
    )
    rows = rows.loc[rows["category"].notna()].copy()

    redaction_counts: dict[str, int] = {}
    sanitized_text: list[str] = []
    for title, description in zip(rows["title"], rows["description"], strict=True):
        text, redactions = _redact_text(f"{title}. {description}")
        sanitized_text.append(text)
        for label in redactions:
            redaction_counts[label] = redaction_counts.get(label, 0) + 1

    rows["description"] = sanitized_text
    rows = rows.loc[rows["description"].str.len().ge(20)].copy()
    normalized = rows["description"].str.casefold().map(
        lambda value: WHITESPACE_PATTERN.sub(" ", value).strip()
    )
    rows["_normalized"] = normalized

    category_counts_by_text = rows.groupby("_normalized")["category"].nunique()
    conflicting_text = set(category_counts_by_text[category_counts_by_text > 1].index)
    conflicting_rows = int(rows["_normalized"].isin(conflicting_text).sum())
    rows = rows.loc[~rows["_normalized"].isin(conflicting_text)].copy()
    before_deduplication = len(rows)
    rows = rows.drop_duplicates(subset="_normalized", keep="first").copy()
    duplicate_rows_removed = before_deduplication - len(rows)

    rows["source"] = "public_open_data"
    rows["language"] = "unknown"
    rows["split_group"] = rows["_normalized"].map(
        lambda value: hashlib.sha256(value.encode("utf-8")).hexdigest()
    )
    prepared = rows[DATA_COLUMNS].reset_index(drop=True)
    if prepared.empty:
        raise ValueError("No usable rows remain after applying the explicit category mapping.")
    if set(prepared["category"]) != {
        "road_damage",
        "waste_management",
        "streetlight",
        "water_drainage",
        "public_property",
        "other",
    }:
        raise ValueError("Prepared data must contain every CivicBridge category.")

    manifest = {
        "source_name": SOURCE_NAME,
        "source_url": SOURCE_URL,
        "license": SOURCE_LICENSE,
        "source_rows": input_rows,
        "empty_text_rows_removed": int(empty_text.sum()),
        "mapped_rows_before_deduplication": int(before_deduplication + conflicting_rows),
        "conflicting_text_rows_removed": conflicting_rows,
        "duplicate_rows_removed": duplicate_rows_removed,
        "prepared_rows": len(prepared),
        "category_counts": prepared["category"].value_counts().sort_index().to_dict(),
        "unmapped_parent_category_counts": unmapped_counts,
        "text_rows_with_redactions": redaction_counts,
        "input_columns_used": ["title", "description", "category_title"],
        "source_columns_excluded": [
            "address",
            "latitude",
            "longitude",
            "location",
            "ward_title",
        ],
    }
    return prepared, manifest


def prepare(
    source_path: Path = RAW_DATA_PATH,
    output_path: Path = PROCESSED_DATA_PATH,
    manifest_path: Path = MANIFEST_PATH,
) -> dict[str, Any]:
    if not source_path.is_file():
        raise FileNotFoundError(
            f"Source dataset not found at {source_path}. "
            "Download the OpenCity CSV before preparing it."
        )
    source_bytes = source_path.read_bytes()
    prepared, manifest = prepare_frame(_read_source(source_path))
    manifest["source_sha256"] = hashlib.sha256(source_bytes).hexdigest()
    manifest["prepared_sha256"] = hashlib.sha256(
        prepared.to_csv(index=False).encode("utf-8")
    ).hexdigest()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    prepared.to_csv(output_path, index=False)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(manifest, indent=2, sort_keys=True))
    print(f"Prepared training data saved to {output_path}")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=RAW_DATA_PATH)
    parser.add_argument("--output", type=Path, default=PROCESSED_DATA_PATH)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    args = parser.parse_args()
    prepare(args.input, args.output, args.manifest)


if __name__ == "__main__":
    main()

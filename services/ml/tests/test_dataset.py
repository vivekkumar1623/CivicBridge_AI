"""Tests for checked-in category data quality and grouped split reproducibility."""

from training.data_utils import load_dataset, split_dataset
from training.prepare_icmyc_dataset import prepare_frame


def test_dataset_uses_fixed_schema_and_explicit_synthetic_provenance() -> None:
    frame = load_dataset()

    assert list(frame.columns) == [
        "description",
        "category",
        "source",
        "language",
        "split_group",
    ]
    assert set(frame["source"]) == {"synthetic_demo"}
    assert set(frame["language"]) == {"en"}
    assert frame.groupby("category").size().to_dict() == {
        "other": 120,
        "public_property": 120,
        "road_damage": 120,
        "streetlight": 120,
        "waste_management": 120,
        "water_drainage": 120,
    }


def test_grouped_stratified_split_is_reproducible_and_has_expected_counts() -> None:
    frame = load_dataset()
    first = split_dataset(frame)
    second = split_dataset(frame)

    assert [len(part) for part in first] == [504, 108, 108]
    for first_part, second_part in zip(first, second, strict=True):
        assert first_part["split_group"].tolist() == second_part["split_group"].tolist()

    train, validation, test = first
    assert set(train["split_group"]).isdisjoint(validation["split_group"])
    assert set(train["split_group"]).isdisjoint(test["split_group"])
    assert set(validation["split_group"]).isdisjoint(test["split_group"])


def test_external_dataset_mapping_is_explicit_and_redacts_contact_details() -> None:
    import pandas as pd

    source = pd.DataFrame([
        {
            "title": "Pothole report",
            "description": "A road has a pothole. Call 9876543210 or email resident@example.com at Door No 18.",
            "category_title": "Mobility - Roads, Footpaths and Infrastructure",
            "address": "not included",
            "latitude": "12.9",
        },
        {
            "title": "Waste report",
            "description": "Waste is accumulating near the public collection point.",
            "category_title": "Garbage and Unsanitary Practices",
        },
        {
            "title": "Streetlight report",
            "description": "The streetlight has been broken for several days.",
            "category_title": "Street lighting",
        },
        {
            "title": "Drain report",
            "description": "A storm drain is blocked and causing water to collect.",
            "category_title": "Storm Water Drains",
        },
        {
            "title": "Public property report",
            "description": "A community facility requires maintenance and repair.",
            "category_title": "Community Infrastructure and Services",
        },
        {
            "title": "Other report",
            "description": "This complaint is listed under the source catch-all category.",
            "category_title": "Others",
        },
        {
            "title": "Unmapped category",
            "description": "This category must not be guessed into an application label.",
            "category_title": "Traffic and Road Safety",
        },
    ])

    prepared, manifest = prepare_frame(source)

    road_report = prepared.loc[prepared["category"] == "road_damage"].iloc[0]
    assert len(prepared) == 6
    assert road_report["source"] == "public_open_data"
    assert road_report["language"] == "unknown"
    assert list(prepared.columns) == [
        "description",
        "category",
        "source",
        "language",
        "split_group",
    ]
    assert "9876543210" not in road_report["description"]
    assert "resident@example.com" not in road_report["description"]
    assert "18" not in road_report["description"]
    assert manifest["unmapped_parent_category_counts"] == {"Traffic and Road Safety": 1}


def test_external_dataset_rejects_missing_required_source_columns() -> None:
    import pandas as pd
    import pytest

    with pytest.raises(ValueError, match="missing required columns"):
        prepare_frame(pd.DataFrame([{"title": "A title"}]))

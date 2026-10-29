# Dataset Card: CivicBridge Category Examples

The repository supports a synthetic demo corpus for repeatable CI and a locally prepared real-world corpus for model experiments. The raw and processed OpenCity files are intentionally excluded from Git.

## Bengaluru source dataset

| Property | Value |
| --- | --- |
| Name | I Change My City Complaints Log, 2019–2022 |
| Publisher/source | Janaagraha iCMyC, published through OpenCity |
| Resource | [OpenCity dataset resource](https://data.opencity.in/dataset/9183b0b2-b49a-40a9-b36d-275e1eaedb3f/resource/a60abf5c-3a15-4967-af32-c3074248580f) |
| License | CC BY-SA 2.0 |
| Source records | 16,071 |
| Source SHA-256 | `d951dbb484532421801f6cbd7550edaa6f9ab143da7c4d0e835ba574e4e6d5ac` |

**Attribution:** I Change My City Complaints Log (2019–2022), Janaagraha iCMyC, via OpenCity, licensed under CC BY-SA 2.0. The source states it is a complaint log; CivicBridge does not claim to own or independently verify the original labels.

The prepared local dataset contains 11,661 examples after mapping, text redaction, removal of duplicate text, and exclusion of identical text with conflicting labels. Its SHA-256 is `9fc9c2f81f5a689cd6746cf54caf5630f25697345fc1f3218b47d3b5682d5e54`.

## Preparation and label mapping

Run `python -m training.prepare_icmyc_dataset` from `services/ml` after placing the source CSV at `data/raw/i_change_my_city.csv`. The preparation manifest records row counts, source and prepared hashes, redaction-pattern hit counts, mapped class counts, and excluded parent-label counts; it contains no complaint text.

Only `title`, `description`, and `category_title` are used. Ward, location, address, latitude, longitude, status, agency, and other columns are excluded. The title and description are combined as text. Email, phone-number, postal-code, and house/flat/door/plot/site-number patterns are redacted. These patterns are best-effort filters, not a guarantee that text contains no personal information; the local files should remain private and should not be redistributed without review.

The mapping is exact and explicit:

| OpenCity parent label | CivicBridge category |
| --- | --- |
| `Mobility - Roads, Footpaths and Infrastructure`; `Roads and Footpaths` | `road_damage` |
| `Garbage and Unsanitary Practices`; `Solid Waste Management`; `Waste Management` | `waste_management` |
| `Street lighting`; `Streetlights` | `streetlight` |
| `Water Supply and Services`; `Sewerage Systems`; `Storm Water Drains`; `Water Supply` | `water_drainage` |
| `Community Infrastructure and Services`; `Parks & Recreation`; `Public Toilets`; `Playgrounds`; `Parks & Garden` | `public_property` |
| `Others` | `other` |

Other source categories are excluded rather than guessed into a CivicBridge label. The resulting class counts are:

| Category | Prepared examples |
| --- | ---: |
| `road_damage` | 5,054 |
| `waste_management` | 3,780 |
| `streetlight` | 1,397 |
| `water_drainage` | 773 |
| `public_property` | 318 |
| `other` | 339 |

The dataset does not provide a reliable language field for this pipeline, so prepared rows are marked `unknown`. Duplicate text is normalized and removed; where the same normalized text has conflicting mapped labels, all such rows are removed. A SHA-256 digest of normalized text is used as the split-group key.

## Splits and limitations

Training/evaluation uses a deterministic, stratified 70/15/15 split with seed 42. The current held-out test contains 1,750 examples. It is a random historical split, not a later-year or external-city test. Related complaints may share wording, so the result does not establish how the model performs on current, independently collected reports.

- The data is historical, city-specific, and derived from an existing civic complaint taxonomy. Its distribution and wording may not match CivicBridge users or other Indian cities.
- The source parent labels do not align perfectly with CivicBridge categories. Mapping is intentionally narrow; excluded categories are not represented.
- The `other` class is based only on the source label `Others` and is small.
- Text redaction uses regular expressions and cannot guarantee removal of every identifier or precise location a writer may have included in narrative text.
- The original CC BY-SA 2.0 license applies. Preserve attribution and assess the license’s share-alike conditions before sharing a modified or derived dataset.

## Synthetic demo corpus

`services/ml/data/category_examples.csv` remains a generated English-only corpus of 720 examples (120 per category), used by CI and reproducibility tests. It is not real-world data and must not be combined with real-data evaluation results. See the [synthetic dataset generator](../services/ml/training/build_synthetic_dataset.py).

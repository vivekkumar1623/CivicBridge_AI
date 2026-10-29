# ML Data Directory

This directory contains training data and evaluation datasets.

## Files

- `category_examples.csv` — 720 generated English examples, all labelled `synthetic_demo`; 120 per category. This is a demo corpus, not real-world data.
- `duplicate_pairs.csv` — Labeled duplicate/not-duplicate pairs
- `raw/i_change_my_city.csv` — locally downloaded OpenCity source (ignored by Git)
- `processed/i_change_my_city_category_examples.csv` — locally prepared, mapped training data (ignored by Git)

## Rules

- Every row must have a documented `source` field.
- Permitted sources: `public_open_data`, `volunteer_labeled`, `synthetic_demo`.
- Never label synthetic text as real user data.
- See `docs/DATASET_CARD.md` for full provenance documentation.
- Rebuild the category corpus from `services/ml` with `python -m training.build_synthetic_dataset`.
- Prepare the OpenCity corpus from `services/ml` with `python -m training.prepare_icmyc_dataset`; review its manifest before training.
- The OpenCity source is licensed CC BY-SA 2.0. Preserve attribution and review share-alike requirements before redistributing derived data.

# Model Card: CivicBridge Category Suggestions

## Model details

- **Version:** `tfidf-logreg-v2`
- **Task:** Suggest one of six CivicBridge issue categories from a report description.
- **Architecture:** scikit-learn word-level TF-IDF (unigrams and bigrams) with class-balanced Logistic Regression.
- **Training seed:** 42.
- **Training data:** By default, the synthetic CI corpus. The real-data experiment uses the locally prepared I Change My City corpus described in [DATASET_CARD.md](./DATASET_CARD.md).
- **Artifact:** `services/ml/models/category_classifier.joblib`, generated locally and ignored by Git.
- **Abstention threshold:** 0.55 maximum class score. Below it, inference returns no category and requests human review. This score is not calibrated confidence.

## Intended use and human oversight

The model provides an optional category suggestion while a resident drafts a report. Residents can choose another category. The Express API independently requests a server-side suggestion at submission and records whether it was accepted, overridden, or unavailable; browser-supplied AI fields are not authoritative. The model does not assign urgency, priority, safety risk, report status, or disposition.

If the artifact is missing, the ML service reports that the model is not ready. If the model is unavailable or abstains, report submission remains available with manual category selection.

## Real-data experiment

The following results are from a seed-42 stratified random split of the prepared 2019–2022 Bengaluru dataset. The held-out test set contains 1,750 examples. It is historical and single-city data, not a current or external validation set.

| Metric | Result |
| --- | ---: |
| Test accuracy | 0.849 |
| Test macro-F1 | 0.697 |
| Majority-class baseline macro-F1 | 0.101 |
| Coverage at threshold 0.55 | 69.1% (1,210/1,750) |
| Macro-F1 among returned suggestions | 0.800 |
| Test examples abstained | 540 |

| Category | Test support | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: |
| `road_damage` | 758 | 0.864 | 0.860 | 0.862 |
| `waste_management` | 567 | 0.954 | 0.912 | 0.932 |
| `streetlight` | 210 | 0.921 | 0.886 | 0.903 |
| `water_drainage` | 116 | 0.588 | 0.810 | 0.681 |
| `public_property` | 48 | 0.605 | 0.479 | 0.535 |
| `other` | 51 | 0.264 | 0.275 | 0.269 |

The macro-F1 among returned suggestions is computed only on examples above the threshold; it is not directly comparable to test macro-F1 over all examples. The weakest categories have limited or heterogeneous mapped data, so their scores warrant caution. These metrics measure agreement with source labels under the stated mapping, not correctness of the original reports or real-world service quality.

## Limitations and risks

- Parent-label mapping is a human-defined approximation from a Bengaluru civic taxonomy to CivicBridge’s broader six categories. Mapping errors affect both training and evaluation.
- A stratified random split of one historical dataset does not measure temporal or cross-city generalization. Related language may occur in both train and test sets.
- The source contains multilingual/variable complaint text, but this pipeline does not detect or document the language of each row.
- The `other` class is small and based only on the source label `Others`. `public_property` also has relatively few examples compared with road and waste categories.
- Text matching and redaction are best effort. The model must not be treated as an authority or a probability of correctness.
- Users must retain control over category selection; reviewers remain responsible for triage.

## Reproduction

From `services/ml`, with the source CSV at `data/raw/i_change_my_city.csv`:

```powershell
python -m training.prepare_icmyc_dataset
python -m training.train_category_model --data data/processed/i_change_my_city_category_examples.csv
python -m training.evaluate_category_model --data data/processed/i_change_my_city_category_examples.csv
python -m pytest
```

CI uses the synthetic corpus and does not need the locally ignored OpenCity files. To train the synthetic version locally instead, run `python -m training.build_synthetic_dataset` followed by the training and evaluation commands without `--data`.

# API Contract

The browser calls the Express API. It must not call the internal ML service directly.

## Category suggestion

### `POST /api/ai/category-suggestion`

Requires an authenticated user and is rate limited. The request is validated by Express before the private ML-service call.

Request:

```json
{
  "description": "There is a large pothole on the path beside the library."
}
```

`description` must be a string of 20–2,000 characters after trimming.

Response when a suggestion is available:

```json
{
  "suggestedCategory": "road_damage",
  "confidence": 0.91,
  "modelVersion": "tfidf-logreg-v2",
  "needsHumanReview": false,
  "suggestionsUnavailable": false
}
```

Categories are `road_damage`, `waste_management`, `streetlight`, `water_drainage`, `public_property`, and `other`. Confidence is a model score, not calibrated certainty; the UI does not present it as a correctness probability.

When the service is unavailable, its response shape is preserved with `suggestedCategory: null`, `needsHumanReview: true`, `suggestionsUnavailable: true`, and a manual-entry message. A low-confidence model result also has a null category and requires human review. The report workflow remains available.

### `POST /api/reports`

The authenticated report submission accepts the normal report fields and optional photo. The optional `locationLabel` is a user-entered place/landmark text (up to 120 characters) and is saved as text only. It is not geocoded or sent to an external mapping provider, and cannot be used for distance-based duplicate search. Exact coordinates remain separately optional; they enable nearby duplicate suggestions. The server requests a new category suggestion from the validated report description; it does not trust browser-provided AI fields. It stores the chosen user category, server-side suggestion, model metadata, and one of `accepted_suggestion`, `overrode_suggestion`, or `manual_fallback` as the category decision.

### `POST /api/reports/duplicate-suggestions`

Requires authentication and is rate limited. The request accepts a 20–2,000 character `description`, a fixed `category`, and optional `latitude`/`longitude`. Coordinates must be supplied together. Without coordinates, the API returns no matches and the report can still be submitted.

Express searches up to 50 non-demo reports in `submitted`, `under_review`, or `in_progress` status within 500 m, then asks the internal ML service to rank those candidates by text similarity. The API returns at most five positive-similarity suggestions:

```json
{
  "matches": [
    {
      "category": "road_damage",
      "status": "under_review",
      "distanceBand": "within_250m"
    }
  ],
  "suggestionsUnavailable": false
}
```

The only candidate details returned are category, status, and a coarse distance band (`within_250m` or `250m_to_500m`). The response never includes another report's ID/number, title, description, photo, reporter, or exact coordinates. Suggestions are unverified and do not merge, reject, or hide reports. If lookup or ML scoring is unavailable, the endpoint responds with an empty suggestion list and a message that report submission remains available.

## Reviewer API

Reviewer endpoints require an authenticated admin account. Citizen accounts receive `403`.

### `GET /api/admin/reports`

Returns a paginated queue, oldest first, and per-status counts for non-demo reports. By default, the queue includes only `submitted`, `under_review`, and `in_progress` reports. Optional filters are `status`, `category`, and `priority`; `page` defaults to 1 and `limit` defaults to 20 with a maximum of 50. Status totals exclude demo records and are not estimates of municipal workload.

### `PATCH /api/admin/reports/:id/status`

Accepts `{ "status": "under_review" }` and an optional 10–500 character `note`. Only the following transitions are accepted:

- `submitted` → `under_review` or `rejected`
- `under_review` → `in_progress` or `rejected`
- `in_progress` → `resolved` or `rejected`

Resolving requires a 10–500 character resolution note; rejecting requires a 10–500 character reason. Each accepted transition is appended to the report's status audit history. Reviewer status updates are records supplied by the reviewer, not independently verified ground truth.

### `PATCH /api/admin/reports/:id/priority`

Accepts `{ "priority": "low" | "normal" | "high", "note": "optional reviewer rationale" }`. Priority is reviewer-assigned, never inferred by the AI, and each actual change is recorded in a separate priority audit history.

## Internal ML service

The Python service is private to Express:

- `GET /health` — reports service and model readiness.
- `POST /predict-category` — accepts a description (1–5,000 characters) and returns `suggestedCategory`, `confidence`, `modelVersion`, and `needsHumanReview`.
- `POST /score-duplicates` — accepts the new description/category and up to 50 nearby candidate descriptions/categories/distances; returns at most five scored candidate IDs to Express. Candidate IDs are internal correlation values and are never returned by the public API.

The ML service has no database access and stores no report or user records.

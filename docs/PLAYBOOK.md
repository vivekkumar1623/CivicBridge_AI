# CivicBridge AI — Implementation Playbook

**Purpose:** Build a working, software-only final-year project that helps people report local public-space problems, follow their status, and helps a small review team triage reports using measurable ML assistance.
**Audience:** Student developer and AI coding agents. This file is the single source of truth for implementation decisions. Follow phases in order. Do not add technologies or change API/schema contracts without updating this specification first.
**Project name:** CivicBridge AI
**Short description:** Human-centred civic issue reporting and transparent triage, with ML-assisted category suggestions and nearby duplicate suggestions.
**Target pilot:** A clearly labelled campus or neighbourhood prototype. It does not claim to send complaints to a municipality unless an authorized integration is separately configured and tested.

---

## 0. Non-negotiable product decisions

1. **Software only.** No custom hardware, sensors, cameras, Raspberry Pi, or GPU is required. A normal laptop, web browser, and internet connection for package/model downloads are sufficient. A phone is useful for testing mobile layouts and taking sample photos but is not a development requirement.
2. **One canonical stack.** Do not mix alternatives from tutorials.
   - **Frontend:** React + TypeScript + Vite, React Router, Axios, Tailwind CSS.
   - **Backend/API:** Node.js LTS + TypeScript + Express.
   - **Database:** MongoDB with Mongoose. This satisfies the course form's Mongoose option.
   - **ML service:** Python + FastAPI + scikit-learn + pandas + joblib.
   - **Tests:** Vitest + Supertest for Node/API; pytest for Python; React Testing Library for key UI flows.
   - **Version control:** Git + GitHub.
   - **Local files:** local upload directory in development, never committed to Git. Keep photo storage behind a storage-service interface so object storage can be added later.
3. **Backend owns truth.** The browser must never connect directly to MongoDB or call the ML service directly. The Express backend is the only public API and the only service allowed to read/write application records. The Python ML service receives input from Express and returns suggestions; it does not access MongoDB.
4. **AI suggests; people decide.** A category suggestion is visible to the reporter and can be changed. Duplicate detection only suggests potential matches; it must not automatically merge, reject, or hide a report. ML must not make final safety or urgency decisions.
5. **No fake impact claims.** Do not invent accuracy, time saved, satisfaction, issue counts, government users, or municipal integrations. Every metric shown must come from actual test results or data in the application and must be labelled as demo data where applicable.
6. **No false authority claims.** The first release is a standalone prototype. Reports are only visible within the application. Show this notice in the UI: *“Prototype: this report is not automatically sent to a municipal authority. For immediate danger or emergencies, contact the relevant local service.”* Do not claim the problem is repaired because an admin clicked a button; the app records a status update supplied by a reviewer.
7. **Build a functioning narrow product before extensions.** Required: authentication, report submission, status tracking, reviewer workflow, text category model, duplicate suggestions, tests, documentation. Optional later: image classifier, multilingual model, public map, email notifications, live municipal integration, mobile app, IoT.
8. **Keep personal information minimal.** Do not collect Aadhaar, phone number, exact home address, or other unnecessary identifiers. Do not show a reporter's email or exact coordinates publicly. Store uploaded photos privately, validate them, resize/re-encode them, and remove metadata where practical.

---

## 1. Definition of a successful MVP

A successful MVP demonstrates this complete, honest workflow:
1. A citizen creates an account and signs in.
2. The citizen describes a local issue and may add one photo and optional location.
3. The app requests an ML category suggestion. The citizen accepts it or chooses another category.
4. Before final submission, the app can show nearby reports that might describe the same issue. The citizen may open one or continue with a new report. No automatic merge occurs.
5. The server stores the report and a status-history entry.
6. The citizen sees the report on “My Reports” and can track its status.
7. An admin/reviewer signs in separately, filters the queue, reviews the report, and advances it through valid status transitions with a note.
8. When a report is marked resolved, the reviewer must add a resolution note. The UI states this is the reviewer-provided update, not independently verified ground truth.
9. The dashboard reports real counts and measured resolution time only from records it actually has. Demo seed data is identified and excluded from real metrics by default.
10. Tests verify permissions, status transitions, ML behavior, and validation.

---

## 2. Fixed issue categories and status rules

### Category enum (exact values)
- `road_damage`
- `waste_management`
- `streetlight`
- `water_drainage`
- `public_property`
- `other`

Use these exact values in MongoDB, API contracts, training data, tests, and frontend constants. User-facing labels may be title case.

### Status enum (exact values)
- `submitted`
- `under_review`
- `in_progress`
- `resolved`
- `rejected`

### Allowed reviewer transitions only:
- `submitted` → `under_review` or `rejected`
- `under_review` → `in_progress` or `rejected`
- `in_progress` → `resolved` or `rejected`

No other transition is valid in the MVP. Do not permit citizens to set status. Every status transition must append an immutable status-history record. A resolved transition requires a non-empty `resolutionNote` of 10–500 characters. A rejected transition requires a non-empty `reason` of 10–500 characters. Status updates must be rejected with HTTP 422 if the transition is invalid or the required note is missing.

### Priority
Priority is reviewer-assigned in the MVP: `low`, `normal`, `high`. The AI must not assign priority automatically. The admin dashboard may show a neutral “Review priority” field and allow an authorized reviewer to change it with an audit-history event. Do not infer risk from sentiment alone.

---

## 3. System architecture

```
React + TypeScript browser app
             |
             | HTTPS / JSON or multipart form data
             v
Node.js + Express API  -----> MongoDB via Mongoose
       |
       | private HTTP requests with timeouts
       v
Python FastAPI ML service
  - category model inference
  - text similarity for duplicate suggestions
```

Uploaded photos: private local storage in development
Later deployment: private object storage behind the same storage interface

- Only Express exposes public application routes.
- Express authenticates the user, validates input, enforces access, calls the ML service, and persists all records.
- The ML service must be stateless at request time and must not store reports or user identity.
- MongoDB stores report metadata, users, and status history. It does not store image bytes.
- Photo downloads must go through an authorization-checked Express endpoint. Never expose the upload directory as a public static folder.
- If the ML service is offline or its model is unavailable, report submission must still work with manual category selection. Show a non-blocking message such as *“Suggestions are temporarily unavailable; choose a category manually.”*

---

## 4. Repository layout

```
civicbridge-ai/
  apps/
    web/
      src/
        app/
        components/
        features/
          auth/
          reports/
          admin/
        lib/
        types/
      public/
      package.json
      vite.config.ts
    api/
      src/
        config/
        middleware/
        models/
        routes/
        controllers/
        services/
        validators/
        utils/
        app.ts
        server.ts
      tests/
      package.json
  services/
    ml/
      app/
        main.py
        schemas.py
        category_model.py
        duplicate_matcher.py
        config.py
      training/
        train_category_model.py
        evaluate_category_model.py
      tests/
      data/
        README.md
        category_examples.csv
        duplicate_pairs.csv
      models/                 # generated model artifact; do not commit if large
      requirements.txt
  docs/
    PRODUCT_SPEC.md
    API_CONTRACT.md
    DATASET_CARD.md
    MODEL_CARD.md
    SECURITY_AND_PRIVACY.md
    TEST_PLAN.md
    DEMO_SCRIPT.md
    PLAYBOOK.md
  uploads/                    # local private storage; always ignored by Git
  .env.example
  .gitignore
  README.md
```

---

## 5. Environment and configuration

Keys in `.env.example`:
```env
NODE_ENV=development
API_PORT=4000
WEB_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/civicbridge_dev
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d
UPLOAD_DIR=./uploads
MAX_UPLOAD_BYTES=5242880
ML_SERVICE_URL=http://127.0.0.1:8000
ML_SERVICE_TIMEOUT_MS=3000
ADMIN_NAME=Demo Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_a_local_password
```

---

## 6. Phase Roadmap

- [x] **Phase 1 — Repository skeleton and health checks**
- [x] **Phase 2 — Data models, validation, and database connection**
- [ ] **Phase 3 — Authentication and access control**
- [ ] **Phase 4 — Complete non-AI report workflow**
- [ ] **Phase 5 — Photo upload and privacy**
- [ ] **Phase 6 — Text category model**
- [ ] **Phase 7 — Nearby duplicate suggestions**
- [ ] **Phase 8 — Admin/reviewer workflow and dashboard**
- [ ] **Phase 9 — Frontend usability and accessibility**
- [ ] **Phase 10 — Security, robustness, and quality gates**
- [ ] **Phase 11 — Documentation and presentation**

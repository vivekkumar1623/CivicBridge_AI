# CivicBridge AI

Human-centred civic issue reporting and transparent triage, with ML-assisted category suggestions and nearby duplicate suggestions.

> **Prototype:** This is a campus/neighbourhood prototype. It does not claim to send complaints to a municipality unless an authorized integration is separately configured and tested.

## Architecture

```
React + TypeScript browser app (port 5173)
             |
             | HTTPS / JSON or multipart form data
             v
Node.js + Express API (port 4000) -----> MongoDB via Mongoose
       |
       | private HTTP requests with timeouts
       v
Python FastAPI ML service (port 8000)
  - category model inference
  - text similarity for duplicate suggestions
```

## Tech Stack

| Layer       | Technology                                                            |
| ----------- | --------------------------------------------------------------------- |
| Frontend    | React + TypeScript + Vite, React Router, Axios, Tailwind CSS          |
| Backend/API | Node.js LTS + TypeScript + Express                                    |
| Database    | MongoDB with Mongoose                                                 |
| ML Service  | Python + FastAPI + scikit-learn + pandas + joblib                     |
| Tests       | Vitest + Supertest (API), pytest (Python), TypeScript/production build (web) |

## Prerequisites

- **Node.js** LTS (v18+)
- **Python** 3.11+
- **MongoDB** (local or Atlas)
- **Git**

## Setup & Run (Windows 11 PowerShell)

### 1. Clone and configure

```powershell
git clone <repo-url>
cd civicbridge-ai
Copy-Item .env.example .env
# Edit .env with your MONGODB_URI, JWT_SECRET, etc.
```

### 2. Start MongoDB

Start MongoDB locally or configure a protected Atlas database. Set `MONGODB_URI` in `.env`.

### 3. Start the API server (Terminal 1)

```powershell
cd apps/api
npm install
npm run dev
# API runs on http://localhost:4000
# Health check: http://localhost:4000/api/health
```

### 4. Set up the ML service (Terminal 2)

```powershell
cd services/ml
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m training.build_synthetic_dataset
python -m training.train_category_model

# Start the ML service
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
# Health check: http://localhost:8000/health
```

### 5. Start the frontend (Terminal 3)

```powershell
cd apps/web
npm install
npm run dev
# Opens at http://localhost:5173
```

### 6. Seed admin user (after API is running)

```powershell
cd apps/api
npm run seed:admin
```

## Running Tests

### API tests

```powershell
cd apps/api
npm test
```

### ML service tests

```powershell
cd services/ml
.venv\Scripts\Activate.ps1
pytest
```

## Project Status

- [x] Phase 1 — Repository skeleton and health checks
- [x] Phase 2 — Data models, validation, and database connection
- [x] Phase 3 — Authentication and access control
- [x] Phase 4 — Complete non-AI report workflow
- [x] Phase 5 — Photo upload and privacy
- [x] Phase 6 — Text category model
- [x] Phase 7 — Nearby duplicate suggestions
- [x] Phase 8 — Admin/reviewer workflow and dashboard
- [ ] Phase 9 — Frontend usability and accessibility
- [ ] Phase 10 — Security, robustness, and quality gates
- [ ] Phase 11 — Documentation and presentation


## Phase 6-8 technical documents

- [API contract](docs/API_CONTRACT.md)
- [Model card](docs/MODEL_CARD.md)
- [Dataset card](docs/DATASET_CARD.md)

## Limitations

- This is a standalone prototype; reports are only visible within the application.
- Category suggestions use a historical, single-city experiment and are not nationwide or production validated.
- Nearby duplicate matches are unverified suggestions and are not automatically merged or rejected.
- The reviewer dashboard is admin-only; status transitions are constrained and recorded with reviewer notes.
- Uploaded photos use private local development storage; persistent production
  storage requires a private object-storage adapter.
- Reports are not automatically submitted to a municipal authority.

## License

This project is for educational purposes.

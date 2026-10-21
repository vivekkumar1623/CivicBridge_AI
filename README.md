# CivicBridge AI

A campus/neighbourhood prototype for reporting local public-space issues. The
first GitHub release establishes the repository, service health checks, data
models, validation, and MongoDB connection (Phases 1–2 of
[the implementation playbook](./docs/PLAYBOOK.md)).

> **Prototype:** Reports are not automatically sent to a municipal authority.
> For immediate danger or emergencies, contact the relevant local service.

## Stack

- Web: React, TypeScript, Vite, Tailwind CSS
- API: Node.js, TypeScript, Express
- Database: MongoDB, Mongoose
- ML service: Python, FastAPI
- Tests: Vitest/Supertest and pytest

## Prerequisites

- Node.js LTS
- Python 3.11+
- MongoDB (local or Atlas)

## Setup (Windows PowerShell)

From the repository root:

```powershell
Copy-Item .env.example .env
# Set MONGODB_URI and JWT_SECRET in .env before starting the API.
```

Start MongoDB, then run the API in one terminal:

```powershell
Set-Location apps/api
npm install
npm run dev
```

The API listens on `http://localhost:4000`; its health check is
`http://localhost:4000/api/health`.

Run the web app in another terminal:

```powershell
Set-Location apps/web
npm install
npm run dev
```

The Vite server opens at `http://localhost:5173` and proxies `/api` to the API.

Run the ML health service in a third terminal:

```powershell
Set-Location services/ml
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The ML health endpoint is `http://localhost:8000/health`. It reports
`model_ready: false` until a model artifact exists.

## Tests and builds

```powershell
Set-Location apps/api
npm test
npm run build
npm run lint
npm run format
```

```powershell
Set-Location apps/web
npm run build
```

```powershell
Set-Location services/ml
.\.venv\Scripts\Activate.ps1
py -m pytest
```

## Current published scope

- [x] Phase 1 — Repository skeleton and service health checks
- [x] Phase 2 — Data models, validation, and database connection
- [ ] Phase 3 onward — Not included in this initial Phases 1–2 upload

The complete plan and later-phase requirements are in
[docs/PLAYBOOK.md](./docs/PLAYBOOK.md). Later-phase code remains local until it
is reviewed and intentionally published.

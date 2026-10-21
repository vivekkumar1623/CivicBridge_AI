"""Health endpoint for the CivicBridge AI ML service."""

from fastapi import FastAPI

from .config import CATEGORY_MODEL_PATH, SERVICE_VERSION

app = FastAPI(title="CivicBridge AI ML Service", version=SERVICE_VERSION)


@app.get("/health")
async def health_check():
    model_ready = CATEGORY_MODEL_PATH.is_file()
    return {
        "status": "ok",
        "model_ready": model_ready,
        "model_version": None,
        "service_version": SERVICE_VERSION,
    }

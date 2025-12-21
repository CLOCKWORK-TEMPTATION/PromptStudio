"""
DSPy Worker Service - FastAPI Application.
"""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager, suppress

from dotenv import load_dotenv
from fastapi import FastAPI

from .logging import configure_logging
from .metrics import MetricsRecorder
from .queue import InMemoryQueueClient
from .schemas import HealthResponse, VersionResponse
from .worker import WorkerService

SERVICE_NAME = "dspy_worker"
SERVICE_VERSION = "1.0.0"

load_dotenv()
configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    metrics = MetricsRecorder.create()
    queue_client = InMemoryQueueClient()
    worker = WorkerService(queue_client, metrics)

    worker_task = asyncio.create_task(worker.run_forever())
    app.state.worker = worker
    app.state.worker_task = worker_task
    app.state.metrics = metrics

    yield

    await worker.shutdown()
    worker_task.cancel()
    with suppress(asyncio.CancelledError):
        await worker_task


app = FastAPI(
    title="DSPy Worker Service",
    description="Async worker for DSPy job processing",
    version=SERVICE_VERSION,
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/version", response_model=VersionResponse)
async def version() -> VersionResponse:
    return VersionResponse(service=SERVICE_NAME, version=SERVICE_VERSION)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("DSPY_WORKER_PORT", "8001")),
        reload=True,
    )

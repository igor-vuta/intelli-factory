"""
Intelli-Factory Backend API Entry Point

This module initializes the FastAPI application and defines the core endpoints
for the multi-objective optimization supply chain matching system.

Author: Igor Vuta (P2773339)
Date: February 2026
"""

import asyncio
import os
import shutil
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prisma.engine.errors import BinaryNotFoundError

from db import prisma
from routers import auth, automations

_prisma_connect_task: asyncio.Task | None = None

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=True)


def _get_cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001,https://intelli-factory-frontend.vercel.app",
    )
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]

    required_origins = [
        "http://localhost:3000",
        "https://intelli-factory-frontend.vercel.app",
    ]
    for origin in required_origins:
        if origin not in origins:
            origins.append(origin)

    frontend_url = os.getenv("FRONTEND_URL", "").strip()
    if frontend_url and frontend_url not in origins:
        origins.append(frontend_url)

    return origins

# Initialize FastAPI application
app = FastAPI(
    title="Intelli-Factory API",
    description="Multi-objective optimization platform for supply chain matching",
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# Configure CORS for local development
# TODO: Restrict origins in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(automations.router, prefix="/api/automations", tags=["automations"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])


def _configure_prisma_query_engine_binary() -> None:
    if os.getenv("PRISMA_QUERY_ENGINE_BINARY"):
        return

    candidates = []
    home_cache = Path.home() / ".cache" / "prisma-python" / "binaries"
    render_cache = Path("/opt/render/.cache/prisma-python/binaries")

    patterns = (
        "**/prisma-query-engine-debian-openssl-3.0.x",
        "**/query-engine-debian-openssl-3.0.x",
    )

    if home_cache.exists():
        for pattern in patterns:
            candidates.extend(home_cache.glob(pattern))

    if render_cache.exists():
        for pattern in patterns:
            candidates.extend(render_cache.glob(pattern))

    candidates = sorted(candidates, reverse=True)
    if candidates:
        source_binary = candidates[0]
        local_binary = Path(__file__).resolve().parent / "prisma-query-engine-debian-openssl-3.0.x"

        if not local_binary.exists():
            shutil.copy2(source_binary, local_binary)
            local_binary.chmod(0o755)

        os.environ["PRISMA_QUERY_ENGINE_BINARY"] = str(local_binary)


async def _connect_prisma_background() -> None:
    for _ in range(3):
        try:
            _configure_prisma_query_engine_binary()
            await asyncio.wait_for(prisma.connect(), timeout=30)
            return
        except BinaryNotFoundError:
            await asyncio.sleep(5)
        except Exception:
            await asyncio.sleep(5)


@app.on_event("startup")
async def startup_event() -> None:
    global _prisma_connect_task
    _prisma_connect_task = asyncio.create_task(_connect_prisma_background())


@app.on_event("shutdown")
async def shutdown_event() -> None:
    if _prisma_connect_task and not _prisma_connect_task.done():
        _prisma_connect_task.cancel()

    try:
        await prisma.disconnect()
    except Exception:
        pass


@app.get("/")
def read_root():
    """
    Root endpoint to verify API is running.

    Returns:
        dict: Basic health status
    """
    return {
        "status": "ok",
        "service": "Intelli-Factory API",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    """
    Health check endpoint for deployment/monitoring.

    Returns:
        dict: Health status
    """
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

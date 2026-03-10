"""
Intelli-Factory Backend API Entry Point

This module initializes the FastAPI application and defines the core endpoints
for the multi-objective optimization supply chain matching system.

Author: Igor Vuta (P2773339)
Date: February 2026
"""

import asyncio
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prisma.engine.errors import BinaryNotFoundError

from db import prisma
from routers import auth, automations

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
    allow_origins=["http://localhost:3000", "localhost"],
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

    if home_cache.exists():
        candidates.extend(home_cache.glob("**/prisma-query-engine-debian-openssl-3.0.x"))

    if render_cache.exists():
        candidates.extend(render_cache.glob("**/prisma-query-engine-debian-openssl-3.0.x"))

    candidates = sorted(candidates, reverse=True)
    if candidates:
        os.environ["PRISMA_QUERY_ENGINE_BINARY"] = str(candidates[0])


@app.on_event("startup")
async def startup_event() -> None:
    _configure_prisma_query_engine_binary()

    try:
        await asyncio.wait_for(prisma.connect(), timeout=30)
    except BinaryNotFoundError:
        _configure_prisma_query_engine_binary()
        await asyncio.wait_for(prisma.connect(), timeout=30)


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await prisma.disconnect()


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

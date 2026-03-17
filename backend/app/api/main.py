"""
Intelli-Factory Backend API Entry Point

This module initializes the FastAPI application and defines the core endpoints
for the multi-objective optimization supply chain matching system.

Author: Igor Vuta (P2773339)
Date: February 2026
"""

import asyncio
import logging
import os
import shutil
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prisma.engine.errors import BinaryNotFoundError

from db import prisma
from routers import auth, automations, pairing, requests

logger = logging.getLogger(__name__)

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
app.include_router(requests.router, prefix="/api/requests", tags=["requests"])
app.include_router(pairing.router, prefix="/api/pairing", tags=["pairing"])


def _configure_prisma_query_engine_binary() -> None:
    if os.getenv("PRISMA_QUERY_ENGINE_BINARY"):
        return

    # Check if the binary was pre-copied into the project source dir during build
    local_binary = Path(__file__).resolve().parent / "prisma-query-engine-debian-openssl-3.0.x"
    if local_binary.exists():
        os.environ["PRISMA_QUERY_ENGINE_BINARY"] = str(local_binary)
        logger.info("Using pre-built Prisma binary at %s", local_binary)
        return

    # Fall back: search the Prisma cache dirs (populated by prisma py fetch at runtime)
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
        if not local_binary.exists():
            shutil.copy2(source_binary, local_binary)
            local_binary.chmod(0o755)
        os.environ["PRISMA_QUERY_ENGINE_BINARY"] = str(local_binary)
        logger.info("Copied Prisma binary from cache to %s", local_binary)


async def _fetch_prisma_binary() -> bool:
    """Run `prisma py fetch` to download the query engine binary. Returns True on success."""
    try:
        logger.info("Fetching Prisma query engine binary via `prisma py fetch` ...")
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "prisma",
            "py",
            "fetch",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        if proc.returncode == 0:
            logger.info("prisma py fetch succeeded")
            return True
        logger.error(
            "prisma py fetch failed (rc=%s): %s",
            proc.returncode,
            (stderr or b"").decode(errors="replace"),
        )
    except Exception as exc:
        logger.error("prisma py fetch raised: %s", exc)
    return False


async def _connect_prisma_background() -> None:
    fetched = False
    for attempt in range(1, 4):
        try:
            _configure_prisma_query_engine_binary()
            await asyncio.wait_for(prisma.connect(), timeout=30)
            logger.info("Prisma connected successfully on background attempt %s", attempt)
            return
        except BinaryNotFoundError:
            if not fetched:
                logger.warning("Prisma binary not found on attempt %s — running prisma py fetch", attempt)
                fetched = await _fetch_prisma_binary()
            else:
                logger.warning("Prisma binary still missing after fetch, attempt %s", attempt)
                await asyncio.sleep(5)
        except Exception as exc:
            logger.warning("Prisma connect failed on attempt %s: %s", attempt, exc)
            await asyncio.sleep(5)
    logger.error("Prisma background connect exhausted all attempts")


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

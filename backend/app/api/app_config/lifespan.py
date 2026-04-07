from contextlib import asynccontextmanager

from fastapi import FastAPI

from .prisma_bootstrap import shutdown_event, startup_event


@asynccontextmanager
async def lifespan(_: FastAPI):
    await startup_event()
    try:
        yield
    finally:
        await shutdown_event()

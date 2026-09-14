import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app_config import get_cors_origins, include_routers, lifespan
from db import prisma

logger = logging.getLogger(__name__)

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=True)
app = FastAPI(
    title="Intelli-Factory API",
    description="Multi-objective optimization platform for supply chain matching",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

include_routers(app)


@app.get("/")
def read_root():
    return {
        "status": "ok",
        "service": "Intelli-Factory API",
        "version": "0.1.0",
        "docs": "/api/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/ready")
async def readiness_check():
    try:
        await prisma.query_raw("SELECT 1")
    except Exception:
        logger.warning("Database readiness check failed", exc_info=True)
        return JSONResponse(status_code=503, content={"status": "not_ready"})
    return {"status": "ready"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

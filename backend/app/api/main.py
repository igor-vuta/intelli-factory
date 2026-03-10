"""
Intelli-Factory Backend API Entry Point

This module initializes the FastAPI application and defines the core endpoints
for the multi-objective optimization supply chain matching system.

Author: Igor Vuta (P2773339)
Date: February 2026
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.on_event("startup")
async def startup_event() -> None:
    await prisma.connect()


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

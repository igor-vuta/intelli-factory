import os


def get_cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001,https://intelli-factory-frontend.vercel.app",
    )
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]

    frontend_url = os.getenv("FRONTEND_URL", "").strip()
    if frontend_url and frontend_url not in origins:
        origins.append(frontend_url)

    return origins

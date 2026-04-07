import os


def get_cors_origins() -> list[str]:
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

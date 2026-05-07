from fastapi import FastAPI

from routers import addresses, auth, automations, comparison, pairing, ratings, requests, transactions


def include_routers(app: FastAPI) -> None:
    app.include_router(automations.router, prefix="/api/automations", tags=["automations"])
    app.include_router(comparison.router, prefix="/api/comparison", tags=["comparison"])
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(addresses.router, prefix="/api/addresses", tags=["addresses"])
    app.include_router(requests.router, prefix="/api/requests", tags=["requests"])
    app.include_router(pairing.router, prefix="/api/pairing", tags=["pairing"])
    app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
    app.include_router(ratings.router, prefix="/api/ratings", tags=["ratings"])

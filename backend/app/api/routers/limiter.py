"""
Rate limiting configuration for API endpoints.

This module provides utilities for implementing rate limiting on the API.
Currently configured but not active - can be integrated into routes as needed.

Author: Igor Vuta (P2773339)
Date: February 2026
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Define rate limit strategies
RATE_LIMITS = {
    "optimize": "10/minute",  # 10 optimizations per minute per IP
    "default": "100/minute",  # 100 requests per minute per IP
}

# TODO: Integrate limiter into routes:
# from .limiter import limiter
# @router.post("/optimize")
# @limiter.limit("10/minute")
# async def optimize(request):
#     ...

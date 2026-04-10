from collections import defaultdict
from datetime import datetime, timedelta
import logging

from fastapi import HTTPException, status

from db import prisma
from services.auth_constants import (
    LOGIN_ATTEMPT_WINDOW_MINUTES,
    LOGIN_FAILURE_THRESHOLD,
    RESEND_LIMIT_PER_IP_WINDOW,
    RESEND_LIMIT_PER_USER_WINDOW,
    RESEND_WINDOW_MINUTES,
)
from services.auth_security import now_utc

logger = logging.getLogger(__name__)

_resend_attempts_by_ip: dict[str, list[datetime]] = defaultdict(list)
_resend_attempts_by_email: dict[str, list[datetime]] = defaultdict(list)


async def check_login_lockout(email: str) -> bool:
    now = now_utc()
    lockout_window = now - timedelta(minutes=LOGIN_ATTEMPT_WINDOW_MINUTES)

    try:
        recent_failures = await prisma.loginattempt.find_many(
            where={
                "email": email.lower().strip(),
                "was_successful": False,
                "attempted_at": {"gte": lockout_window},
            },
            order={"attempted_at": "desc"},
        )
    except Exception as exc:
        error_text = f"{exc.__class__.__name__}: {exc}"
        if "LoginAttempt" in error_text or "TableNotFound" in error_text:
            logger.warning(
                "LoginAttempt table is missing; lockout check skipped until migrations are applied"
            )
            return False
        raise

    return len(recent_failures) >= LOGIN_FAILURE_THRESHOLD


async def record_login_attempt(
    email: str,
    was_successful: bool,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    try:
        await prisma.loginattempt.create(
            data={
                "email": email.lower().strip(),
                "was_successful": was_successful,
                "ip_address": ip_address,
                "user_agent": user_agent,
            }
        )
    except Exception as exc:
        error_text = f"{exc.__class__.__name__}: {exc}"
        if "LoginAttempt" in error_text or "TableNotFound" in error_text:
            logger.warning(
                "LoginAttempt table is missing; login-attempt audit write skipped until migrations are applied"
            )
            return
        raise


def check_ip_resend_rate_limit(ip_address: str | None) -> None:
    if not ip_address:
        return

    now = now_utc()
    threshold = now - timedelta(minutes=RESEND_WINDOW_MINUTES)
    window_attempts = [timestamp for timestamp in _resend_attempts_by_ip[ip_address] if timestamp > threshold]
    if len(window_attempts) >= RESEND_LIMIT_PER_IP_WINDOW:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many resend attempts")

    window_attempts.append(now)
    _resend_attempts_by_ip[ip_address] = window_attempts


def check_email_resend_rate_limit(email: str) -> None:
    now = now_utc()
    threshold = now - timedelta(minutes=RESEND_WINDOW_MINUTES)
    window_attempts = [timestamp for timestamp in _resend_attempts_by_email[email] if timestamp > threshold]
    if len(window_attempts) >= RESEND_LIMIT_PER_USER_WINDOW:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many resend attempts")

    window_attempts.append(now)
    _resend_attempts_by_email[email] = window_attempts

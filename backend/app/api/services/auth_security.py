from datetime import datetime, timezone
import hashlib
import logging
import os
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Response

from db import prisma
from services.auth_constants import SESSION_COOKIE_NAME, SESSION_TTL_HOURS

logger = logging.getLogger(__name__)
_argon2_hasher = PasswordHasher()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_token(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return _argon2_hasher.hash(password)


def verify_password_and_upgrade(password: str, encoded: str) -> tuple[bool, str | None]:
    if encoded.startswith("$argon2"):
        try:
            verified = _argon2_hasher.verify(encoded, password)
        except (VerifyMismatchError, InvalidHashError):
            return False, None

        if not verified:
            return False, None

        if _argon2_hasher.check_needs_rehash(encoded):
            return True, hash_password(password)

        return True, None

    try:
        algorithm, salt_hex, digest_hex = encoded.split("$", 2)
    except ValueError:
        return False, None

    if algorithm != "pbkdf2_sha256":
        return False, None

    salt = bytes.fromhex(salt_hex)
    expected_digest = bytes.fromhex(digest_hex)
    candidate_digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000)
    if not secrets.compare_digest(candidate_digest, expected_digest):
        return False, None

    return True, hash_password(password)


async def get_user_by_session_token(raw_token: str, user_agent: str | None = None):
    token_hash = hash_token(raw_token)
    session = await prisma.session.find_unique(where={"session_token_hash": token_hash})
    if not session:
        return None

    now = now_utc()
    if session.revoked_at is not None or session.expires_at <= now:
        return None

    user = await prisma.user.find_unique(where={"id": session.user_id})
    if not user or user.deleted_at is not None:
        return None

    if user_agent and session.user_agent and session.user_agent != user_agent:
        logger.warning(
            "User-Agent mismatch for session %s: stored=%s, current=%s",
            session.id,
            session.user_agent,
            user_agent,
        )

    return user, session


def set_session_cookie(response: Response, token: str) -> None:
    is_production = os.getenv("API_ENV", "development").lower() == "production"
    samesite = "none" if is_production else "lax"

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_production,
        samesite=samesite,
        max_age=SESSION_TTL_HOURS * 60 * 60,
        path="/",
    )

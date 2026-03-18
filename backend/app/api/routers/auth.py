import asyncio
import hashlib
import json
import logging
import os
import secrets
import smtplib
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Literal
from urllib import request as urllib_request

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from prisma.engine.errors import AlreadyConnectedError, BinaryNotFoundError
from pydantic import BaseModel, Field

from db import prisma

logger = logging.getLogger(__name__)

# Guard: attempt prisma py fetch at most once per process lifetime
_binary_fetch_attempted = False
_binary_fetch_lock = asyncio.Lock()


async def _fetch_prisma_binary_once() -> None:
    """Run `prisma py fetch` exactly once per process if the binary is missing."""
    global _binary_fetch_attempted
    async with _binary_fetch_lock:
        if _binary_fetch_attempted:
            return
        _binary_fetch_attempted = True
        try:
            logger.warning("Prisma binary missing — running prisma py fetch (inline fallback) ...")
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
                logger.info("Inline prisma py fetch succeeded")
            else:
                logger.error(
                    "Inline prisma py fetch failed (rc=%s): %s",
                    proc.returncode,
                    (stderr or b"").decode(errors="replace"),
                )
        except Exception as exc:
            logger.error("Inline prisma py fetch raised: %s", exc)


async def _ensure_db_connection() -> None:
    last_error: Exception | None = None

    for attempt in range(1, 9):
        try:
            await asyncio.wait_for(prisma.connect(), timeout=10)
        except AlreadyConnectedError:
            pass
        except BinaryNotFoundError as exc:
            last_error = exc
            logger.warning("Prisma binary not found on attempt %s/8 — will fetch", attempt)
            await _fetch_prisma_binary_once()
            # After fetch, loop around and retry immediately (no extra sleep needed)
        except Exception as exc:
            last_error = exc
            logger.warning("Database connect attempt %s/8 failed", attempt)
            if attempt < 8:
                await asyncio.sleep(min(0.5 * (2 ** (attempt - 1)), 5))
            continue

        try:
            # Probe query ensures Prisma query engine is actually reachable.
            await prisma.user.count()
            return
        except Exception as exc:
            last_error = exc
            logger.warning("Database probe attempt %s/8 failed", attempt)
            try:
                await prisma.disconnect()
            except Exception:
                pass
            if attempt < 8:
                await asyncio.sleep(min(0.5 * (2 ** (attempt - 1)), 5))

    logger.exception("Database connection unavailable after retries", exc_info=last_error)
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")


router = APIRouter(dependencies=[Depends(_ensure_db_connection)])

# ============================================================================
# SESSION AND AUTH CONFIGURATION
# ============================================================================

SESSION_COOKIE_NAME = "if_session"
# Session TTL: 24 hours (per Phase 1 Discovery - Q24)
SESSION_TTL_DAYS = 1
SESSION_TTL_HOURS = 24

# Email verification token expiration: 24 hours
VERIFY_TOKEN_TTL_HOURS = 24

# ============================================================================
# RATE LIMITING AND LOCKOUT CONFIGURATION
# ============================================================================

# Email verification resending rate limits
RESEND_WINDOW_MINUTES = 15
RESEND_LIMIT_PER_USER_WINDOW = 3  # Max 3 resend attempts per 15-min window per email
RESEND_LIMIT_PER_IP_WINDOW = 10   # Max 10 resend attempts per 15-min window per IP

# Login attempt tracking for account lockout (Phase 1 Discovery - Q23)
LOGIN_FAILURE_THRESHOLD = 5        # After 5 failed attempts, lock account
LOGIN_LOCKOUT_DURATION_MINUTES = 15  # Account locked for 15 minutes
LOGIN_ATTEMPT_WINDOW_MINUTES = 15  # Count failures within this window

# In-memory tracking of rate limit attempts (these are cleaned up periodically in production)
_resend_attempts_by_ip: dict[str, list[datetime]] = defaultdict(list)
_resend_attempts_by_email: dict[str, list[datetime]] = defaultdict(list)

UserRole = Literal["CUSTOMER", "FACTORY", "LOGIST", "ADMIN"]


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole
    display_name: str = Field(..., min_length=2, max_length=120)
    country_code: str = Field(..., min_length=2, max_length=2)


class RegisterResponse(BaseModel):
    status: str
    message: str


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=512)


class ResendVerificationRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)


class AuthUserResponse(BaseModel):
    id: str
    email: str
    role: UserRole
    is_email_verified: bool


class AuthStatusResponse(BaseModel):
    status: str
    user: AuthUserResponse


class MessageResponse(BaseModel):
    status: str
    message: str


class CountryItemResponse(BaseModel):
    code: str
    label: str


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_production_env() -> bool:
    return os.getenv("API_ENV", "development").lower() == "production"


def _verification_base_url(request: Request) -> str:
    configured = os.getenv("VERIFY_EMAIL_BASE_URL")
    if configured:
        return configured.rstrip("/")
    return "http://localhost:3000/verify-email"


def _build_verification_link(request: Request, raw_token: str) -> str:
    return f"{_verification_base_url(request)}?token={raw_token}"


def _send_verification_email_sync(recipient_email: str, verification_link: str) -> bool:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    if not smtp_host or not smtp_from_email:
        return False

    message = EmailMessage()
    message["Subject"] = "Verify your Intelli-Factory account"
    message["From"] = smtp_from_email
    message["To"] = recipient_email
    message.set_content(
        "Welcome to Intelli-Factory.\n\n"
        f"Verify your email by opening this link:\n{verification_link}\n\n"
        "If you did not create this account, you can ignore this email."
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as smtp:
        smtp.ehlo()
        if smtp_use_tls:
            smtp.starttls()
            smtp.ehlo()
        if smtp_username and smtp_password:
            smtp.login(smtp_username, smtp_password)
        smtp.send_message(message)

    return True


def _send_verification_email_brevo_api_sync(recipient_email: str, verification_link: str) -> bool:
    brevo_api_key = os.getenv("BREVO_API_KEY")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL")

    if not brevo_api_key or not smtp_from_email:
        return False

    payload = {
        "sender": {"email": smtp_from_email},
        "to": [{"email": recipient_email}],
        "subject": "Verify your Intelli-Factory account",
        "textContent": (
            "Welcome to Intelli-Factory.\n\n"
            f"Verify your email by opening this link:\n{verification_link}\n\n"
            "If you did not create this account, you can ignore this email."
        ),
    }

    req = urllib_request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "api-key": brevo_api_key,
            "content-type": "application/json",
        },
        method="POST",
    )

    with urllib_request.urlopen(req, timeout=20) as response:
        return 200 <= response.status < 300


async def _dispatch_verification_email(recipient_email: str, verification_link: str) -> str:
    if os.getenv("BREVO_API_KEY"):
        try:
            sent_api = await asyncio.to_thread(
                _send_verification_email_brevo_api_sync,
                recipient_email,
                verification_link,
            )
        except Exception:
            logger.exception("Failed sending verification email via Brevo API to %s", recipient_email)
            sent_api = False

        if sent_api:
            return "sent"

    try:
        sent = await asyncio.to_thread(
            _send_verification_email_sync,
            recipient_email,
            verification_link,
        )
    except Exception:
        logger.exception("Failed sending verification email to %s", recipient_email)
        sent = False

    if sent:
        return "sent"

    if not os.getenv("BREVO_API_KEY"):
        logger.warning("BREVO_API_KEY is not configured; skipping Brevo API fallback")
    else:
        try:
            sent_api = await asyncio.to_thread(
                _send_verification_email_brevo_api_sync,
                recipient_email,
                verification_link,
            )
        except Exception:
            logger.exception("Failed sending verification email via Brevo API to %s", recipient_email)
            sent_api = False

        if sent_api:
            return "sent"

    logger.warning("DEV EMAIL VERIFICATION LINK for %s: %s", recipient_email, verification_link)
    return "logged"


async def _create_email_verification_token(user_id: str, invalidate_existing: bool) -> str:
    now = _now()
    if invalidate_existing:
        await prisma.verificationtoken.update_many(
            where={
                "user_id": user_id,
                "token_type": "EMAIL_VERIFICATION",
                "consumed_at": None,
            },
            data={"consumed_at": now},
        )

    raw_token = secrets.token_urlsafe(48)
    verify_token_hash = _hash_token(raw_token)
    expires_at = now + timedelta(hours=VERIFY_TOKEN_TTL_HOURS)

    await prisma.verificationtoken.create(
        data={
            "user_id": user_id,
            "token_hash": verify_token_hash,
            "token_type": "EMAIL_VERIFICATION",
            "expires_at": expires_at,
        }
    )

    return raw_token


# ============================================================================
# LOGIN LOCKOUT AND ATTEMPT TRACKING HELPERS
# ============================================================================

async def _check_login_lockout(email: str) -> bool:
    """
    Check if a user account is locked due to too many failed login attempts.
    
    Lockout logic:
    - If 5+ failed attempts within the last 15 minutes, the account is locked
    - User can retry after 15 minutes have passed since the oldest attempt in the window
    
    Args:
        email: The email address to check
        
    Returns:
        True if account is locked, False otherwise
    """
    now = _now()
    lockout_window = now - timedelta(minutes=LOGIN_ATTEMPT_WINDOW_MINUTES)
    
    # Get failed login attempts within the lockout window.
    # If the LoginAttempt table is not migrated yet in an environment,
    # fail open (no lockout) instead of crashing authentication.
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
    
    # If 5 or more failures, account is locked
    return len(recent_failures) >= LOGIN_FAILURE_THRESHOLD


async def _record_login_attempt(
    email: str,
    was_successful: bool,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """
    Record a login attempt in the database for rate limiting and security monitoring.
    
    This is used to track failed login attempts and enforce account lockout
    after too many failures in a short time window.
    
    Args:
        email: The email address of the login attempt
        was_successful: Whether the login attempt succeeded
        ip_address: IP address from which the attempt originated
        user_agent: User-Agent header from the request
    """
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


def _check_ip_resend_rate_limit(ip_address: str | None) -> None:
    if not ip_address:
        return

    now = _now()
    threshold = now - timedelta(minutes=RESEND_WINDOW_MINUTES)
    window_attempts = [timestamp for timestamp in _resend_attempts_by_ip[ip_address] if timestamp > threshold]
    if len(window_attempts) >= RESEND_LIMIT_PER_IP_WINDOW:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many resend attempts")

    window_attempts.append(now)
    _resend_attempts_by_ip[ip_address] = window_attempts


def _check_email_resend_rate_limit(email: str) -> None:
    now = _now()
    threshold = now - timedelta(minutes=RESEND_WINDOW_MINUTES)
    window_attempts = [timestamp for timestamp in _resend_attempts_by_email[email] if timestamp > threshold]
    if len(window_attempts) >= RESEND_LIMIT_PER_USER_WINDOW:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many resend attempts")

    window_attempts.append(now)
    _resend_attempts_by_email[email] = window_attempts


def _hash_token(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password_bytes, salt, 600_000)
    return f"pbkdf2_sha256${salt.hex()}${digest.hex()}"


def _verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, salt_hex, digest_hex = encoded.split("$", 2)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    salt = bytes.fromhex(salt_hex)
    expected_digest = bytes.fromhex(digest_hex)
    candidate_digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000)
    return secrets.compare_digest(candidate_digest, expected_digest)


async def _create_role_profile(
    user_id: str,
    role: UserRole,
    display_name: str,
    country_code: str,
) -> None:
    if role == "CUSTOMER":
        await prisma.customerprofile.create(
            data={
                "user_id": user_id,
                "display_name": display_name,
                "registration_country_code": country_code,
            }
        )
        return

    if role == "FACTORY":
        await prisma.factoryprofile.create(
            data={
                "user_id": user_id,
                "legal_name": display_name,
                "registration_country_code": country_code,
            }
        )
        return

    if role == "LOGIST":
        await prisma.logistprofile.create(
            data={
                "user_id": user_id,
                "company_name": display_name,
                "registration_country_code": country_code,
            }
        )
        return


async def _get_user_by_session_token(raw_token: str, user_agent: str | None = None):
    """
    Retrieve user and session from a session token.
    
    Performs comprehensive session validation:
    - Token hash lookup in database
    - Session expiration check (24 hours)
    - Session revocation status check
    - User existence and status check
    - User-Agent binding validation (optional but recommended)
    
    The User-Agent binding helps prevent session fixation attacks by ensuring
    the same browser/client is used for the session. While not enforced strictly
    (as User-Agent can change with updates), it provides an additional signal
    for anomaly detection.
    
    Args:
        raw_token: Raw session token from client
        user_agent: Current User-Agent header (for binding validation)
        
    Returns:
        Tuple of (user, session) if valid, None if invalid/expired/revoked
    """
    token_hash = _hash_token(raw_token)
    session = await prisma.session.find_unique(where={"session_token_hash": token_hash})
    if not session:
        return None

    now = datetime.now(timezone.utc)
    
    # Check if session is revoked or expired
    if session.revoked_at is not None or session.expires_at <= now:
        return None

    # Check if user still exists and is not deleted
    user = await prisma.user.find_unique(where={"id": session.user_id})
    if not user or user.deleted_at is not None:
        return None

    # Optional: Validate User-Agent binding (logs warning if mismatch but doesn't reject)
    # This helps detect suspicious session usage
    if user_agent and session.user_agent and session.user_agent != user_agent:
        logger.warning(
            f"User-Agent mismatch for session {session.id}: "
            f"stored={session.user_agent}, current={user_agent}"
        )

    return user, session


def _set_session_cookie(response: Response, token: str) -> None:
    """
    Set the HttpOnly session cookie with security flags.
    
    Security Features:
    - HttpOnly: Cookie cannot be accessed by JavaScript (prevents XSS attacks)
    - Secure: Cookie only sent over HTTPS (enabled in production)
    - SameSite=None (production): allows cross-site frontend -> API cookie auth
    - SameSite=Lax (development): safer default for local same-site usage
    - Max-Age: 24 hours - matches SESSION_TTL_HOURS
    - Path=/: Available across entire API domain
    
    The Secure flag is automatically set based on API_ENV:
    - Production (API_ENV=production): Secure=True (HTTPS enforced)
    - Development (API_ENV=development): Secure=False (allows HTTP for local dev)
    
    Args:
        response: FastAPI Response object to set cookie on
        token: Raw session token (will be stored as-is in cookie, hashed server-side)
    """
    is_production = os.getenv("API_ENV", "development").lower() == "production"
    samesite = "none" if is_production else "lax"
    
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_production,  # Secure flag: True in production, False in development
        samesite=samesite,
        max_age=SESSION_TTL_HOURS * 60 * 60,  # 24 hours in seconds
        path="/",              # Available across entire domain
    )


@router.get("/countries", response_model=list[CountryItemResponse])
async def countries(locale: Literal["en", "ru", "kk"] = "en"):
    active_countries = await prisma.country.find_many(
        where={"is_active": True},
        order={"default_name": "asc"},
    )

    if not active_countries:
        return []

    country_ids = [country.id for country in active_countries]
    translation_rows = await prisma.countrytranslation.find_many(
        where={
            "country_id": {"in": country_ids},
            "locale": locale,
        }
    )

    translation_map = {translation.country_id: translation.name for translation in translation_rows}

    return [
        CountryItemResponse(
            code=country.iso2,
            label=translation_map.get(country.id, country.default_name),
        )
        for country in active_countries
    ]


@router.post("/register", response_model=RegisterResponse)
async def register(payload: RegisterRequest, request: Request):
    normalized_country_code = payload.country_code.strip().upper()

    country = await prisma.country.find_unique(where={"iso2": normalized_country_code})
    if not country or not country.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or inactive country code",
        )

    existing_user = await prisma.user.find_unique(where={"email": payload.email.lower().strip()})
    if existing_user and existing_user.deleted_at is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = await prisma.user.create(
        data={
            "email": payload.email.lower().strip(),
            "password_hash": _hash_password(payload.password),
            "role": payload.role,
            "is_email_verified": False,
        }
    )

    await _create_role_profile(
        user.id,
        payload.role,
        payload.display_name.strip(),
        normalized_country_code,
    )

    verify_token = await _create_email_verification_token(user.id, invalidate_existing=True)
    verification_link = _build_verification_link(request, verify_token)
    delivery_mode = await _dispatch_verification_email(user.email, verification_link)

    if delivery_mode == "sent":
        return RegisterResponse(
            status="success",
            message="Registration successful. Check your inbox for a verification email.",
        )

    if not _is_production_env():
        return RegisterResponse(
            status="success",
            message=(
                "Registration successful. Email provider is not configured in development. "
                f"Open this verification link: {verification_link}"
            ),
        )

    return RegisterResponse(
        status="success",
        message="Registration successful. Email is not configured yet, verification link is logged in backend output.",
    )


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(payload: ResendVerificationRequest, request: Request):
    normalized_email = payload.email.lower().strip()
    _check_ip_resend_rate_limit(request.client.host if request.client else None)

    user = await prisma.user.find_unique(where={"email": normalized_email})
    if not user or user.deleted_at is not None or user.is_email_verified:
        return MessageResponse(
            status="success",
            message="If the account exists and is not verified, a new verification email has been sent.",
        )

    _check_email_resend_rate_limit(normalized_email)

    verify_token = await _create_email_verification_token(user.id, invalidate_existing=True)
    verification_link = _build_verification_link(request, verify_token)
    delivery_mode = await _dispatch_verification_email(user.email, verification_link)

    if delivery_mode == "logged" and not _is_production_env():
        return MessageResponse(
            status="success",
            message=f"Development mode verification link: {verification_link}",
        )

    return MessageResponse(
        status="success",
        message="If the account exists and is not verified, a new verification email has been sent.",
    )


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(payload: VerifyEmailRequest):
    token_hash = _hash_token(payload.token)
    token_row = await prisma.verificationtoken.find_unique(where={"token_hash": token_hash})

    if not token_row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")

    now = _now()
    if token_row.consumed_at is not None or token_row.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token expired or consumed")

    await prisma.user.update(
        where={"id": token_row.user_id},
        data={"is_email_verified": True},
    )

    await prisma.verificationtoken.update(
        where={"id": token_row.id},
        data={"consumed_at": now},
    )

    return MessageResponse(status="success", message="Email verified successfully")


@router.get("/verify-email-link", response_model=MessageResponse)
async def verify_email_link(token: str):
    return await verify_email(VerifyEmailRequest(token=token))


@router.post("/login", response_model=AuthStatusResponse)
async def login(payload: LoginRequest, request: Request, response: Response):
    """
    Login endpoint that authenticates a user and creates a session.
    
    Security Features:
    - Password verification with PBKDF2 hashing (600k iterations)
    - Account lockout after 5 failed attempts within 15 minutes
    - Session token stored as SHA256 hash only (never stored in plaintext)
    - HttpOnly, Secure (in production), SameSite=Lax cookie
    - User-Agent binding for session validation
    - Login attempt tracking for security monitoring
    
    Request:
        email: User email address
        password: User password
        
    Response:
        status: "success" on successful authentication
        user: Authenticated user data (id, email, role, is_email_verified)
        
    Errors:
        401: Invalid credentials or account locked
        403: Email not verified
    """
    normalized_email = payload.email.lower().strip()
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    # Check if account is locked due to too many failed login attempts
    is_locked = await _check_login_lockout(normalized_email)
    if is_locked:
        # Log the lockout event
        await _record_login_attempt(
            normalized_email,
            was_successful=False,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        logger.warning(f"Login attempt on locked account: {normalized_email} from {ip_address}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account temporarily locked due to too many failed attempts. Try again in 15 minutes.",
        )
    
    # Look up user by email
    user = await prisma.user.find_unique(where={"email": normalized_email})
    if not user or user.deleted_at is not None:
        # Record failed attempt
        await _record_login_attempt(
            normalized_email,
            was_successful=False,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        logger.info(f"Login attempt with invalid credentials for: {normalized_email}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Verify password
    if not _verify_password(payload.password, user.password_hash):
        # Record failed attempt
        await _record_login_attempt(
            normalized_email,
            was_successful=False,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        logger.info(f"Login attempt with wrong password for: {normalized_email}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Check if email is verified (Phase 1 Discovery Q22 - unverified users restricted)
    if not user.is_email_verified:
        # Record the failed attempt (unverified email)
        await _record_login_attempt(
            normalized_email,
            was_successful=False,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        logger.info(f"Login attempt with unverified email: {normalized_email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified",
        )

    # All checks passed - create session
    raw_session_token = secrets.token_urlsafe(48)
    session_token_hash = _hash_token(raw_session_token)
    now = _now()

    # Record successful login attempt
    await _record_login_attempt(
        normalized_email,
        was_successful=True,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    # Create session in database with all security context
    await prisma.session.create(
        data={
            "user_id": user.id,
            "session_token_hash": session_token_hash,
            "expires_at": now + timedelta(hours=SESSION_TTL_HOURS),
            "last_seen_at": now,
            "ip_address": ip_address,
            "user_agent": user_agent,
        }
    )

    # Set secure HttpOnly cookie with session token
    _set_session_cookie(response, raw_session_token)

    logger.info(f"Successful login for user: {user.id} ({user.email})")

    return AuthStatusResponse(
        status="success",
        user=AuthUserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            is_email_verified=user.is_email_verified,
        ),
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(request: Request, response: Response):
    """
    Logout endpoint that revokes the current session.
    
    This endpoint revokes only the session associated with the current cookie,
    allowing the user to remain logged in on other devices.
    
    Response:
        status: "success"
        message: Logout confirmation message
    """
    raw_session_token = request.cookies.get(SESSION_COOKIE_NAME)

    if raw_session_token:
        token_hash = _hash_token(raw_session_token)
        # Revoke the current session by setting revoked_at timestamp
        session = await prisma.session.update_many(
            where={"session_token_hash": token_hash, "revoked_at": None},
            data={"revoked_at": _now()},
        )
        logger.info(f"User logged out: {session}")

    # Delete the session cookie from client
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")

    return MessageResponse(status="success", message="Logged out")


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all(request: Request, response: Response):
    """
    Logout-all endpoint that revokes all active sessions for the current user.
    
    This endpoint revokes all sessions across all devices/browsers for maximum security.
    Use this when:
    - User suspects account compromise
    - User has changed password (Phase 3 will enforce auto logout-all)
    - User is ending their account access across all devices
    
    Security:
    - Requires valid authentication via current session cookie
    - Only the authenticated user can revoke their own sessions
    - All revoked sessions become immediately invalid
    
    Response:
        status: "success"
        message: Confirmation that all sessions have been revoked
        
    Errors:
        401: Not authenticated (no valid session)
    """
    raw_session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw_session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    # Validate the current session and get user (with User-Agent binding check)
    user_agent = request.headers.get("user-agent")
    user_and_session = await _get_user_by_session_token(raw_session_token, user_agent)
    if not user_and_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    user, current_session = user_and_session

    # Revoke all active sessions for this user
    now = _now()
    revoked_count = await prisma.session.update_many(
        where={
            "user_id": user.id,
            "revoked_at": None,  # Only revoke active sessions
        },
        data={"revoked_at": now},
    )

    # Delete the session cookie from client
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")

    logger.info(f"User {user.id} ({user.email}) logged out from all sessions. Revoked {revoked_count} sessions.")

    return MessageResponse(
        status="success",
        message=f"Logged out from all devices. {revoked_count} sessions revoked.",
    )


@router.get("/me", response_model=AuthStatusResponse)
async def me(request: Request):
    raw_session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw_session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_agent = request.headers.get("user-agent")
    user_and_session = await _get_user_by_session_token(raw_session_token, user_agent)
    if not user_and_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    user, session = user_and_session

    await prisma.session.update(
        where={"id": session.id},
        data={"last_seen_at": _now()},
    )

    return AuthStatusResponse(
        status="success",
        user=AuthUserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            is_email_verified=user.is_email_verified,
        ),
    )

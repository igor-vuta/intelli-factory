import asyncio
import hashlib
import logging
import os
import secrets
import smtplib
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from prisma.engine.errors import AlreadyConnectedError
from pydantic import BaseModel, Field

from db import prisma


async def _ensure_db_connection() -> None:
    try:
        await prisma.connect()
    except AlreadyConnectedError:
        return
    except Exception:
        logger.exception("Database connection unavailable")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")


router = APIRouter(dependencies=[Depends(_ensure_db_connection)])
logger = logging.getLogger(__name__)

SESSION_COOKIE_NAME = "if_session"
SESSION_TTL_DAYS = 7
VERIFY_TOKEN_TTL_HOURS = 24
RESEND_WINDOW_MINUTES = 15
RESEND_LIMIT_PER_USER_WINDOW = 3
RESEND_LIMIT_PER_IP_WINDOW = 10

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


async def _dispatch_verification_email(recipient_email: str, verification_link: str) -> str:
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

    logger.info("DEV EMAIL VERIFICATION LINK for %s: %s", recipient_email, verification_link)
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


async def _get_user_by_session_token(raw_token: str):
    token_hash = _hash_token(raw_token)
    session = await prisma.session.find_unique(where={"session_token_hash": token_hash})
    if not session:
        return None

    now = datetime.now(timezone.utc)
    if session.revoked_at is not None or session.expires_at <= now:
        return None

    user = await prisma.user.find_unique(where={"id": session.user_id})
    if not user or user.deleted_at is not None:
        return None

    return user, session


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        path="/",
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
    await _dispatch_verification_email(user.email, verification_link)

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
    user = await prisma.user.find_unique(where={"email": payload.email.lower().strip()})

    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified",
        )

    raw_session_token = secrets.token_urlsafe(48)
    session_token_hash = _hash_token(raw_session_token)
    now = _now()

    await prisma.session.create(
        data={
            "user_id": user.id,
            "session_token_hash": session_token_hash,
            "expires_at": now + timedelta(days=SESSION_TTL_DAYS),
            "last_seen_at": now,
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }
    )

    _set_session_cookie(response, raw_session_token)

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
    raw_session_token = request.cookies.get(SESSION_COOKIE_NAME)

    if raw_session_token:
        token_hash = _hash_token(raw_session_token)
        await prisma.session.update_many(
            where={"session_token_hash": token_hash, "revoked_at": None},
            data={"revoked_at": _now()},
        )

    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")

    return MessageResponse(status="success", message="Logged out")


@router.get("/me", response_model=AuthStatusResponse)
async def me(request: Request):
    raw_session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw_session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_and_session = await _get_user_by_session_token(raw_session_token)
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

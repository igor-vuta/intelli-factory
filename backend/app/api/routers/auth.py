import logging
import secrets
from typing import Literal
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from db import prisma
from services.auth_constants import (
    SESSION_COOKIE_NAME,
    SESSION_TTL_HOURS,
)
from services.auth_db_guard import ensure_db_connection as _ensure_db_connection
from services.auth_email import (
    create_email_verification_token as _create_email_verification_token,
    create_role_profile as _create_role_profile,
    dispatch_verification_email as _dispatch_verification_email,
    ensure_default_currencies as _ensure_default_currencies,
    is_production_env as _is_production_env,
    build_verification_link,
)
from services.auth_rate_limit import (
    check_email_resend_rate_limit as _check_email_resend_rate_limit,
    check_ip_resend_rate_limit as _check_ip_resend_rate_limit,
    check_login_lockout as _check_login_lockout,
    record_login_attempt as _record_login_attempt,
)
from services.auth_security import (
    get_user_by_session_token as _get_user_by_session_token,
    hash_password as _hash_password,
    hash_token as _hash_token,
    now_utc as _now,
    set_session_cookie as _set_session_cookie,
    verify_password_and_upgrade as _verify_password_and_upgrade,
)
from routers.addresses import resolve_or_create_address as _resolve_or_create_address

logger = logging.getLogger(__name__)


router = APIRouter(dependencies=[Depends(_ensure_db_connection)])

UserRole = Literal["CUSTOMER", "FACTORY", "LOGIST", "ADMIN"]


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole
    display_name: str = Field(..., min_length=2, max_length=120)
    country_code: str = Field(..., min_length=2, max_length=2)
    # Legacy flat address (kept for backward compat, ignored when structured fields present)
    address: str | None = Field(None, max_length=300)
    # Structured address fields
    region_name: str | None = Field(None, max_length=100)
    city_name: str | None = Field(None, max_length=100)
    street: str | None = Field(None, max_length=300)
    postal_code: str | None = Field(None, max_length=20)
    preferred_currency_code: str = Field(..., min_length=3, max_length=3)


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


class CurrencyItemResponse(BaseModel):
    code: str
    name: str

def _build_verification_link(_: Request, raw_token: str) -> str:
    return build_verification_link(raw_token)


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


@router.get("/currencies", response_model=list[CurrencyItemResponse])
async def currencies():
    await _ensure_default_currencies()
    rows = await prisma.currency.find_many(order={"code": "asc"}, take=50)
    return [CurrencyItemResponse(code=row.code, name=row.name) for row in rows]


@router.post("/register", response_model=RegisterResponse)
async def register(payload: RegisterRequest, request: Request):
    normalized_country_code = payload.country_code.strip().upper()
    normalized_currency_code = payload.preferred_currency_code.strip().upper()

    await _ensure_default_currencies()

    country = await prisma.country.find_unique(where={"iso2": normalized_country_code})
    if not country or not country.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or inactive country code",
        )

    currency = await prisma.currency.find_unique(where={"code": normalized_currency_code})
    if not currency:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported currency code",
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

    # Resolve structured address if provided, else fall back to flat text
    address_id: str | None = None
    address_label: str = payload.address.strip() if payload.address else ""

    if payload.region_name and payload.city_name and payload.street:
        try:
            addr_result = await _resolve_or_create_address(
                country_code=normalized_country_code,
                region_name=payload.region_name,
                city_name=payload.city_name,
                street=payload.street,
                postal_code=payload.postal_code,
            )
            address_id = addr_result["id"]
            address_label = addr_result["label"]
        except HTTPException:
            # Fall back to a plain text label if geo resolution fails
            address_label = f"{payload.street.strip()}, {payload.city_name.strip()}, {payload.region_name.strip()}"

    await _create_role_profile(
        user.id,
        payload.role,
        payload.display_name.strip(),
        normalized_country_code,
        address_label,
        normalized_currency_code,
        address_id=address_id,
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
    normalized_email = payload.email.lower().strip()
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    is_locked = await _check_login_lockout(normalized_email)
    if is_locked:
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
    
    user = await prisma.user.find_unique(where={"email": normalized_email})
    if not user or user.deleted_at is not None:
        await _record_login_attempt(
            normalized_email,
            was_successful=False,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        logger.info(f"Login attempt with invalid credentials for: {normalized_email}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    password_valid, upgraded_password_hash = _verify_password_and_upgrade(
        payload.password,
        user.password_hash,
    )
    if not password_valid:
        await _record_login_attempt(
            normalized_email,
            was_successful=False,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        logger.info(f"Login attempt with wrong password for: {normalized_email}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if upgraded_password_hash is not None:
        await prisma.user.update(
            where={"id": user.id},
            data={"password_hash": upgraded_password_hash},
        )

    if not user.is_email_verified:
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

    raw_session_token = secrets.token_urlsafe(48)
    session_token_hash = _hash_token(raw_session_token)
    now = _now()

    await _record_login_attempt(
        normalized_email,
        was_successful=True,
        ip_address=ip_address,
        user_agent=user_agent,
    )

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

    raw_session_token = request.cookies.get(SESSION_COOKIE_NAME)

    if raw_session_token:
        token_hash = _hash_token(raw_session_token)
        session = await prisma.session.update_many(
            where={"session_token_hash": token_hash, "revoked_at": None},
            data={"revoked_at": _now()},
        )
        logger.info(f"User logged out: {session}")

    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")

    return MessageResponse(status="success", message="Logged out")


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all(request: Request, response: Response):
    raw_session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw_session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_agent = request.headers.get("user-agent")
    user_and_session = await _get_user_by_session_token(raw_session_token, user_agent)
    if not user_and_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    user, current_session = user_and_session

    now = _now()
    revoked_count = await prisma.session.update_many(
        where={
            "user_id": user.id,
            "revoked_at": None,
        },
        data={"revoked_at": now},
    )

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


# ---------------------------------------------------------------------------
# DEV-ONLY: instant email verification (blocked in production)
# ---------------------------------------------------------------------------

class DevVerifyRequest(BaseModel):
    email: str


@router.post("/dev-verify", response_model=MessageResponse)
async def dev_verify(payload: DevVerifyRequest):
    """Instantly mark an account as email-verified. Only available outside production."""
    if _is_production_env():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    user = await prisma.user.find_first(where={"email": payload.email})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.is_email_verified:
        return MessageResponse(status="ok", message="Already verified")

    await prisma.user.update(
        where={"id": user.id},
        data={"is_email_verified": True},
    )
    return MessageResponse(status="ok", message="Account verified")
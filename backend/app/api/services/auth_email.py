import asyncio
from decimal import Decimal
from datetime import timedelta
import json
import logging
import os
import secrets
import smtplib
from email.message import EmailMessage
from typing import Literal
from urllib import request as urllib_request

from db import prisma
from services.auth_constants import VERIFY_TOKEN_TTL_HOURS
from services.auth_security import hash_token, now_utc

logger = logging.getLogger(__name__)

UserRole = Literal["CUSTOMER", "FACTORY", "LOGIST", "ADMIN"]

DEFAULT_CURRENCIES: tuple[tuple[str, str, str, bool, Decimal], ...] = (
    ("USD", "US Dollar", "$", True, Decimal("1.0")),
    ("EUR", "Euro", "EUR", False, Decimal("1.08")),
    ("KZT", "Kazakhstani Tenge", "KZT", False, Decimal("0.0022")),
)


def is_production_env() -> bool:
    return os.getenv("API_ENV", "development").lower() == "production"


def verification_base_url() -> str:
    configured = os.getenv("VERIFY_EMAIL_BASE_URL")
    if configured:
        return configured.rstrip("/")
    return "http://localhost:3000/verify-email"


def build_verification_link(raw_token: str) -> str:
    return f"{verification_base_url()}?token={raw_token}"


async def ensure_default_currencies() -> None:
    existing = await prisma.currency.find_many(take=1)
    if existing:
        return

    for code, name, symbol, is_base, rate in DEFAULT_CURRENCIES:
        await prisma.currency.upsert(
            where={"code": code},
            data={
                "create": {
                    "code": code,
                    "name": name,
                    "symbol": symbol,
                    "decimals": 2,
                    "is_base_currency": is_base,
                    "exchange_rate_to_base": rate,
                },
                "update": {
                    "name": name,
                    "symbol": symbol,
                    "decimals": 2,
                    "is_base_currency": is_base,
                    "exchange_rate_to_base": rate,
                },
            },
        )


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


async def dispatch_verification_email(recipient_email: str, verification_link: str) -> str:
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


async def create_email_verification_token(user_id: str, invalidate_existing: bool) -> str:
    now = now_utc()
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
    verify_token_hash = hash_token(raw_token)
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


async def create_role_profile(
    user_id: str,
    role: UserRole,
    display_name: str,
    country_code: str,
    address: str,
    preferred_currency_code: str,
    address_id: str | None = None,
    phone: str | None = None,
    contact_name: str | None = None,
    initial_offer_base_price: float | None = None,
    initial_offer_currency_code: str | None = None,
    initial_offer_description: str | None = None,
) -> None:
    primary_address_data: dict = {"primary_address_id": address_id} if address_id else {}

    if role == "CUSTOMER":
        extra: dict = {}
        if phone:
            extra["phone"] = phone
        # CustomerProfile has no contact_name column
        await prisma.customerprofile.create(
            data={
                "user_id": user_id,
                "display_name": display_name,
                "registration_country_code": country_code,
                "registration_address": address,
                "preferred_currency_code": preferred_currency_code,
                **primary_address_data,
                **extra,
            }
        )
        return

    if role == "FACTORY":
        extra = {}
        if phone:
            extra["phone"] = phone
        if contact_name:
            extra["contact_name"] = contact_name
        await prisma.factoryprofile.create(
            data={
                "user_id": user_id,
                "legal_name": display_name,
                "registration_country_code": country_code,
                "registration_address": address,
                "preferred_currency_code": preferred_currency_code,
                **primary_address_data,
                **extra,
            }
        )
        return

    if role == "LOGIST":
        extra = {}
        if phone:
            extra["phone"] = phone
        if contact_name:
            extra["contact_name"] = contact_name
        profile = await prisma.logistprofile.create(
            data={
                "user_id": user_id,
                "company_name": display_name,
                "registration_country_code": country_code,
                "registration_address": address,
                "preferred_currency_code": preferred_currency_code,
                **primary_address_data,
                **extra,
            }
        )
        # Seed initial logistic offer if base price provided
        if initial_offer_base_price is not None and initial_offer_base_price >= 0:
            offer_currency = initial_offer_currency_code or preferred_currency_code
            offer_data: dict = {
                "logist_profile_id": profile.id,
                "title": "Regional courier offer",
                "base_price": Decimal(str(initial_offer_base_price)),
                "currency_code": offer_currency,
                "reliability_score": 0.75,
                "status": "ACTIVE",
            }
            if initial_offer_description:
                offer_data["description"] = initial_offer_description
            await prisma.logisticoffer.create(data=offer_data)
        return

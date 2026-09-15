import importlib
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.append(str(API_ROOT))

RegisterRequest = importlib.import_module("routers.auth").RegisterRequest


def registration_payload():
    return {
        "email": "factory@example.test",
        "password": "Localtest123!",
        "role": "FACTORY",
        "display_name": "Factory name",
        "country_code": "KZ",
        "preferred_currency_code": "KZT",
    }


@pytest.mark.parametrize("role", ["CUSTOMER", "FACTORY", "LOGIST"])
def test_registration_requires_phone_for_every_role(role):
    payload = {**registration_payload(), "role": role}
    with pytest.raises(ValidationError) as error:
        RegisterRequest(**payload)
    assert any(issue["loc"] == ("phone",) for issue in error.value.errors())


@pytest.mark.parametrize(
    "phone", [None, "", "       ", "123456", "1" * 16, "call me today", "+7abc7000000000"]
)
def test_registration_rejects_invalid_phone(phone):
    with pytest.raises(ValidationError) as error:
        RegisterRequest(**registration_payload(), phone=phone)
    assert any(issue["loc"] == ("phone",) for issue in error.value.errors())


@pytest.mark.parametrize("phone", ["+7 700 000 0000", "+44 (20) 1234-5678", "1234567", "1" * 15])
def test_registration_accepts_formatted_phone(phone):
    request = RegisterRequest(**registration_payload(), phone=phone)
    assert request.phone == phone

"""Prepare disposable accounts for category browser checks; never sends email."""
import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json
import os
from pathlib import Path
import sys
from uuid import uuid4

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(API_ROOT))
from prisma import Json, Prisma  # noqa: E402
from test_category_governance import make_user, seed_factory  # noqa: E402
from services.auth_security import hash_token  # noqa: E402


async def main():
    url = os.environ["CATEGORY_TEST_DATABASE_URL"]
    assert "127.0.0.1:55439/factory_categories_" in url
    db = Prisma(datasource={"url": url})
    await db.connect()
    try:
        user, _, category, item, address = await seed_factory(db)
        second = await db.category.create(
            data={"slug": str(uuid4()), "default_name": f"Second production family {uuid4()}"}
        )
        customer = await make_user(db, "CUSTOMER")
        profile = await db.customerprofile.create(
            data={
                "user_id": customer.id,
                "display_name": "Browser customer",
                "primary_address_id": address.id,
            }
        )
        req = await db.request.create(
            data={
                "customer_profile_id": profile.id,
                "category_id": category.id,
                "item_id": item.id,
                "quantity": Decimal(10),
                "destination_address_id": address.id,
                "preferred_currency_code": "USD",
                "requested_characteristics_json": Json({"quantity_unit": "kg"}),
            }
        )
        admin = await make_user(db, "ADMIN")
        result = {
            "category": category.id,
            "categoryName": category.default_name,
            "second": second.id,
            "secondName": second.default_name,
            "item": item.id,
            "address": address.id,
            "request": req.id,
        }
        for role, account in (("factory", user), ("customer", customer), ("admin", admin)):
            token = f"local-category-browser-{uuid4()}"
            await db.session.create(
                data={
                    "user_id": account.id,
                    "session_token_hash": hash_token(token),
                    "expires_at": datetime.now(timezone.utc) + timedelta(hours=4),
                }
            )
            result[role] = token
        path = Path(
            os.environ.get("CATEGORY_BROWSER_FIXTURE", "/private/tmp/factory-browser-fixture.json")
        )
        path.write_text(json.dumps(result))
        path.chmod(0o600)
        print(f"Disposable browser fixture saved to {path}")
    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())

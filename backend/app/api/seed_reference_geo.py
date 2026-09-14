"""Import the bundled geography snapshot without replacing existing record IDs."""

import asyncio
import json
from pathlib import Path

from prisma import Prisma

DATA_DIR = Path(__file__).parent / "data" / "geography"


def load_reference_data() -> tuple[list[dict], list[dict]]:
    countries = json.loads((DATA_DIR / "countries.json").read_text())
    regions = json.loads((DATA_DIR / "regions.json").read_text())
    country_codes = {country["iso2"] for country in countries}
    if len(country_codes) != len(countries):
        raise ValueError("Duplicate country codes")
    if len({region["code"] for region in regions}) != len(regions):
        raise ValueError("Duplicate subdivision codes")
    for region in regions:
        if region["country_code"] not in country_codes:
            raise ValueError(f"Unknown country for {region['code']}")
    return countries, regions


async def seed() -> None:
    countries, regions = load_reference_data()
    prisma = Prisma()
    await prisma.connect()
    try:
        # Bulk upserts keep the import practical on the 1 GB Oracle VM.
        # One transaction prevents partially populated language lists on failure.
        async with prisma.tx(timeout=120000) as tx:
            await tx.execute_raw('''
                INSERT INTO "Country" (id, iso2, iso3, default_name, is_active, created_at, updated_at)
                SELECT gen_random_uuid(), iso2, iso3, default_name, true, now(), now()
                FROM jsonb_to_recordset($1::jsonb) AS x(iso2 text, iso3 text, default_name text)
                ON CONFLICT (iso2) DO UPDATE SET
                    iso3 = EXCLUDED.iso3, default_name = EXCLUDED.default_name, updated_at = now()
            ''', json.dumps(countries))
            country_names = [
                {"iso2": c["iso2"], "locale": locale, "name": name}
                for c in countries for locale, name in c["translations"].items()
            ]
            await tx.execute_raw('''
                INSERT INTO "CountryTranslation" (id, country_id, locale, name)
                SELECT gen_random_uuid(), c.id, x.locale, x.name
                FROM jsonb_to_recordset($1::jsonb) AS x(iso2 text, locale text, name text)
                JOIN "Country" c ON c.iso2 = x.iso2
                ON CONFLICT (country_id, locale) DO UPDATE SET name = EXCLUDED.name
            ''', json.dumps(country_names))
            await tx.execute_raw('''
                INSERT INTO "Region" (id, country_id, code, default_name, is_active, created_at, updated_at)
                SELECT gen_random_uuid(), c.id, x.code, x.default_name, true, now(), now()
                FROM jsonb_to_recordset($1::jsonb)
                    AS x(country_code text, code text, default_name text)
                JOIN "Country" c ON c.iso2 = x.country_code
                ON CONFLICT (country_id, code) DO UPDATE SET
                    default_name = EXCLUDED.default_name, updated_at = now()
            ''', json.dumps(regions))
            region_names = [
                {"country_code": r["country_code"], "code": r["code"], "locale": locale, "name": name}
                for r in regions for locale, name in r["translations"].items()
            ]
            await tx.execute_raw('''
                INSERT INTO "RegionTranslation" (id, region_id, locale, name)
                SELECT gen_random_uuid(), r.id, x.locale, x.name
                FROM jsonb_to_recordset($1::jsonb)
                    AS x(country_code text, code text, locale text, name text)
                JOIN "Country" c ON c.iso2 = x.country_code
                JOIN "Region" r ON r.country_id = c.id AND r.code = x.code
                ON CONFLICT (region_id, locale) DO UPDATE SET name = EXCLUDED.name
            ''', json.dumps(region_names))
        print(f"Seeded {len(countries)} countries and {len(regions)} subdivisions with available translations.")
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(seed())

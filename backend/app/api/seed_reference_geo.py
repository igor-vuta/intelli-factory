from prisma import Prisma

COUNTRIES = [
    {
        "iso2": "KZ",
        "iso3": "KAZ",
        "default_name": "Kazakhstan",
        "translations": {
            "en": "Kazakhstan",
            "ru": "Казахстан",
            "kk": "Қазақстан",
        },
    },
    {
        "iso2": "GB",
        "iso3": "GBR",
        "default_name": "United Kingdom",
        "translations": {
            "en": "United Kingdom",
            "ru": "Великобритания",
            "kk": "Ұлыбритания",
        },
    },
    {
        "iso2": "DE",
        "iso3": "DEU",
        "default_name": "Germany",
        "translations": {
            "en": "Germany",
            "ru": "Германия",
            "kk": "Германия",
        },
    },
    {
        "iso2": "TR",
        "iso3": "TUR",
        "default_name": "Turkey",
        "translations": {
            "en": "Turkey",
            "ru": "Турция",
            "kk": "Түркия",
        },
    },
    {
        "iso2": "AE",
        "iso3": "ARE",
        "default_name": "United Arab Emirates",
        "translations": {
            "en": "United Arab Emirates",
            "ru": "ОАЭ",
            "kk": "БАӘ",
        },
    },
]


async def seed() -> None:
    prisma = Prisma()
    await prisma.connect()

    try:
        for country_data in COUNTRIES:
            country = await prisma.country.upsert(
                where={"iso2": country_data["iso2"]},
                data={
                    "create": {
                        "iso2": country_data["iso2"],
                        "iso3": country_data["iso3"],
                        "default_name": country_data["default_name"],
                        "is_active": True,
                    },
                    "update": {
                        "iso3": country_data["iso3"],
                        "default_name": country_data["default_name"],
                        "is_active": True,
                    },
                },
            )

            for locale, name in country_data["translations"].items():
                await prisma.countrytranslation.upsert(
                    where={
                        "country_id_locale": {
                            "country_id": country.id,
                            "locale": locale,
                        }
                    },
                    data={
                        "create": {
                            "country_id": country.id,
                            "locale": locale,
                            "name": name,
                        },
                        "update": {
                            "name": name,
                        },
                    },
                )

        print(f"Seeded {len(COUNTRIES)} countries with translations.")
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed())

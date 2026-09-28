"""Check import repeatability against an initialized testing database."""

import asyncio

from prisma import Prisma
from seed_reference_geo import seed


async def snapshot(prisma):
    result = {}
    for table in ("Country", "CountryTranslation", "Region", "RegionTranslation"):
        result[table] = await prisma.query_raw(
            f'''SELECT count(*)::int AS count,
                md5(string_agg(id::text, ',' ORDER BY id)) AS ids FROM "{table}"'''
        )
    return result


async def verify():
    prisma = Prisma()
    await prisma.connect()
    try:
        before = await snapshot(prisma)
        assert before["Country"][0]["count"] == 249
        assert before["Region"][0]["count"] == 5046
    finally:
        await prisma.disconnect()

    # The importer owns a Prisma engine; release ours before starting it on the micro VM.
    await seed()
    await prisma.connect()
    try:
        assert await snapshot(prisma) == before, "Repeat import changed IDs or row counts"
        print("Geography import repeatability passed: row counts and IDs are unchanged.")
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(verify())

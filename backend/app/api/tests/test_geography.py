from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from routers import addresses
from seed_reference_geo import load_reference_data


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_reference_codes_and_country_translations_are_complete():
    countries, regions = load_reference_data()
    assert len(countries) == 249
    assert len(regions) == 5046
    assert all(set(row["translations"]) == {"en", "ru", "kk"} for row in countries)
    kz = {row["code"] for row in regions if row["country_code"] == "KZ"}
    assert len(kz) == 20
    assert {"KZ-10", "KZ-33", "KZ-62", "KZ-71", "KZ-75", "KZ-79"} <= kz
    assert all(row["default_name"] and row["translations"]["en"] for row in regions)


@pytest.mark.anyio
async def test_bootstrap_localizes_names_and_falls_back_to_english(monkeypatch):
    region = SimpleNamespace(id="region", code="KZ-19", default_name="Almaty Region", translations=[
        SimpleNamespace(locale="ru", name="Алматинская область"),
    ])
    city = SimpleNamespace(id="city", region_id="region", default_name="Almaty", translations=[])
    monkeypatch.setattr(addresses, "prisma", SimpleNamespace(
        country=SimpleNamespace(find_unique=AsyncMock(return_value=SimpleNamespace(id="country"))),
        region=SimpleNamespace(find_many=AsyncMock(return_value=[region])),
        city=SimpleNamespace(find_many=AsyncMock(return_value=[city])),
    ))
    result = await addresses.address_bootstrap("kz", "ru")
    assert result.regions[0].name == "Алматинская область"
    assert result.regions[0].code == "KZ-19"
    assert result.cities[0].name == "Almaty"
    assert addresses.localized_name(region, "kk") == "Almaty Region"


@pytest.mark.anyio
async def test_translated_address_reuses_existing_region_and_city(monkeypatch):
    region = SimpleNamespace(id="region", code="KZ-19", default_name="Almaty Region", translations=[
        SimpleNamespace(locale="ru", name="Алматинская область"),
    ])
    city = SimpleNamespace(id="city", default_name="Almaty", translations=[
        SimpleNamespace(locale="ru", name="Алматы"),
    ])
    region_create, city_create = AsyncMock(), AsyncMock()
    monkeypatch.setattr(addresses, "prisma", SimpleNamespace(
        country=SimpleNamespace(find_unique=AsyncMock(return_value=SimpleNamespace(id="country", default_name="Kazakhstan"))),
        region=SimpleNamespace(find_many=AsyncMock(return_value=[region]), create=region_create),
        city=SimpleNamespace(find_many=AsyncMock(return_value=[city]), create=city_create),
        address=SimpleNamespace(find_many=AsyncMock(return_value=[SimpleNamespace(id="address")])),
    ))
    result = await addresses.resolve_or_create_address("KZ", " алматинская область ", "Алматы", "Abay 10", None)
    assert result["id"] == "address"
    region_create.assert_not_awaited()
    city_create.assert_not_awaited()


@pytest.mark.anyio
async def test_bootstrap_disambiguates_translated_subdivisions(monkeypatch):
    regions = [SimpleNamespace(
        id=code, code=code, default_name=english,
        translations=[SimpleNamespace(locale="ru", name="Мурсия")],
    ) for code, english in [("ES-MC", "Region of Murcia"), ("ES-MU", "Murcia")]]
    monkeypatch.setattr(addresses, "prisma", SimpleNamespace(
        country=SimpleNamespace(find_unique=AsyncMock(return_value=SimpleNamespace(id="country"))),
        region=SimpleNamespace(find_many=AsyncMock(return_value=regions)),
        city=SimpleNamespace(find_many=AsyncMock(return_value=[])),
    ))
    result = await addresses.address_bootstrap("ES", "ru")
    assert {r.name for r in result.regions} == {"Мурсия (ES-MC)", "Мурсия (ES-MU)"}
    assert addresses.matches_name(regions[1], "Мурсия (ES-MU)")
    assert not addresses.matches_name(regions[0], "Мурсия (ES-MU)")


@pytest.mark.anyio
async def test_request_address_reuses_translated_reference_rows(monkeypatch):
    from routers import requests

    region = SimpleNamespace(id="region", code="KZ-19", default_name="Almaty Region", translations=[
        SimpleNamespace(locale="ru", name="Алматинская область"),
    ])
    city = SimpleNamespace(id="city", default_name="Almaty", translations=[
        SimpleNamespace(locale="ru", name="Алматы"),
    ])
    region_create, city_create = AsyncMock(), AsyncMock()
    monkeypatch.setattr(requests, "prisma", SimpleNamespace(
        country=SimpleNamespace(find_unique=AsyncMock(return_value=SimpleNamespace(id="country", is_active=True))),
        region=SimpleNamespace(find_many=AsyncMock(return_value=[region]), create=region_create),
        city=SimpleNamespace(find_many=AsyncMock(return_value=[city]), create=city_create),
        address=SimpleNamespace(find_many=AsyncMock(return_value=[SimpleNamespace(id="address", street="Abay 10")])),
    ))
    result = await requests._resolve_or_create_address(
        address_id=None, country_code="KZ", region_name="Алматинская область", city_name="Алматы",
        street="Abay 10", address_field_name="destination_address_id",
    )
    assert result == "address"
    region_create.assert_not_awaited()
    city_create.assert_not_awaited()


def test_coverage_and_translation_provenance_match_bundled_records():
    import hashlib
    import json
    from collections import Counter

    from seed_reference_geo import DATA_DIR

    countries, regions = load_reference_data()
    coverage = json.loads((DATA_DIR / "coverage.json").read_text())
    manifest = json.loads((DATA_DIR / "sources.json").read_text())
    for name, source in manifest.items():
        if (DATA_DIR / name).exists():
            assert hashlib.sha256((DATA_DIR / name).read_bytes()).hexdigest() == source["sha256"]
    assert coverage["countries"] == len(countries)
    assert coverage["subdivisions"] == len(regions)
    for locale in ("en", "ru", "kk"):
        summary = coverage["languages"][locale]
        assert summary["country_names"] == sum(locale in r["translations"] for r in countries)
        assert summary["subdivision_names"] == sum(locale in r["translations"] for r in regions)
        assert summary["missing_subdivision_names"] == sum(locale not in r["translations"] for r in regions)
        assert summary["subdivision_sources"] == dict(Counter(
            r["translation_sources"][locale] for r in regions if locale in r["translations"]
        ))
    for region in regions:
        assert set(region["translations"]) == set(region["translation_sources"])
        assert set(region["translation_sources"].values()) <= manifest.keys()
    assert coverage["languages"]["kk"]["subdivision_names"] == 866
    assert all("kk" in r["translations"] for r in regions if r["country_code"] == "KZ")


def test_curated_labels_match_active_source_statements_and_reject_wrong_mappings():
    import importlib.util
    import json
    from pathlib import Path

    from seed_reference_geo import DATA_DIR

    script = Path(__file__).resolve().parents[4] / "scripts/build_geography.py"
    spec = importlib.util.spec_from_file_location("build_geography", script)
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    supplemental = json.loads((DATA_DIR / "supplemental-kk.json").read_text())
    corrections = json.loads((DATA_DIR / "label-corrections.json").read_text())
    builder.validate_curated_labels(supplemental, corrections)
    with pytest.raises(ValueError, match="Unverified kk label"):
        builder.validate_curated_labels({"MA-08": {
            "source_code": "MA-08", "source": "http://www.wikidata.org/entity/Q478222",
            "name": "Үлкен Касабланка",
        }}, {})
    with pytest.raises(ValueError, match="Source code mismatch"):
        builder.validate_curated_labels({"RU-SAM": {**supplemental["RU-SAM"], "source_code": "RU-MOS"}}, {})
    regions = {r["code"]: r for r in load_reference_data()[1]}
    assert regions["MA-08"]["translations"]["en"] == "Drâa-Tafilalet"
    assert regions["MA-02"]["translations"]["en"] == "Oriental"
    assert "kk" not in regions["MA-02"]["translations"]

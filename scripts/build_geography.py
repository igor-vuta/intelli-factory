"""Rebuild the checked-in geography snapshot from pinned upstream sources."""

import argparse
from collections import Counter
import gettext
import hashlib
import json
from pathlib import Path
import shutil
from urllib.request import urlopen
import xml.etree.ElementTree as ET

ISO_REV = "4c6a69927a25326a69bf753671fb571bb437cd7d"
CLDR_REV = "release-48-2"
OUTPUT = Path(__file__).resolve().parents[1] / "backend/app/api/data/geography"
ISO_BASE = f"https://raw.githubusercontent.com/pycountry/pycountry/{ISO_REV}"
CLDR_BASE = f"https://raw.githubusercontent.com/unicode-org/cldr/{CLDR_REV}"
SOURCES = {
    **{f"iso3166-{n}.json": f"{ISO_BASE}/src/pycountry/databases/iso3166-{n}.json" for n in (1, 2)},
    **{f"{kind}-{lang}.xml": f"{CLDR_BASE}/common/{kind}/{lang}.xml"
       for kind in ("main", "subdivisions") for lang in ("en", "ru", "kk")},
    "iso-ru.mo": f"{ISO_BASE}/src/pycountry/locales/ru/LC_MESSAGES/iso3166-2.mo",
    "iso-LICENSE.txt": f"{ISO_BASE}/LICENSE.txt",
    "iso-COPYRIGHT.txt": f"{ISO_BASE}/COPYRIGHT.txt",
    "unicode-LICENSE.txt": f"{CLDR_BASE}/LICENSE",
}


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def names(path, tag):
    return {row.attrib["type"]: row.text for row in ET.parse(path).findall(f".//{tag}")
            if "alt" not in row.attrib and row.text not in (None, "↑↑↑", "∅∅∅")}


def validate_curated_labels(extra_kk, corrections):
    snapshot = json.loads((OUTPUT / "wikidata-snapshot.json").read_text())
    for entries, statements in (
        (extra_kk, snapshot["kazakh_statements"]),
        (corrections, snapshot["morocco_statements"]),
    ):
        for code, entry in entries.items():
            if entry["source_code"] != code:
                raise ValueError(f"Source code mismatch: {code}")
            labels = entry.get("translations", {"kk": entry.get("name")})
            for locale, name in labels.items():
                if not any(
                    row["code"]["value"] == code
                    and row["item"]["value"] == entry["source"]
                    and row["name"]["value"] == name
                    and row["name"]["xml:lang"] == locale
                    and "ended" not in row
                    and not row["rank"]["value"].endswith("DeprecatedRank")
                    for row in statements
                ):
                    raise ValueError(f"Unverified {locale} label: {code}")


def build(source_dir):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    country_names = {lang: names(source_dir / f"main-{lang}.xml", "territory") for lang in ("en", "ru", "kk")}
    region_names = {lang: names(source_dir / f"subdivisions-{lang}.xml", "subdivision") for lang in ("en", "ru", "kk")}
    with (source_dir / "iso-ru.mo").open("rb") as stream:
        russian = gettext.GNUTranslations(stream)
    extra_ru = json.loads((OUTPUT / "supplemental-ru.json").read_text())
    extra_kk = json.loads((OUTPUT / "supplemental-kk.json").read_text())
    corrections = json.loads((OUTPUT / "label-corrections.json").read_text())
    validate_curated_labels(extra_kk, corrections)
    countries = []
    for row in json.loads((source_dir / "iso3166-1.json").read_text())["3166-1"]:
        code = row["alpha_2"]
        translations = {lang: values[code] for lang, values in country_names.items() if code in values}
        countries.append({"iso2": code, "iso3": row["alpha_3"],
                          "default_name": translations.get("en", row["name"]), "translations": translations})
    regions = []
    for row in json.loads((source_dir / "iso3166-2.json").read_text())["3166-2"]:
        code = row["code"]
        cldr_code = code.replace("-", "").lower()
        translations = {lang: values[cldr_code] for lang, values in region_names.items() if cldr_code in values}
        translation_sources = {lang: f"subdivisions-{lang}.xml" for lang in translations}
        if "ru" not in translations:
            name = russian.gettext(row["name"])
            if name != row["name"]:
                translations["ru"] = name
                translation_sources["ru"] = "iso-ru.mo"
            elif code in extra_ru:
                translations["ru"] = extra_ru[code]["name"]
                translation_sources["ru"] = "supplemental-ru.json"
        if "kk" not in translations and code in extra_kk:
            translations["kk"] = extra_kk[code]["name"]
            translation_sources["kk"] = "supplemental-kk.json"
        if code in corrections:
            # Reassigned ISO codes must not retain labels for the former region.
            translations = dict(corrections[code]["translations"])
            translation_sources = {lang: "label-corrections.json" for lang in translations}
        if "en" not in translations:
            translation_sources["en"] = "iso3166-2.json"
        default_name = translations.setdefault("en", row["name"])
        regions.append({"country_code": code[:2], "code": code, "default_name": default_name,
                        "type": row["type"], "parent": row.get("parent"), "translations": translations,
                        "translation_sources": translation_sources})
    write_json(OUTPUT / "countries.json", sorted(countries, key=lambda row: row["iso2"]))
    write_json(OUTPUT / "regions.json", sorted(regions, key=lambda row: row["code"]))
    manifest = {name: {"url": url, "sha256": hashlib.sha256((source_dir / name).read_bytes()).hexdigest()}
                for name, url in SOURCES.items()}
    for name in ("supplemental-ru.json", "supplemental-kk.json", "label-corrections.json", "wikidata-snapshot.json"):
        manifest[name] = {
            "url": "https://www.wikidata.org/wiki/Property:P300",
            "sha256": hashlib.sha256((OUTPUT / name).read_bytes()).hexdigest(),
            "retrieved": "2026-09-14", "license": "CC0-1.0",
        }
    write_json(OUTPUT / "sources.json", manifest)
    write_json(OUTPUT / "coverage.json", {
        "countries": len(countries), "subdivisions": len(regions),
        "languages": {lang: {
            "country_names": sum(lang in row["translations"] for row in countries),
            "subdivision_names": sum(lang in row["translations"] for row in regions),
            "missing_subdivision_names": sum(lang not in row["translations"] for row in regions),
            "subdivision_sources": dict(sorted(Counter(
                row["translation_sources"][lang] for row in regions if lang in row["translations"]
            ).items())),
        } for lang in ("en", "ru", "kk")},
    })
    for name in ("iso-LICENSE.txt", "iso-COPYRIGHT.txt", "unicode-LICENSE.txt"):
        shutil.copyfile(source_dir / name, OUTPUT / name)
    for lang in ("en", "ru", "kk"):
        print(lang, "countries", sum(lang in row["translations"] for row in countries),
              "subdivisions", sum(lang in row["translations"] for row in regions))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    args.source_dir.mkdir(parents=True, exist_ok=True)
    if args.download:
        for filename, url in SOURCES.items():
            with urlopen(url, timeout=60) as response:
                (args.source_dir / filename).write_bytes(response.read())
    build(args.source_dir)

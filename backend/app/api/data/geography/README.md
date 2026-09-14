# Geography reference data

This snapshot contains 249 ISO 3166-1 countries and territories and 5,046 ISO
3166-2 administrative subdivisions. Subdivisions include states, provinces,
regions and other ISO-coded administrative levels; the source `type` and `parent`
are retained in JSON. Some territories have no ISO subdivisions, so manual region
entry remains available. Cities are entered by users; this is not a global city dataset.

Country names are available in English, Russian and Kazakh. Subdivision coverage:

| Language | Names | English fallback |
| -------- | ----: | ---------------: |
| English  | 5,046 |                0 |
| Russian  | 4,921 |              125 |
| Kazakh   |   866 |            4,180 |

The English column includes 19 source-name fallbacks (mostly Kazakh Latin-script
names such as `Aqmola oblysy`), not 5,046 verified English translations.
`coverage.json` records counts by source, and each region's `translation_sources`
identifies the source used for each language.

Missing translations are not represented as translated text. The API falls back
to English, then the source name. CLDR includes provisional subdivision names;
these are reference labels, not a claim of legal authority over borders or names.

## Sources and licenses

- Country/subdivision codes: [pycountry](https://github.com/pycountry/pycountry),
  commit `4c6a69927a25326a69bf753671fb571bb437cd7d`, based on Debian iso-codes.
  Additional Russian names use its gettext catalog. Original copyright and
  LGPL license notices are in `iso-COPYRIGHT.txt` and `iso-LICENSE.txt`.
- Localized display names: [Unicode CLDR 48.2](https://github.com/unicode-org/cldr/tree/release-48-2),
  under the Unicode license included in `unicode-LICENSE.txt`.
- Supplementary Russian and Kazakh labels: Wikidata public structured data, retrieved
  2026-09-14, under [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing).
  `supplemental-ru.json` and `supplemental-kk.json` retain entity URLs.
  Labels match ISO 3166-2 codes (P300) and only fill missing translations.
  `wikidata-snapshot.json` preserves the queried Kazakh and Moroccan statements;
  the builder verifies curated names against non-deprecated statements without
  an end date. `label-corrections.json` replaces obsolete CLDR labels for the
  12 Moroccan region codes reassigned after the 2015 reform.

`sources.json` records upstream URLs and SHA-256 checksums. Runtime seeding uses
only the bundled files; it makes no requests to a paid geography or translation API.

## Kazakh coverage review (2026-09-14)

Wikidata supplied 37 additional Kazakh labels. Eight existing CLDR Kazakh labels
referred to former Moroccan regions and were removed, for a net gain of 29.
The Aghdam district entity was selected over a city entity sharing `AZ-AGM`,
matching the ISO subdivision type. Deprecated or ended mappings were excluded.
The pinned CLDR subdivision aliases, current CLDR Kazakh file and Kazakh Wikipedia
sitelinks supplied no further usable names. The pinned pycountry revision has no
Kazakh subdivision gettext catalog.

All 20 Kazakhstan subdivisions have Kazakh names. The current [National Bureau
of Statistics list](https://stat.gov.kz/industries/socialstatistics/demography/publications/513339/)
confirms the 17 regions and three cities of republican significance.
Worldwide completion still needs a broader Kazakh gazetteer or reviewed translation
work; unsourced transliteration is not treated as a Kazakh translation.

## Refresh

From the repository root:

```sh
uv run --no-project python scripts/build_geography.py --source-dir /tmp/intelli-geo-sources --download
npx prettier --write backend/app/api/data/geography/*.json
```

The curated Wikidata files are intentionally frozen. To extend them, query P300
statements and labels, keep the evidence snapshot, exclude deprecated/ended
statements, check the administrative entity and update the curated entry. A
matching code alone is insufficient when codes have been reassigned. Rebuild the
source manifest after formatting curated JSON so its file checksums stay valid.

Review changes to codes, parent relationships and names, and update the pinned
source revision deliberately. Existing country and region IDs and inactive flags
are preserved by the transactional importer. It never deletes custom regions,
cities, addresses or countries that disappear from a later source snapshot.

Run `python seed_reference_geo.py` in the backend container after taking the
database backup described in `deploy/oracle/README.md`. Repeating the import does
not create duplicate reference rows. Kazakh country names and available region
names work now; 4,180 subdivisions still lack sourced Kazakh names.

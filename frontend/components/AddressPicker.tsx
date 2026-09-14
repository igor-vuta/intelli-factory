import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

import { getAddressBootstrap } from '../lib/authClient';
import type { CountryItem } from '../lib/authClient';
import { getLocaleFromQuery } from '../lib/i18n';

const labels = {
  en: {
    country: 'Country',
    selectCountry: 'Select country…',
    region: 'Region',
    loading: 'Loading regions…',
    selectRegion: 'Select or type a region…',
    regionExample: 'e.g. Almaty Region',
    city: 'City',
    selectCity: 'Select or type a city…',
    cityExample: 'e.g. Almaty',
    street: 'Street',
    streetExample: 'Abay Ave 10',
    postal: 'Postal code',
    optional: 'optional',
  },
  ru: {
    country: 'Страна',
    selectCountry: 'Выберите страну…',
    region: 'Регион',
    loading: 'Загрузка регионов…',
    selectRegion: 'Выберите или введите регион…',
    regionExample: 'Например, Алматинская область',
    city: 'Город',
    selectCity: 'Выберите или введите город…',
    cityExample: 'Например, Алматы',
    street: 'Улица и дом',
    streetExample: 'Проспект Абая, 10',
    postal: 'Почтовый индекс',
    optional: 'необязательно',
  },
  kk: {
    country: 'Ел',
    selectCountry: 'Елді таңдаңыз…',
    region: 'Өңір',
    loading: 'Өңірлер жүктелуде…',
    selectRegion: 'Өңірді таңдаңыз немесе енгізіңіз…',
    regionExample: 'Мысалы, Алматы облысы',
    city: 'Қала',
    selectCity: 'Қаланы таңдаңыз немесе енгізіңіз…',
    cityExample: 'Мысалы, Алматы',
    street: 'Көше және үй',
    streetExample: 'Абай даңғылы, 10',
    postal: 'Пошта индексі',
    optional: 'міндетті емес',
  },
};

export type AddressValue = {
  countryCode: string;
  regionName: string;
  cityName: string;
  street: string;
  postalCode?: string;
};

type RegionItem = { code: string; name: string };
type CityItem = { id: string; name: string; region_code: string };

type AddressPickerProps = {
  value: AddressValue | null;
  onChange: (v: AddressValue) => void;
  countries: CountryItem[];
  countriesLoading?: boolean;
  required?: boolean;
};

const INPUT_CLS =
  'focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm';

export default function AddressPicker({
  value,
  onChange,
  countries,
  countriesLoading,
  required,
}: AddressPickerProps) {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = labels[locale];
  const fieldId = useId();
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [cities, setCities] = useState<CityItem[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const countryCode = value?.countryCode ?? '';
  const regionName = value?.regionName ?? '';
  const cityName = value?.cityName ?? '';
  const street = value?.street ?? '';
  const postalCode = value?.postalCode ?? '';

  useEffect(() => {
    if (!countryCode) return;
    let active = true;

    async function run() {
      setLoadingGeo(true);
      try {
        const data = await getAddressBootstrap(countryCode, locale);
        if (!active) return;
        setRegions(data.regions);
        setCities(data.cities);
      } catch {
        if (!active) return;
        setRegions([]);
        setCities([]);
      } finally {
        if (active) setLoadingGeo(false);
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [countryCode, locale]);

  const sortedCountries = useMemo(
    () => [...countries].sort((a, b) => a.label.localeCompare(b.label, locale)),
    [countries, locale]
  );

  const filteredCities = useMemo(() => {
    if (!regionName || regions.length === 0) return cities;
    const matched = regions.find((r) => r.name.toLowerCase() === regionName.toLowerCase());
    return matched ? cities.filter((c) => c.region_code === matched.code) : cities;
  }, [regionName, regions, cities]);

  function update(partial: Partial<AddressValue>) {
    onChange({
      countryCode,
      regionName,
      cityName,
      street,
      postalCode: postalCode || undefined,
      ...partial,
    });
  }

  const country = countries.find((c) => c.code === countryCode);
  const regionLabel = regionName;
  const preview = [street, cityName, regionLabel, country?.label].filter(Boolean).join(', ');

  const hasRegionData = regions.length > 0;
  const hasCityData = filteredCities.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Country */}
      <div>
        <label
          htmlFor={`${fieldId}-country`}
          className="mb-1 block text-sm text-[rgb(var(--muted))]"
        >
          {copy.country} {required && <span className="text-red-400">*</span>}
        </label>
        <select
          id={`${fieldId}-country`}
          value={countryCode}
          onChange={(e) =>
            update({ countryCode: e.target.value, regionName: '', cityName: '', street: '' })
          }
          required={required}
          disabled={countriesLoading || countries.length === 0}
          className={INPUT_CLS}
        >
          <option value="">{copy.selectCountry}</option>
          {sortedCountries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Region - dropdown if data exists, text input otherwise */}
      {countryCode && (
        <div>
          <label
            htmlFor={`${fieldId}-region`}
            className="mb-1 block text-sm text-[rgb(var(--muted))]"
          >
            {copy.region} {required && <span className="text-red-400">*</span>}
          </label>
          {loadingGeo ? (
            <div className={`${INPUT_CLS} text-[rgb(var(--muted))]`}>{copy.loading}</div>
          ) : (
            <>
              <input
                id={`${fieldId}-region`}
                list={`${fieldId}-regions`}
                type="text"
                value={regionName}
                onChange={(e) => update({ regionName: e.target.value, cityName: '' })}
                required={required}
                placeholder={hasRegionData ? copy.selectRegion : copy.regionExample}
                className={INPUT_CLS}
                autoComplete="off"
              />
              {hasRegionData && (
                <datalist id={`${fieldId}-regions`}>
                  {regions.map((r) => (
                    <option key={r.code} value={r.name} />
                  ))}
                </datalist>
              )}
            </>
          )}
        </div>
      )}

      {/* City - dropdown if data exists, text input otherwise */}
      {regionName && (
        <div>
          <label
            htmlFor={`${fieldId}-city`}
            className="mb-1 block text-sm text-[rgb(var(--muted))]"
          >
            {copy.city} {required && <span className="text-red-400">*</span>}
          </label>
          <>
            <input
              id={`${fieldId}-city`}
              list={`${fieldId}-cities`}
              type="text"
              value={cityName}
              onChange={(e) => update({ cityName: e.target.value })}
              required={required}
              placeholder={hasCityData ? copy.selectCity : copy.cityExample}
              className={INPUT_CLS}
              autoComplete="off"
            />
            {hasCityData && (
              <datalist id={`${fieldId}-cities`}>
                {filteredCities.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            )}
          </>
        </div>
      )}

      {/* Street */}
      {cityName && (
        <>
          <div>
            <label
              htmlFor={`${fieldId}-street`}
              className="mb-1 block text-sm text-[rgb(var(--muted))]"
            >
              {copy.street} {required && <span className="text-red-400">*</span>}
            </label>
            <input
              id={`${fieldId}-street`}
              type="text"
              value={street}
              onChange={(e) => update({ street: e.target.value })}
              required={required}
              placeholder={copy.streetExample}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label
              htmlFor={`${fieldId}-postal`}
              className="mb-1 block text-sm text-[rgb(var(--muted))]"
            >
              {copy.postal} <span className="text-[rgb(var(--muted))]">({copy.optional})</span>
            </label>
            <input
              id={`${fieldId}-postal`}
              type="text"
              value={postalCode}
              onChange={(e) => update({ postalCode: e.target.value || undefined })}
              placeholder="050000"
              className={INPUT_CLS}
            />
          </div>
        </>
      )}

      {/* Live preview */}
      {preview && (
        <p className="rounded-lg border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
          {preview}
        </p>
      )}
    </div>
  );
}

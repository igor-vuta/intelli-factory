import ChoiceField from './ChoiceField';
import SelectField from './SelectField';
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
    customCity:
      'City not listed? Type its full name and continue. You do not need to choose a suggestion.',
    customRegion: 'Region not listed? Type its full name and continue.',
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
    customCity:
      'Нет вашего города? Введите полное название и продолжайте. Выбирать подсказку необязательно.',
    customRegion: 'Нет вашего региона? Введите полное название и продолжайте.',
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
    customCity:
      'Қалаңыз тізімде жоқ па? Толық атауын жазып, жалғастырыңыз. Ұсынылған нұсқаны таңдау міндетті емес.',
    customRegion: 'Өңіріңіз тізімде жоқ па? Толық атауын жазып, жалғастырыңыз.',
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
        <SelectField
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
        </SelectField>
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
              <ChoiceField
                id={`${fieldId}-region`}
                options={regions.map((r) => ({ id: r.name, label: r.name }))}
                value={regionName}
                text={regionName}
                onSelect={(_id, label) => update({ regionName: label, cityName: '' })}
                onTextChange={(value) => update({ regionName: value, cityName: '' })}
                required={required}
                placeholder={hasRegionData ? copy.selectRegion : copy.regionExample}
                emptyMessage={copy.customRegion}
                aria-describedby={`${fieldId}-region-hint`}
                className={INPUT_CLS}
              />
              <p id={`${fieldId}-region-hint`} className="guidance-hint">
                {copy.customRegion}
              </p>
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
            <ChoiceField
              id={`${fieldId}-city`}
              options={filteredCities.map((c) => ({ id: c.name, label: c.name }))}
              value={cityName}
              text={cityName}
              onSelect={(_id, label) => update({ cityName: label })}
              onTextChange={(value) => update({ cityName: value })}
              required={required}
              placeholder={hasCityData ? copy.selectCity : copy.cityExample}
              emptyMessage={copy.customCity}
              aria-describedby={`${fieldId}-city-hint`}
              className={INPUT_CLS}
            />
            <p id={`${fieldId}-city-hint`} className="guidance-hint">
              {copy.customCity}
            </p>
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

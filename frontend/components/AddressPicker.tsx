import { useEffect, useMemo, useState } from 'react';

import { getAddressBootstrap } from '../lib/authClient';
import type { CountryItem } from '../lib/authClient';

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
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [cities, setCities] = useState<CityItem[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const countryCode = value?.countryCode ?? '';
  const regionName = value?.regionName ?? '';
  const cityName = value?.cityName ?? '';
  const street = value?.street ?? '';
  const postalCode = value?.postalCode ?? '';

  // When country changes, load regions + cities
  useEffect(() => {
    if (!countryCode) return;
    let active = true;

    async function run() {
      setLoadingGeo(true);
      try {
        const data = await getAddressBootstrap(countryCode);
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
  }, [countryCode]);

  // Derive filtered cities from selected region (no effect needed)
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
        <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
          Country {required && <span className="text-red-400">*</span>}
        </label>
        <select
          value={countryCode}
          onChange={(e) =>
            update({ countryCode: e.target.value, regionName: '', cityName: '', street: '' })
          }
          required={required}
          disabled={countriesLoading || countries.length === 0}
          className={INPUT_CLS}
        >
          <option value="">Select country…</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Region — dropdown if data exists, text input otherwise */}
      {countryCode && (
        <div>
          <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
            Region {required && <span className="text-red-400">*</span>}
          </label>
          {loadingGeo ? (
            <div className={`${INPUT_CLS} text-[rgb(var(--muted))]`}>Loading regions…</div>
          ) : (
            <>
              <input
                list="region-list"
                type="text"
                value={regionName}
                onChange={(e) => update({ regionName: e.target.value, cityName: '' })}
                required={required}
                placeholder={hasRegionData ? 'Select or type a region…' : 'e.g. Almaty Region'}
                className={INPUT_CLS}
                autoComplete="off"
              />
              {hasRegionData && (
                <datalist id="region-list">
                  {regions.map((r) => (
                    <option key={r.code} value={r.name} />
                  ))}
                </datalist>
              )}
            </>
          )}
        </div>
      )}

      {/* City — dropdown if data exists, text input otherwise */}
      {regionName && (
        <div>
          <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
            City {required && <span className="text-red-400">*</span>}
          </label>
          <>
            <input
              list="city-list"
              type="text"
              value={cityName}
              onChange={(e) => update({ cityName: e.target.value })}
              required={required}
              placeholder={hasCityData ? 'Select or type a city…' : 'e.g. Almaty'}
              className={INPUT_CLS}
              autoComplete="off"
            />
            {hasCityData && (
              <datalist id="city-list">
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
            <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
              Street {required && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={street}
              onChange={(e) => update({ street: e.target.value })}
              required={required}
              placeholder="Abay Ave 10"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
              Postal code <span className="text-[rgb(var(--muted))]">(optional)</span>
            </label>
            <input
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

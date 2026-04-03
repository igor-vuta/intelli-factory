import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import Combobox, { type ComboboxOption } from '../../components/Combobox';
import {
  createLogisticOffer,
  createLogistQuote,
  getFactoryBidsNeedingLogistics,
  getRequestsBootstrap,
  listMyLogisticOffers,
  logout,
  me,
  type BootstrapCurrency,
  type LogisticOfferItem,
  type MatchCandidate,
} from '../../lib/authClient';
import { getLocaleFromQuery, t } from '../../lib/i18n';
import { THEME_CLASSES, type Theme } from '../../styles/themePresets';

// ── Quote modal ───────────────────────────────────────────────────────────────

type QuoteModalProps = {
  bid: MatchCandidate;
  myOffers: LogisticOfferItem[];
  onClose: () => void;
  onQuoted: () => Promise<void>;
};

function QuoteModal({ bid, myOffers, onClose, onQuoted }: QuoteModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [offerIdSelected, setOfferIdSelected] = useState(myOffers[0]?.id ?? '');
  const [deliveryPrice, setDeliveryPrice] = useState('40');
  const [deliveryDays, setDeliveryDays] = useState('3');

  useEffect(() => {
    setOfferIdSelected(myOffers[0]?.id ?? '');
  }, [myOffers]);

  const offerOptions = useMemo<ComboboxOption[]>(
    () =>
      myOffers.map((o) => ({
        id: o.id,
        label: `${o.title} - base ${o.base_price} ${o.currency_code}`,
      })),
    [myOffers]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const dp = Number(deliveryPrice);
    const dd = Number(deliveryDays);
    if (!offerIdSelected) {
      setError('Select a logistic offer');
      return;
    }
    if (!Number.isFinite(dp) || dp < 0) {
      setError('Delivery price must be >= 0');
      return;
    }
    if (!Number.isFinite(dd) || dd < 1) {
      setError('Delivery days must be >= 1');
      return;
    }

    setSubmitting(true);
    try {
      await createLogistQuote({
        factory_bid_id: bid.id,
        logistic_offer_id: offerIdSelected,
        delivery_price: dp,
        delivery_days: dd,
      });
      setSuccess('Quote submitted!');
      await onQuoted();
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit quote');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] p-6 shadow-2xl sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Quote Delivery</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Factory: {bid.factory_legal_name ?? 'N/A'} - Item: {bid.item_name ?? 'N/A'}
              {' - '}
              {bid.quoted_quantity} units @ {bid.inventory_price_per_unit} {bid.currency_code}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/40"
          >
            \u00d7
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {myOffers.length === 0 && (
            <p className="rounded-lg bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
              No logistics offers are available. Create one first, then return to quoting.
            </p>
          )}

          <Combobox
            options={offerOptions}
            value={offerIdSelected}
            onChange={setOfferIdSelected}
            placeholder="Select your logistic offer to use"
            label="Your logistic offer"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[rgb(var(--muted))]">
                Delivery price ({bid.currency_code}) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={deliveryPrice}
                onChange={(e) => setDeliveryPrice(e.target.value)}
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[rgb(var(--muted))]">
                Delivery days <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          {bid.factory_note && (
            <p className="rounded-lg bg-[rgb(var(--panel))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
              Factory note: {bid.factory_note}
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              {success}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || myOffers.length === 0}
              className="btn btn-primary flex-1 text-sm"
            >
              {submitting ? 'Submitting...' : 'Submit Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LogistWorkspacePage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme] = useState<Theme>('midnightCore');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currencies, setCurrencies] = useState<BootstrapCurrency[]>([]);
  const [offers, setOffers] = useState<LogisticOfferItem[]>([]);
  const [factoryBids, setFactoryBids] = useState<MatchCandidate[]>([]);
  const [quoteTarget, setQuoteTarget] = useState<MatchCandidate | null>(null);

  // offer form state
  const [title, setTitle] = useState('Regional courier offer');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('50');
  const [pricePerKm, setPricePerKm] = useState('1.5');
  const [pricePerKg, setPricePerKg] = useState('0.8');
  const [estimatedDaysMin, setEstimatedDaysMin] = useState('2');
  const [estimatedDaysMax, setEstimatedDaysMax] = useState('5');
  const [reliabilityScore, setReliabilityScore] = useState('0.92');
  const [currencyCode, setCurrencyCode] = useState('USD');

  const refreshOffers = useCallback(async () => {
    const rows = await listMyLogisticOffers();
    setOffers(rows);
  }, []);

  const refreshFactoryBids = useCallback(async () => {
    const rows = await getFactoryBidsNeedingLogistics();
    setFactoryBids(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const auth = await me();
        if (auth.user.role !== 'LOGIST') {
          await router.replace(`/login?lang=${locale}`);
          return;
        }
        const [bootstrap, rows, bids] = await Promise.all([
          getRequestsBootstrap(),
          listMyLogisticOffers(),
          getFactoryBidsNeedingLogistics(),
        ]);
        if (cancelled) return;
        setCurrencies(bootstrap.currencies);
        setOffers(rows);
        setFactoryBids(bids);
        if (bootstrap.currencies[0]) setCurrencyCode(bootstrap.currencies[0].code);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workspace');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [locale, router]);

  useEffect(() => {
    if (loading) return;

    const intervalId = window.setInterval(() => {
      void refreshFactoryBids();
      void refreshOffers();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loading, refreshFactoryBids, refreshOffers]);

  async function handleLogout() {
    await logout();
    await router.push(`/login?lang=${locale}`);
  }

  async function handleCreateOffer(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsedBasePrice = Number(basePrice);
    const parsedReliability = Number(reliabilityScore);
    const parsedDaysMin = Number(estimatedDaysMin);
    const parsedDaysMax = Number(estimatedDaysMax);
    const parsedPricePerKm = Number(pricePerKm);
    const parsedPricePerKg = Number(pricePerKg);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0) {
      setError('Base price must be >= 0');
      return;
    }
    if (!Number.isFinite(parsedPricePerKm) || parsedPricePerKm < 0) {
      setError('Price per km must be >= 0');
      return;
    }
    if (!Number.isFinite(parsedPricePerKg) || parsedPricePerKg < 0) {
      setError('Price per kg must be >= 0');
      return;
    }
    if (!Number.isFinite(parsedReliability) || parsedReliability < 0 || parsedReliability > 1) {
      setError('Reliability must be 0-1');
      return;
    }
    if (!Number.isFinite(parsedDaysMin) || parsedDaysMin < 1) {
      setError('Min days must be >= 1');
      return;
    }
    if (!Number.isFinite(parsedDaysMax) || parsedDaysMax < 1) {
      setError('Max days must be >= 1');
      return;
    }
    if (parsedDaysMin > parsedDaysMax) {
      setError('Min days cannot exceed max days');
      return;
    }
    if (!currencyCode) {
      setError('Select a currency');
      return;
    }

    setSubmitting(true);
    try {
      await createLogisticOffer({
        title: title.trim(),
        description: description.trim() || undefined,
        base_price: parsedBasePrice,
        price_per_km: parsedPricePerKm,
        price_per_kg: parsedPricePerKg,
        estimated_days_min: parsedDaysMin,
        estimated_days_max: parsedDaysMax,
        reliability_score: parsedReliability,
        currency_code: currencyCode,
      });
      setSuccess('Logistic offer created');
      await refreshOffers();
      await refreshFactoryBids();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create offer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className={`${THEME_CLASSES[theme]} min-h-screen bg-[rgb(var(--bg))] px-4 py-8 text-[rgb(var(--text))] sm:px-8`}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[rgb(var(--muted))]"
          >
            <Image
              src="/presets/logo.svg"
              alt="Intelli-Factory logo"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md"
              unoptimized
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span>{copy.brand}</span>
          </Link>
          <button type="button" onClick={handleLogout} className="btn btn-ghost text-sm">
            {copy.logout}
          </button>
        </header>

        {loading && <p className="text-sm text-[rgb(var(--muted))]">Loading workspace\u2026</p>}
        {error && (
          <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        {!loading && (
          <>
            {/* ── Factory Bids Needing Logistics ──────────────────────── */}
            <section className="surface-1 rounded-2xl p-6 sm:p-8">
              <h1 className="text-2xl font-semibold sm:text-3xl">Logistics Workspace</h1>
              <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                Quote delivery for factory bids. Each quote you add becomes a complete proposal
                visible to the customer.
              </p>

              <h2 className="mt-6 text-lg font-semibold">Factory Bids Needing Your Quote</h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                Factories have responded to requests below. Add a delivery quote to create a
                complete proposal. Multiple quotes allowed per bid (different offers = different
                proposals for the customer).
              </p>

              {offers.length === 0 ? (
                <p className="mt-3 rounded-lg bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
                  Create at least one logistics offer below before you can quote delivery.
                </p>
              ) : factoryBids.length === 0 ? (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  No factory bids waiting for logistics quotes at this time.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                        <th className="py-2 pr-4">Request item</th>
                        <th className="py-2 pr-4">Factory</th>
                        <th className="py-2 pr-4">Qty offered</th>
                        <th className="py-2 pr-4">Goods cost</th>
                        <th className="py-2 pr-4">Factory note</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {factoryBids.map((bid) => {
                        const goodsCost =
                          bid.quoted_quantity && bid.inventory_price_per_unit
                            ? (
                                parseFloat(bid.quoted_quantity) *
                                parseFloat(bid.inventory_price_per_unit)
                              ).toFixed(2)
                            : '\u2014';
                        return (
                          <tr key={bid.id} className="border-b border-[rgb(var(--stroke))]/40">
                            <td className="py-2 pr-4 font-medium">{bid.item_name ?? '\u2014'}</td>
                            <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                              {bid.factory_legal_name ?? '\u2014'}
                            </td>
                            <td className="py-2 pr-4">{bid.quoted_quantity ?? '\u2014'}</td>
                            <td className="py-2 pr-4">
                              {goodsCost} {bid.currency_code}
                            </td>
                            <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                              {bid.factory_note ?? '\u2014'}
                            </td>
                            <td className="py-2">
                              <button
                                type="button"
                                onClick={() => setQuoteTarget(bid)}
                                className="rounded-md border border-emerald-700/60 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-950/30"
                              >
                                Quote Delivery
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── My Logistic Offers ───────────────────────────────────── */}
            <section className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 className="text-lg font-semibold">Add Logistic Offer</h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                Define delivery capability that can be reused across quotes.
              </p>

              {success && (
                <p className="mt-3 rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
                  {success}
                </p>
              )}

              <form onSubmit={handleCreateOffer} className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Base price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                    Price per km
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerKm}
                    onChange={(e) => setPricePerKm(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                    Price per kg
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                    Est. min days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={estimatedDaysMin}
                    onChange={(e) => setEstimatedDaysMin(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                    Est. max days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={estimatedDaysMax}
                    onChange={(e) => setEstimatedDaysMax(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                    Reliability (0\u20131)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={reliabilityScore}
                    onChange={(e) => setReliabilityScore(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Currency</label>
                  <select
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    required
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} \u2014 {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={submitting || currencies.length === 0}
                  className="btn btn-primary sm:col-span-2 text-sm"
                >
                  {submitting ? 'Creating...' : 'Add Logistic Offer'}
                </button>
              </form>

              {currencies.length === 0 && (
                <p className="mt-3 rounded-lg bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
                  No currencies available in bootstrap data. Registration and quoting require at
                  least one currency.
                </p>
              )}

              {offers.length > 0 && (
                <div className="mt-6 overflow-x-auto">
                  <h3 className="mb-2 text-sm font-medium text-[rgb(var(--muted))]">
                    My logistic offers
                  </h3>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                        <th className="py-2 pr-3">Title</th>
                        <th className="py-2 pr-3">Base</th>
                        <th className="py-2 pr-3">Days</th>
                        <th className="py-2 pr-3">Reliability</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offers.map((o) => (
                        <tr key={o.id} className="border-b border-[rgb(var(--stroke))]/40">
                          <td className="py-2 pr-3">{o.title}</td>
                          <td className="py-2 pr-3">
                            {o.base_price} {o.currency_code}
                          </td>
                          <td className="py-2 pr-3">
                            {o.estimated_days_min ?? '-'}-{o.estimated_days_max ?? '-'}
                          </td>
                          <td className="py-2 pr-3">{o.reliability_score}</td>
                          <td className="py-2">{o.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {quoteTarget && (
        <QuoteModal
          bid={quoteTarget}
          myOffers={offers}
          onClose={() => setQuoteTarget(null)}
          onQuoted={async () => {
            await refreshFactoryBids();
          }}
        />
      )}
    </main>
  );
}

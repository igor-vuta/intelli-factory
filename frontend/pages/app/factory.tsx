import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import Combobox, { type ComboboxOption } from '../../components/Combobox';
import SearchableInput from '../../components/SearchableInput';
import {
  createFactoryBid,
  createInventoryEntry,
  getOpenRequests,
  getRequestsBootstrap,
  listMyFactoryBids,
  listMyInventoryEntries,
  logout,
  me,
  type BootstrapAddress,
  type BootstrapCategory,
  type BootstrapCurrency,
  type BootstrapItem,
  type InventoryEntryItem,
  type MatchCandidate,
  type OpenRequest,
} from '../../lib/authClient';
import { getLocaleFromQuery, t } from '../../lib/i18n';
import { THEME_CLASSES, type Theme } from '../../styles/themePresets';

// ── Bid modal ────────────────────────────────────────────────────────────────

type BidModalProps = {
  request: OpenRequest;
  inventory: InventoryEntryItem[];
  onClose: () => void;
  onBidPlaced: () => Promise<void>;
};

function BidModal({ request, inventory, onClose, onBidPlaced }: BidModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inventoryId, setInventoryId] = useState(inventory[0]?.id ?? '');
  const [quotedQty, setQuotedQty] = useState(request.quantity);
  const [note, setNote] = useState('');

  const inventoryOptions = useMemo<ComboboxOption[]>(
    () =>
      inventory.map((i) => ({
        id: i.id,
        label: `${i.item_name} @${i.price_per_unit} ${i.currency_code} (${i.quantity_available} available)`,
      })),
    [inventory]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = Number(quotedQty);
    if (!inventoryId) {
      setError('Select an inventory entry');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be > 0');
      return;
    }

    setSubmitting(true);
    try {
      await createFactoryBid({
        request_id: request.id,
        inventory_entry_id: inventoryId,
        quoted_quantity: qty,
        factory_note: note.trim() || undefined,
      });
      setSuccess('Bid placed!');
      await onBidPlaced();
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bid');
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
            <h2 className="text-lg font-semibold">Place Factory Bid</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Request: {request.item_name ?? request.requested_name_text ?? 'N/A'}
              {' \u2014 '}
              {request.quantity} {request.preferred_currency_code}
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
          <Combobox
            options={inventoryOptions}
            value={inventoryId}
            onChange={setInventoryId}
            placeholder="Select inventory entry to fulfil this request"
            label="Your inventory entry"
            required
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm text-[rgb(var(--muted))]">
              Offered quantity <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              value={quotedQty}
              onChange={(e) => setQuotedQty(e.target.value)}
              className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-[rgb(var(--muted))]">Note to logistics (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              placeholder="e.g. Ready to ship in 48 h from Almaty warehouse"
            />
          </div>

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
            <button type="submit" disabled={submitting} className="btn btn-primary flex-1 text-sm">
              {submitting ? 'Submitting\u2026' : 'Submit Bid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FactoryWorkspacePage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme] = useState<Theme>('midnightCore');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<BootstrapAddress[]>([]);
  const [currencies, setCurrencies] = useState<BootstrapCurrency[]>([]);
  const [categories, setCategories] = useState<BootstrapCategory[]>([]);
  const [items, setItems] = useState<BootstrapItem[]>([]);
  const [inventory, setInventory] = useState<InventoryEntryItem[]>([]);
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([]);
  const [myBids, setMyBids] = useState<MatchCandidate[]>([]);
  const [bidTarget, setBidTarget] = useState<OpenRequest | null>(null);

  const [factoryCategoryId, setFactoryCategoryId] = useState('');
  const [itemText, setItemText] = useState('');
  const [itemId, setItemId] = useState('');
  const [stockAddressId, setStockAddressId] = useState('');
  const [quantityAvailable, setQuantityAvailable] = useState('500');
  const [pricePerUnit, setPricePerUnit] = useState('25');
  const [currencyCode, setCurrencyCode] = useState('USD');

  async function refreshInventory() {
    const entries = await listMyInventoryEntries();
    setInventory(entries);
  }

  async function refreshBids() {
    const bids = await listMyFactoryBids();
    setMyBids(bids);
  }

  async function refreshOpenRequests() {
    const rows = await getOpenRequests();
    setOpenRequests(rows);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const auth = await me();
        if (auth.user.role !== 'FACTORY') {
          await router.replace(`/login?lang=${locale}`);
          return;
        }
        const [bootstrap, entries, open, bids] = await Promise.all([
          getRequestsBootstrap(),
          listMyInventoryEntries(),
          getOpenRequests(),
          listMyFactoryBids(),
        ]);
        if (cancelled) return;
        setCategories(bootstrap.categories);
        setItems(bootstrap.items);
        setAddresses(bootstrap.addresses);
        setCurrencies(bootstrap.currencies);
        setInventory(entries);
        setOpenRequests(open);
        setMyBids(bids);
        if (bootstrap.addresses[0]) setStockAddressId(bootstrap.addresses[0].id);
        if (bootstrap.currencies[0]) setCurrencyCode(bootstrap.currencies[0].code);
      } catch (loadError) {
        if (!cancelled)
          setError(loadError instanceof Error ? loadError.message : 'Failed to load workspace');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [locale, router]);

  async function handleLogout() {
    await logout();
    await router.push(`/login?lang=${locale}`);
  }

  async function handleCreateInventory(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const quantity = Number(quantityAvailable);
    const price = Number(pricePerUnit);
    if (!itemId && !itemText.trim()) {
      setError('Please enter item name');
      return;
    }
    if (!itemId && !factoryCategoryId) {
      setError('Please select a category for new item');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Quantity must be > 0');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('Price per unit must be > 0');
      return;
    }
    setSubmitting(true);
    try {
      await createInventoryEntry({
        item_id: itemId || undefined,
        item_name: !itemId ? itemText.trim() : undefined,
        category_id: !itemId ? factoryCategoryId : undefined,
        stock_address_id: stockAddressId,
        quantity_available: quantity,
        price_per_unit: price,
        currency_code: currencyCode,
      });
      setSuccess('Inventory entry created');
      setItemText('');
      setItemId('');
      setFactoryCategoryId('');
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create inventory entry');
    } finally {
      setSubmitting(false);
    }
  }

  // ── derived options ────────────────────────────────────────────────────────
  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const categoryOptions = useMemo<ComboboxOption[]>(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: c.name,
      })),
    [categories]
  );
  const itemSuggestions = useMemo<ComboboxOption[]>(() => {
    const pool = factoryCategoryId
      ? items.filter((i) => i.category_id === factoryCategoryId)
      : items;
    return pool.map((i) => ({
      id: i.id,
      label: i.name,
      sublabel: categoryNameById.get(i.category_id) ?? '',
    }));
  }, [items, factoryCategoryId, categoryNameById]);

  function handleCategoryChange(id: string) {
    setFactoryCategoryId(id);
    if (itemId) {
      const sel = items.find((i) => i.id === itemId);
      if (sel && id && sel.category_id !== id) setItemId('');
    }
  }

  function handleItemChange(text: string, id: string) {
    setItemText(text);
    setItemId(id);
    if (id && !factoryCategoryId) {
      const sel = items.find((i) => i.id === id);
      if (sel?.category_id) setFactoryCategoryId(sel.category_id);
    }
  }

  const BID_STATUS: Record<string, string> = {
    PENDING: 'text-amber-300',
    ACCEPTED: 'text-emerald-300',
    REJECTED: 'text-red-400',
    EXPIRED: 'text-[rgb(var(--muted))]',
  };

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
            {/* ── Open Requests (PENDING) ─────────────────────────────── */}
            <section className="surface-1 rounded-2xl p-6 sm:p-8">
              <h1 className="text-2xl font-semibold sm:text-3xl">Factory Workspace</h1>
              <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                Bid on open customer requests, manage inventory, and track your active proposals.
              </p>

              <h2 className="mt-6 text-lg font-semibold">Open Customer Requests</h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                These requests are waiting for factory bids. Click \u201cBid\u201d to respond with
                your inventory.
              </p>

              {openRequests.length === 0 ? (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  No open requests at this time.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                        <th className="py-2 pr-4">Item / Description</th>
                        <th className="py-2 pr-4">Category</th>
                        <th className="py-2 pr-4">Qty</th>
                        <th className="py-2 pr-4">Currency</th>
                        <th className="py-2 pr-4">Placed</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openRequests.map((row) => (
                        <tr key={row.id} className="border-b border-[rgb(var(--stroke))]/40">
                          <td className="py-2 pr-4 font-medium">
                            {row.item_name ?? row.requested_name_text ?? '\u2014'}
                          </td>
                          <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                            {row.category_name ?? '\u2014'}
                          </td>
                          <td className="py-2 pr-4">{row.quantity}</td>
                          <td className="py-2 pr-4">{row.preferred_currency_code}</td>
                          <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                            {new Date(row.created_at).toLocaleString()}
                          </td>
                          <td className="py-2">
                            {inventory.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setBidTarget(row)}
                                className="rounded-md border border-sky-700/60 px-3 py-1 text-xs text-sky-300 hover:bg-sky-950/30"
                              >
                                Bid
                              </button>
                            ) : (
                              <span className="text-xs text-[rgb(var(--muted))]">
                                Add inventory first
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── My Bids ─────────────────────────────────────────────── */}
            <section className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 className="text-lg font-semibold">My Bids</h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                Factory bids you have placed. Status changes once a logist quotes delivery and a
                customer selects a solution.
              </p>
              {myBids.length === 0 ? (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">No bids yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                        <th className="py-2 pr-4">Item</th>
                        <th className="py-2 pr-4">Qty offered</th>
                        <th className="py-2 pr-4">Price/unit</th>
                        <th className="py-2 pr-4">Currency</th>
                        <th className="py-2 pr-4">Delivery</th>
                        <th className="py-2 pr-4">Total cost</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2">Stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myBids.map((bid) => (
                        <tr key={bid.id} className="border-b border-[rgb(var(--stroke))]/40">
                          <td className="py-2 pr-4">{bid.item_name ?? '\u2014'}</td>
                          <td className="py-2 pr-4">{bid.quoted_quantity ?? '\u2014'}</td>
                          <td className="py-2 pr-4">{bid.inventory_price_per_unit ?? '\u2014'}</td>
                          <td className="py-2 pr-4">{bid.currency_code}</td>
                          <td className="py-2 pr-4">
                            {bid.logistic_offer_id ? (
                              `${bid.delivery_days}d \u2022 ${bid.delivery_price} ${bid.currency_code}`
                            ) : (
                              <span className="text-xs text-amber-300">awaiting logistics</span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {bid.total_cost ? `${bid.total_cost} ${bid.currency_code}` : '\u2014'}
                          </td>
                          <td className={`py-2 pr-4 ${BID_STATUS[bid.status] ?? ''}`}>
                            {bid.status}
                          </td>
                          <td className="py-2 text-xs text-[rgb(var(--muted))]">
                            {bid.logistic_offer_id ? 'Complete proposal' : 'Factory bid only'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Add Inventory ────────────────────────────────────────── */}
            <section className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 className="text-lg font-semibold">Add Inventory Entry</h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                Register stock you can supply. You\u2019ll use these entries when placing bids.
              </p>
              {success && (
                <p className="mt-3 rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
                  {success}
                </p>
              )}

              <form onSubmit={handleCreateInventory} className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Combobox
                    options={categoryOptions}
                    value={factoryCategoryId}
                    onChange={handleCategoryChange}
                    placeholder="Search category\u2026"
                    label="Category"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <SearchableInput
                    suggestions={itemSuggestions}
                    text={itemText}
                    selectedId={itemId}
                    onChange={handleItemChange}
                    placeholder={
                      factoryCategoryId
                        ? `Type item in ${categoryNameById.get(factoryCategoryId) ?? 'category'}\u2026`
                        : 'Type item name (existing or brand-new)'
                    }
                    label="Item name"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                    Stock address
                  </label>
                  <select
                    value={stockAddressId}
                    onChange={(e) => setStockAddressId(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    required
                  >
                    {addresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                    Qty available
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantityAvailable}
                    onChange={(e) => setQuantityAvailable(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                    Price per unit
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
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
                  disabled={submitting}
                  className="btn btn-primary sm:col-span-2 text-sm"
                >
                  {submitting ? 'Creating\u2026' : 'Add Inventory Entry'}
                </button>
              </form>

              {/* My inventory list */}
              {inventory.length > 0 && (
                <div className="mt-6 overflow-x-auto">
                  <h3 className="mb-2 text-sm font-medium text-[rgb(var(--muted))]">
                    Current inventory
                  </h3>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                        <th className="py-2 pr-3">Item</th>
                        <th className="py-2 pr-3">Qty</th>
                        <th className="py-2 pr-3">Price</th>
                        <th className="py-2 pr-3">Currency</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((e) => (
                        <tr key={e.id} className="border-b border-[rgb(var(--stroke))]/40">
                          <td className="py-2 pr-3">{e.item_name}</td>
                          <td className="py-2 pr-3">{e.quantity_available}</td>
                          <td className="py-2 pr-3">{e.price_per_unit}</td>
                          <td className="py-2 pr-3">{e.currency_code}</td>
                          <td className="py-2">{e.status}</td>
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

      {bidTarget && (
        <BidModal
          request={bidTarget}
          inventory={inventory}
          onClose={() => setBidTarget(null)}
          onBidPlaced={async () => {
            await Promise.all([refreshBids(), refreshOpenRequests()]);
          }}
        />
      )}
    </main>
  );
}

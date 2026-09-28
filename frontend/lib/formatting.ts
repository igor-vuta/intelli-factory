export function formatCurrencyOptionLabel(code: string, name: string): string {
  const normalizedCode = code.trim().toUpperCase();
  const cleanedName = name
    .replace(/\\u2014/gi, '-')
    .replace(/[-–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanedName || cleanedName.toUpperCase() === normalizedCode) {
    return normalizedCode;
  }

  const dedupedParts = cleanedName
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter(
      (part, index, all) => all.findIndex((x) => x.toLowerCase() === part.toLowerCase()) === index
    );

  const safeName = dedupedParts.join(' - ').trim();
  if (!safeName || safeName.toUpperCase() === normalizedCode) {
    return normalizedCode;
  }

  return `${normalizedCode} - ${safeName}`;
}

export function formatQuantityWithUnit(
  quantity: string | number | null | undefined,
  unit: string | null | undefined
): string {
  if (quantity == null) return '-';
  const safeQuantity = String(quantity);
  const safeUnit = (unit ?? '').trim();
  return safeUnit ? `${safeQuantity} ${safeUnit}` : safeQuantity;
}

/** A timestamp in the reader's language and time zone, e.g. "28 Sept 2026, 14:05". */
export function formatDateTime(locale: string, value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** An amount in its own currency, e.g. "115 023 €" or "KZT 300"; plain text if the code is odd. */
export function formatMoney(
  locale: string,
  amount: string | number | null | undefined,
  currency: string | null | undefined
): string {
  if (amount == null || amount === '') return '—';
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency ?? '',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat(locale).format(value)} ${currency ?? ''}`.trim();
  }
}

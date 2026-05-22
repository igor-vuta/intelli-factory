export function formatCurrencyOptionLabel(code: string, name: string): string {
  const normalizedCode = code.trim().toUpperCase();
  const cleanedName = name
    .replace(/\\u2014/gi, "-")
    .replace(/[-–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanedName || cleanedName.toUpperCase() === normalizedCode) {
    return normalizedCode;
  }

  const dedupedParts = cleanedName
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((x) => x.toLowerCase() === part.toLowerCase()) === index);

  const safeName = dedupedParts.join(" - ").trim();
  if (!safeName || safeName.toUpperCase() === normalizedCode) {
    return normalizedCode;
  }

  return `${normalizedCode} - ${safeName}`;
}

export function formatQuantityWithUnit(quantity: string | number | null | undefined, unit: string | null | undefined): string {
  if (quantity == null) return "-";
  const safeQuantity = String(quantity);
  const safeUnit = (unit ?? "").trim();
  return safeUnit ? `${safeQuantity} ${safeUnit}` : safeQuantity;
}

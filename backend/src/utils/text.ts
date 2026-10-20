/** Canonical casing for place names so exact-match filters can use indexes ("SIKAR " → "Sikar"). */
export function normalizePlace(input: string | undefined): string | undefined {
  if (!input) return input;
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
}

/**
 * Supported online judge site names, displayed as-is.
 * Use `.toLowerCase()` to obtain the API/URL-safe key.
 */
export const SITES = ["QOJ", "Codeforces", "AtCoder"] as const;

export type SiteName = (typeof SITES)[number];

/** Maps lowercase site key to its original display name. */
const SITE_DISPLAY_MAP = Object.fromEntries(
  SITES.map((s) => [s.toLowerCase(), s])
) as Record<string, SiteName>;

/**
 * Returns the display name for a lowercase site key
 * (e.g. "codeforces" → "Codeforces").
 * Returns undefined if the site is not recognized.
 */
export function getSiteDisplayName(site: string): SiteName | undefined {
  return SITE_DISPLAY_MAP[site.toLowerCase()];
}

/**
 * Normalizes a problem ID by stripping non-alphanumeric characters
 * and uppercasing all letters.
 * e.g. "abc300_c" → "ABC300C", "1700A" → "1700A"
 */
export function normalizeProblemId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

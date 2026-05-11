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

/** Maps lowercase site key to the expected URL hostname for that site. */
export const SITE_HOSTNAMES: Record<string, string> = {
  qoj: "qoj.ac",
  codeforces: "codeforces.com",
  atcoder: "atcoder.jp",
};

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

/**
 * Result of URL validation: null means valid, otherwise the error message.
 */
export type UrlValidationError =
  | { kind: "wrong_site"; expectedHostname: string }
  | { kind: "missing_problem_id" };

/**
 * Validates that a problem URL is consistent with the given site and problem ID.
 *
 * Two checks are performed:
 *  1. The URL hostname must match (or be a subdomain of) the known hostname for
 *     the site (e.g. codeforces.com for "codeforces").
 *  2. At least one path fragment — or a pair of adjacent path fragments
 *     concatenated — must normalize (via normalizeProblemId) to the same value
 *     as the normalized problem ID.  The adjacent-pair variant handles sites
 *     like Codeforces where the contest number and problem letter are separate
 *     URL segments (e.g. /1700/A for problem "1700A").
 *
 * Returns null if the URL is valid, or a UrlValidationError describing the
 * specific failure.
 */
export function validateProblemUrl(
  parsedUrl: URL,
  site: string,
  externalProblemId: string
): UrlValidationError | null {
  const expectedHostname = SITE_HOSTNAMES[site.toLowerCase()];
  if (expectedHostname) {
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname !== expectedHostname && !hostname.endsWith(`.${expectedHostname}`)) {
      return { kind: "wrong_site", expectedHostname };
    }
  }

  const normalizedId = normalizeProblemId(externalProblemId);
  if (normalizedId) {
    const fragments = parsedUrl.pathname.split("/").filter(Boolean);
    const hasMatch = fragments.some((fragment, i) => {
      if (normalizeProblemId(fragment) === normalizedId) return true;
      // Also check a pair of adjacent fragments to handle URLs like
      // /contest/1700/problem/A where the problem ID "1700A" is split.
      if (i + 1 < fragments.length) {
        if (normalizeProblemId(fragment + fragments[i + 1]) === normalizedId) return true;
      }
      // Also check combining fragment with the next non-separator fragment
      // when "problem" is between them (e.g., /contest/1700/problem/A).
      if (i + 2 < fragments.length && fragments[i + 1] === "problem") {
        if (normalizeProblemId(fragment + fragments[i + 2]) === normalizedId) return true;
      }
      return false;
    });
    if (!hasMatch) {
      return { kind: "missing_problem_id" };
    }
  }

  return null;
}

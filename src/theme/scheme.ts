// The colour scheme and its cookie (docs/PLAN.md §6.1). The app's server
// action writes `uspace_scheme`; the kit only reads it. Nothing goes to
// localStorage.

export type ColorScheme = "light" | "dark" | "system";
export type ResolvedScheme = "light" | "dark";

export const SCHEME_COOKIE = "uspace_scheme";

export const COLOR_SCHEMES: readonly ColorScheme[] = [
  "light",
  "dark",
  "system",
];

export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function parseScheme(v: string | null | undefined): ColorScheme | null {
  return v === "light" || v === "dark" || v === "system" ? v : null;
}

/**
 * The scheme in a `Cookie` header or `document.cookie`, or null when the
 * cookie is absent or holds anything but a scheme.
 */
export function schemeFromCookie(
  cookie: string | null | undefined,
): ColorScheme | null {
  if (cookie === null || cookie === undefined) return null;
  for (const part of cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== SCHEME_COOKIE) continue;
    return parseScheme(part.slice(eq + 1).trim());
  }
  return null;
}

// The colour scheme and its cookie (docs/PLAN.md §6.1). The app's server
// action writes `uspace_scheme`; the kit only reads it. Nothing goes to
// localStorage.

/** @public */
export type ColorScheme = "light" | "dark" | "system";
/** @public */
export type ResolvedScheme = "light" | "dark";

/** @beta */
export const SCHEME_COOKIE = "uspace_scheme";

/** @beta */
export const COLOR_SCHEMES: readonly ColorScheme[] = [
  "light",
  "dark",
  "system",
];

/** @beta */
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** @beta */
export function parseScheme(v: string | null | undefined): ColorScheme | null {
  return v === "light" || v === "dark" || v === "system" ? v : null;
}

/**
 * The `data-theme` value the server renders on `<html>` for a scheme it
 * knows (docs/ACCESSIBILITY.md A5): `light` or `dark` for an explicit
 * choice, so the first paint is already in it; undefined for `system` or
 * no choice, so styles/tokens.css follows `prefers-color-scheme` until
 * ThemeProvider sets it. The server never guesses the preference.
 *
 *     <html data-theme={schemeAttribute(schemeFromCookie(cookieHeader))}>
 *
 * @public
 */
export function schemeAttribute(
  scheme: ColorScheme | null | undefined,
): ResolvedScheme | undefined {
  return scheme === "light" || scheme === "dark" ? scheme : undefined;
}

/**
 * The scheme in a `Cookie` header or `document.cookie`, or null when the
 * cookie is absent or holds anything but a scheme.
 *
 * @beta
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

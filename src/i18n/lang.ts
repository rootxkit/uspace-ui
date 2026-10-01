// The two languages and how a request chooses one (docs/PLAN.md §3.4,
// §6.3). The app's server action writes `uspace_lang`; the kit only reads
// it. Nothing goes to localStorage.

export type Lang = "ka" | "en";

export const LANGS: readonly Lang[] = ["ka", "en"];

/** The language when neither the cookie nor Accept-Language names one. */
export const DEFAULT_LANG: Lang = "ka";

export const LANG_COOKIE = "uspace_lang";

/** The `Intl` locale each language formats numbers and dates with. */
export const LOCALES: Readonly<Record<Lang, string>> = {
  ka: "ka-GE",
  en: "en-GB",
};

export function parseLang(v: string | null | undefined): Lang | null {
  return v === "ka" || v === "en" ? v : null;
}

/**
 * The language in a `Cookie` header or `document.cookie`, or null when the
 * cookie is absent or holds anything but a language.
 */
export function langFromCookie(cookie: string | null | undefined): Lang | null {
  if (cookie === null || cookie === undefined) return null;
  for (const part of cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== LANG_COOKIE) continue;
    return parseLang(part.slice(eq + 1).trim());
  }
  return null;
}

/**
 * The first of `ka`/`en` an `Accept-Language` header prefers, by q-value
 * and then by order; a region (`en-US`, `ka-GE`) matches its language.
 * `*`, `q=0` and malformed entries choose nothing.
 */
export function langFromAcceptLanguage(
  header: string | null | undefined,
): Lang | null {
  if (header === null || header === undefined) return null;
  const ranked: { lang: Lang; q: number; i: number }[] = [];
  header.split(",").forEach((entry, i) => {
    const [tag = "", ...params] = entry.split(";").map((s) => s.trim());
    const lang = parseLang(tag.toLowerCase().split("-")[0]);
    if (lang === null) return;
    let q = 1;
    for (const p of params) {
      const m = /^q=([0-9.]+)$/i.exec(p);
      if (m === null) continue;
      q = Number(m[1]);
    }
    if (!Number.isFinite(q) || q <= 0 || q > 1) return;
    ranked.push({ lang, q, i });
  });
  ranked.sort((a, b) => b.q - a.q || a.i - b.i);
  return ranked[0]?.lang ?? null;
}

/**
 * The language of a request: the `uspace_lang` cookie wins, then
 * `Accept-Language`, then `ka`. `cookie` is either the cookie's value or a
 * whole `Cookie` header.
 */
export function negotiateLang(
  acceptLanguage: string | null,
  cookie: string | null,
): Lang {
  const fromCookie =
    cookie === null
      ? null
      : cookie.includes("=")
        ? langFromCookie(cookie)
        : parseLang(cookie.trim());
  return fromCookie ?? langFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LANG;
}

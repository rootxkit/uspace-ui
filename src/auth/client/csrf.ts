// The CSRF cookie as the page reads it (docs/PLAN.md §3.16, §7): the BFF
// set `uspace_csrf` readable on purpose, so the page can send its value
// back as `X-CSRF-Token` (double submit). The session cookie is
// `HttpOnly` and is never visible here.
import { CSRF_COOKIE } from "../contract.js";

/**
 * The `uspace_csrf` cookie's value, or `null` when it is absent (signed
 * out) or there is no document (server rendering). Pass it to
 * `createClient({ csrfToken })`.
 *
 * @public
 */
export function csrfToken(name: string = CSRF_COOKIE): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    if (value === "") return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

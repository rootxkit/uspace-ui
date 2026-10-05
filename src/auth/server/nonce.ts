// A per-request CSP nonce (docs/PLAN.md §7 "Content Security Policy").
// The policy every `web/` sets has no `'unsafe-inline'` for styles, so a
// `<style>` element a component injects (Radix ScrollArea's scrollbar
// rule, src/ui/UPGRADING.md) is refused unless it carries the request's
// nonce. The app's middleware (Next.js `proxy.ts`) calls `issueCspNonce`,
// puts `'nonce-<value>'` in its `style-src` and `script-src`, and passes
// the value to its server components in the `CSP_NONCE_HEADER` request
// header, which it always overwrites (`set`) and never reads: a client can
// send its own `x-nonce`, and a value taken from the request is chosen by
// the client; the root layout reads it and wraps the page in the kit's
// `CspNonceProvider` (`@rootxkit/uspace-ui/ui`), which ScrollArea reads.

/**
 * The request header the middleware passes the nonce to the layout in.
 *
 * @public
 */
export const CSP_NONCE_HEADER = "x-nonce";

/**
 * A fresh nonce: 16 random bytes, base64 (CSP3 `base64-value`).
 *
 * @public
 */
export function issueCspNonce(): string {
  let bin = "";
  for (const b of crypto.getRandomValues(new Uint8Array(16)))
    bin += String.fromCharCode(b);
  return btoa(bin);
}

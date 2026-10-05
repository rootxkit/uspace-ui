// Reading the session JWT's claims for display (docs/PLAN.md §3.16,
// §14 Q9; reconciliation M20). Nothing here verifies anything: the
// signature is not checked, `exp` is not compared with the clock, the
// audience and issuer are not read. Which menu to show is all this is
// for; every request is decided by the API, which does verify.
import type { SessionDisplay } from "../../model/index.js";

import { countAuth } from "./counters.js";

/**
 * The claims the console shows, decoded without verification.
 *
 * @public
 */
export interface UnverifiedSessionClaims {
  sub: string | null;
  /** Always an array: `[]` when the claim is absent or not an array. */
  roles: string[];
  realm: string | null;
  /** Seconds since the epoch, as the token says; not compared with any clock. */
  exp: number | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function decodeSegment(segment: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) return undefined;
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

/**
 * The payload of a session JWT, base64url-decoded WITHOUT verifying the
 * signature, for display only (which menu to show). Authorisation is the
 * API's; never grant anything on this. Reads the reconciled session
 * shape (M20): `sub`, `exp`, `roles: [string]`, `realm`. A `roles` claim
 * that is absent or not an array gives `[]` (and a non-array is
 * counted), never a guess from `scope`. `null` for a token that is not
 * three segments with a JSON-object payload.
 *
 * @public
 */
export function sessionClaimsUnverified(
  jwt: string,
): UnverifiedSessionClaims | null {
  const parts = jwt.split(".");
  let payload: unknown;
  try {
    payload = parts.length === 3 ? decodeSegment(parts[1] ?? "") : undefined;
  } catch {
    payload = undefined;
  }
  if (!isRecord(payload)) {
    countAuth("claims_malformed");
    return null;
  }
  const { sub, exp, realm } = payload;
  const raw = payload["roles"];
  const roles: string[] = [];
  if (Array.isArray(raw)) {
    for (const r of raw) {
      if (typeof r === "string") roles.push(r);
      else countAuth("role_not_string");
    }
  } else if (raw !== undefined) {
    countAuth("roles_not_array");
  }
  return {
    sub: typeof sub === "string" ? sub : null,
    roles,
    realm: typeof realm === "string" ? realm : null,
    exp: typeof exp === "number" && Number.isFinite(exp) ? exp : null,
  };
}

/**
 * The `SessionDisplay` a server component passes to `SessionProvider`,
 * from the session cookie's token, decoded without verification (display
 * only). `null` for no token, a malformed token, or one without the
 * `sub`, `exp` or `realm` the contract requires (counted): the console
 * then shows the signed-out layout and the API still decides.
 *
 * @public
 */
export function sessionDisplay(jwt: string | null): SessionDisplay | null {
  if (jwt === null) return null;
  const c = sessionClaimsUnverified(jwt);
  if (c === null) return null;
  if (c.sub === null || c.exp === null || c.realm === null) {
    countAuth("claims_incomplete");
    return null;
  }
  return { sub: c.sub, roles: c.roles, realm: c.realm, exp: c.exp };
}

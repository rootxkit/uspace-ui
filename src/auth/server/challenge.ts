// The MFA challenge between the two sign-in steps (WP-5). The API's
// password step answers a short-lived, single-use `mfa_token`. The BFF
// keeps it in a cookie the page cannot read: `HttpOnly`, `SameSite=Strict`,
// `Path=/_bff`, and sealed with the BFF's secret (AES-256-GCM under a key
// derived with HKDF-SHA-256). The second step then carries only the code,
// so the password crosses the network once.
//
// The seal holds the challenge, the username it was issued to, and its
// expiry; the second step must name the same username to open it. The expiry is the API's
// `expires_at` and is checked on open as well as set as the cookie's
// `Max-Age`, so a replayed cookie value dies with the challenge. The kit
// sets no lifetime of its own. Web Crypto only, so it runs on Node.js and
// on the edge runtime.
import { base64url } from "./cookies.js";

/**
 * The BFF-internal challenge cookie; no API or WS process reads it.
 *
 * @beta
 */
export const MFA_CHALLENGE_COOKIE = "uspace_mfa";

/**
 * The cookie's path: the BFF's routes only, never a page.
 *
 * @beta
 */
export const MFA_CHALLENGE_PATH = "/_bff";

/**
 * The shortest BFF secret accepted, in bytes (256 bits).
 *
 * @public
 */
export const MIN_CHALLENGE_SECRET_BYTES = 32;

const INFO = new TextEncoder().encode("uspace-ui bff mfa challenge v1");
const AAD = new TextEncoder().encode(MFA_CHALLENGE_COOKIE);

/** Throws unless `secret` is at least `MIN_CHALLENGE_SECRET_BYTES` long. */
export function checkChallengeSecret(secret: string | undefined): void {
  const n = secret === undefined ? 0 : new TextEncoder().encode(secret).length;
  if (n < MIN_CHALLENGE_SECRET_BYTES) {
    throw new RangeError(
      `mfaChallengeSecret must be at least ${MIN_CHALLENGE_SECRET_BYTES} bytes`,
    );
  }
}

/** The AES-GCM key for `secret`. */
export async function challengeKey(secret: string): Promise<CryptoKey> {
  checkChallengeSecret(secret);
  const ikm = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: INFO },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function fromBase64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  let bin: string;
  try {
    // A length of 1 mod 4 is not base64 at all; atob throws on it.
    bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  } catch {
    return null;
  }
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * Seals the challenge, the username of the password step that earned it,
 * and its expiry (seconds since the epoch).
 */
export async function sealChallenge(
  key: CryptoKey,
  token: string,
  username: string,
  expS: number,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(
    JSON.stringify({ t: token, u: username, exp: expS }),
  );
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: AAD },
    key,
    plain,
  );
  return `${base64url(iv)}.${base64url(new Uint8Array(sealed))}`;
}

/**
 * The challenge in a sealed value, or `null` when the value is malformed,
 * was sealed under another secret, was altered, was issued to another
 * username than `username`, or has expired at `nowS`.
 */
export async function openChallenge(
  key: CryptoKey,
  value: string,
  username: string,
  nowS: number,
): Promise<string | null> {
  const [ivPart = "", ctPart = "", ...rest] = value.split(".");
  const iv = fromBase64url(ivPart);
  const ct = fromBase64url(ctPart);
  if (rest.length > 0 || iv === null || iv.length !== 12 || ct === null) {
    return null;
  }
  let payload: unknown;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: AAD },
      key,
      ct,
    );
    payload = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;
  const { t, u, exp } = payload as { t?: unknown; u?: unknown; exp?: unknown };
  if (typeof t !== "string" || t === "" || typeof exp !== "number") return null;
  if (typeof u !== "string" || u !== username) return null;
  return nowS < exp ? t : null;
}

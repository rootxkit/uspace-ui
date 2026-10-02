// The session and CSRF cookies of the BFF (docs/PLAN.md §3.16, §6.3;
// spec 06 §3; authority runbook "the console session contract").
//
// The session cookie holds the API-issued session JWT as it came; the BFF
// never decodes or verifies it (00 §6.2). The CSRF cookie is a random
// value the BFF chooses at sign-in, readable by the page so the page can
// send it back as `X-CSRF-Token` (double submit).
//
// The names are the contract's (`uspace_session`, `uspace_csrf`), not
// `__Host-` prefixed: the prefix would change the names five systems
// share. The attributes a `__Host-` prefix would enforce (Secure, Path=/,
// no Domain) are what the defaults produce anyway when `secure` is true.
// `next` has no `exports` map, so NodeNext resolution needs the file name
// (src/fonts/next-font.d.ts); Next's bundler resolves the same file.
import type { NextRequest, NextResponse } from "next/server.js";

import {
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
  isUnsafeMethod,
} from "../contract.js";

export interface SessionCookieOptions {
  /** The session cookie's name; `uspace_session` by default. */
  name?: string;
  /** The CSRF cookie's name; `uspace_csrf` by default. */
  csrfName?: string;
  /** Sets `Secure` on both cookies. True everywhere but plain-HTTP development. */
  secure: boolean;
  /** `Domain`; absent (host-only) by default. */
  domain?: string;
  /** `Path`; `/` by default. */
  path?: string;
  /**
   * `Max-Age` in seconds. Configuration, not a kit default: it is the
   * system's session lifetime (≤ 12 h). `login` shortens it to the
   * session's own `expires_at` when the API sends one.
   */
  maxAgeS: number;
}

/** Anything that reads request cookies: `NextRequest.cookies` or `cookies()`. */
export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/** The cookie names of `opts` with the contract's defaults. */
export function cookieNames(
  opts?: Pick<SessionCookieOptions, "name" | "csrfName">,
): {
  session: string;
  csrf: string;
} {
  return {
    session: opts?.name ?? SESSION_COOKIE,
    csrf: opts?.csrfName ?? CSRF_COOKIE,
  };
}

function attributes(opts: SessionCookieOptions, maxAgeS: number) {
  return {
    path: opts.path ?? "/",
    sameSite: "strict" as const,
    secure: opts.secure,
    maxAge: maxAgeS,
    ...(opts.domain === undefined ? {} : { domain: opts.domain }),
  };
}

/**
 * Stores the API-issued session JWT in the `HttpOnly` session cookie. It
 * never decodes or verifies the token (06 §3: the BFF never verifies).
 */
export function setSession(
  res: NextResponse,
  jwt: string,
  opts: SessionCookieOptions,
): void {
  res.cookies.set(cookieNames(opts).session, jwt, {
    ...attributes(opts, opts.maxAgeS),
    httpOnly: true,
  });
}

/** Expires both cookies, with the attributes they were set with. */
export function clearSession(
  res: NextResponse,
  opts: SessionCookieOptions,
): void {
  const names = cookieNames(opts);
  res.cookies.set(names.session, "", {
    ...attributes(opts, 0),
    httpOnly: true,
  });
  res.cookies.set(names.csrf, "", attributes(opts, 0));
}

function isRequest(src: NextRequest | CookieReader): src is NextRequest {
  return "cookies" in src;
}

/** The session JWT from the request's cookie, or `null` when there is none. */
export function readSessionToken(
  src: NextRequest | CookieReader,
  opts?: Pick<SessionCookieOptions, "name">,
): string | null {
  const jar = isRequest(src) ? src.cookies : src;
  const value = jar.get(cookieNames(opts).session)?.value;
  return value === undefined || value === "" ? null : value;
}

/** Base64url without padding (RFC 4648 §5), on Web APIs only (Node and edge). */
export function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Chooses a new CSRF value (32 random bytes, base64url) and sets it in
 * the CSRF cookie: same attributes as the session cookie but not
 * `HttpOnly`, so the page can read it and send it back. Returns it.
 */
export function issueCsrf(
  res: NextResponse,
  opts: SessionCookieOptions,
): string {
  const value = base64url(crypto.getRandomValues(new Uint8Array(32)));
  res.cookies.set(cookieNames(opts).csrf, value, {
    ...attributes(opts, opts.maxAgeS),
    httpOnly: false,
  });
  return value;
}

/** Compares two strings in time that depends on their length only. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The double-submit check (06 §3; the authority's `authz.CheckCSRF`): on
 * an unsafe method, the CSRF cookie and the `X-CSRF-Token` header must
 * both be present, non-empty and equal (compared in constant time). A
 * safe method (GET, HEAD, OPTIONS) passes.
 */
export function checkCsrf(
  req: NextRequest,
  opts?: Pick<SessionCookieOptions, "csrfName">,
): boolean {
  if (!isUnsafeMethod(req.method)) return true;
  const cookie = req.cookies.get(cookieNames(opts).csrf)?.value ?? "";
  const header = req.headers.get(CSRF_HEADER) ?? "";
  if (cookie === "" || header === "") return false;
  return constantTimeEqual(cookie, header);
}

// The three BFF route handlers every `web/` mounts under `/_bff/*`
// (docs/PLAN.md §3.16, §6.3; spec 02 §3): `login`, `logout`, `proxy`.
// There is no fourth: no WebSocket ticket route (M22). The browser opens
// its system's WebSocket same-origin and the `uspace_session` cookie
// travels on the upgrade, where the WS process checks `Origin` against
// its allow-list and verifies the cookie.
//
// Sign-in follows the API's own endpoints (the authority's runbook "the
// console session contract"): `POST <apiLoginPath>` `{username,
// password}` answers either a session `{token, expires_at, ...}` or an
// MFA challenge `{mfa_token, expires_at, enrolment?}`, which `POST
// <apiMfaPath>` `{mfa_token, code}` exchanges for the session. The
// challenge never reaches the browser: the form sends `otp` with the
// username and password, and the BFF runs both steps in one request.
//
// Nothing here logs. The login body holds a password.
import { NextResponse, type NextRequest } from "next/server.js";

import { BFF_API_PREFIX, type LoginResult } from "../contract.js";
import {
  checkCsrf,
  clearSession,
  issueCsrf,
  readSessionToken,
  setSession,
  type SessionCookieOptions,
} from "./cookies.js";
import { countAuth } from "./counters.js";
import {
  callUpstream,
  downstreamHeaders,
  forward,
  problemResponse,
  upstreamHeaders,
} from "./forward.js";

/** A Next.js App Router route handler. */
export type RouteHandler = (req: NextRequest) => Promise<Response>;

/** Exactly the three routes of the contract; there is no `wsTicket` (M22). */
export interface BffHandlers {
  readonly login: RouteHandler;
  readonly logout: RouteHandler;
  readonly proxy: RouteHandler;
}

export interface BffOptions {
  /** The system's API as the BFF reaches it (server side), e.g. the compose service URL. */
  apiBase: string | URL;
  /** The API's password step, e.g. `/v1/auth/login`. */
  apiLoginPath: string;
  /** The API's MFA step, e.g. `/v1/auth/mfa`; required when the API answers with a challenge. */
  apiMfaPath?: string;
  /** The API's logout, e.g. `/v1/auth/logout`; when set, `logout` tells the API. */
  apiLogoutPath?: string;
  session: SessionCookieOptions;
  /** The API paths `proxy` may reach (see `forward`). */
  allowPaths: RegExp[];
  /** The upstream timeout of every call the handlers make. Configuration. */
  timeoutMs: number;
  /** The fetch to use; the platform's by default. */
  fetch?: typeof fetch;
}

/**
 * A display-only bound, not a threshold: the largest sign-in body read.
 * Username, password and code fit many times over.
 */
const LOGIN_BODY_MAX_BYTES = 8192;

function apiUrl(base: URL, path: string): URL {
  return new URL(base.pathname.replace(/\/$/, "") + path, base);
}

/**
 * Login CSRF: there is no CSRF cookie before sign-in, so the sign-in
 * route requires the browser's `Origin` and that it names this host. A
 * cross-site form or fetch carries the attacker's origin.
 */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin === null || host === null) return false;
  try {
    return new URL(origin).host === host.split(",")[0]?.trim();
  } catch {
    return false;
  }
}

interface Credentials {
  username: string;
  password: string;
  otp: string | null;
}

async function readCredentials(
  req: NextRequest,
): Promise<Credentials | NextResponse> {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > LOGIN_BODY_MAX_BYTES) {
    return problemResponse(413, "body_too_large", "Request body too large");
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const rec =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const errors: { field: string; reason: string }[] = [];
  const field = (name: string, required: boolean): string | null => {
    const v = rec[name];
    if (typeof v === "string" && v !== "") return v;
    if (!required && (v === undefined || v === "")) return null;
    errors.push({ field: name, reason: required ? "required" : "invalid" });
    return null;
  };
  const username = field("username", true);
  const password = field("password", true);
  const otp = field("otp", false);
  if (username === null || password === null || errors.length > 0) {
    return problemResponse(400, "validation", "Invalid request", null, errors);
  }
  return { username, password, otp };
}

function noStoreJson(body: LoginResult): NextResponse {
  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

/** The API's refusal as it came: status, problem body, `Retry-After`. No cookie is set. */
function passThrough(upstream: Response): NextResponse {
  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: downstreamHeaders(upstream),
  });
}

async function jsonOf(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await res.json();
    return typeof v === "object" && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function invalidAnswer(): NextResponse {
  countAuth("login_answer_invalid");
  return problemResponse(502, "upstream_invalid", "Unexpected sign-in answer");
}

function signedIn(
  answer: Record<string, unknown>,
  token: string,
  opts: BffOptions,
): NextResponse {
  const codes = answer["recovery_codes"];
  const result: LoginResult = { status: "signed_in" };
  if (Array.isArray(codes) && codes.every((c) => typeof c === "string")) {
    result.recoveryCodes = codes as string[];
  }
  const res = noStoreJson(result);
  // The cookie lives no longer than the session the API issued.
  let maxAgeS = opts.session.maxAgeS;
  const expiresAt = answer["expires_at"];
  if (typeof expiresAt === "string") {
    const left = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000);
    if (Number.isFinite(left)) maxAgeS = Math.max(0, Math.min(maxAgeS, left));
  }
  const session = { ...opts.session, maxAgeS };
  setSession(res, token, session);
  issueCsrf(res, session);
  return res;
}

function postJson(req: NextRequest, body: unknown): RequestInit {
  const headers = upstreamHeaders(req);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json, application/problem+json");
  return { method: "POST", headers, body: JSON.stringify(body) };
}

/** The three route handlers of `/_bff/*`. */
export function bffHandlers(opts: BffOptions): BffHandlers {
  const base = new URL(opts.apiBase);

  const login: RouteHandler = async (req) => {
    if (!sameOrigin(req)) {
      countAuth("origin_refused");
      return problemResponse(
        403,
        "origin_refused",
        "Cross-origin sign-in refused",
      );
    }
    const creds = await readCredentials(req);
    if (creds instanceof NextResponse) return creds;

    const first = await callUpstream(
      apiUrl(base, opts.apiLoginPath),
      postJson(req, { username: creds.username, password: creds.password }),
      opts.timeoutMs,
      opts.fetch,
    );
    if (!first.ok) return first.response;
    if (!first.response.ok) return passThrough(first.response);
    const answer = await jsonOf(first.response);
    if (answer === null) return invalidAnswer();

    const token = answer["token"];
    if (typeof token === "string" && token !== "")
      return signedIn(answer, token, opts);

    const challenge = answer["mfa_token"];
    if (typeof challenge !== "string" || challenge === "")
      return invalidAnswer();
    if (creds.otp === null) {
      const result: LoginResult = { status: "mfa_required" };
      const enrolment = answer["enrolment"];
      if (typeof enrolment === "object" && enrolment !== null) {
        const { secret, otpauth_uri } = enrolment as Record<string, unknown>;
        if (typeof secret === "string" && typeof otpauth_uri === "string") {
          result.enrolment = { secret, otpauthUri: otpauth_uri };
        }
      }
      return noStoreJson(result);
    }
    if (opts.apiMfaPath === undefined) return invalidAnswer();

    const second = await callUpstream(
      apiUrl(base, opts.apiMfaPath),
      postJson(req, { mfa_token: challenge, code: creds.otp }),
      opts.timeoutMs,
      opts.fetch,
    );
    if (!second.ok) return second.response;
    if (!second.response.ok) return passThrough(second.response);
    const session = await jsonOf(second.response);
    const sessionToken = session?.["token"];
    if (
      session === null ||
      typeof sessionToken !== "string" ||
      sessionToken === ""
    )
      return invalidAnswer();
    return signedIn(session, sessionToken, opts);
  };

  const logout: RouteHandler = async (req) => {
    if (!checkCsrf(req, opts.session)) {
      countAuth("csrf_refused");
      return problemResponse(
        403,
        "csrf_refused",
        "CSRF check failed",
        "send the uspace_csrf cookie's value as X-CSRF-Token",
      );
    }
    const token = readSessionToken(req, opts.session);
    if (opts.apiLogoutPath !== undefined && token !== null) {
      const headers = upstreamHeaders(req);
      headers.set("Authorization", `Bearer ${token}`);
      // The cookies are cleared whatever the API answers: the browser's
      // sign-out does not wait on the API being up.
      const told = await callUpstream(
        apiUrl(base, opts.apiLogoutPath),
        { method: "POST", headers },
        opts.timeoutMs,
        opts.fetch,
      );
      if (told.ok) await told.response.body?.cancel();
    }
    const res = new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
    clearSession(res, opts.session);
    return res;
  };

  const proxy: RouteHandler = async (req) => {
    const path = req.nextUrl.pathname;
    if (!path.startsWith(`${BFF_API_PREFIX}/`)) {
      countAuth("proxy_path_refused");
      return problemResponse(404, "not_found", "Not found");
    }
    const target = apiUrl(base, path.slice(BFF_API_PREFIX.length));
    // A path such as `//other.host/x` would leave the API's origin.
    if (target.origin !== base.origin) {
      countAuth("proxy_path_refused");
      return problemResponse(404, "not_found", "Not found");
    }
    target.search = req.nextUrl.search;
    return forward(req, target, {
      session: opts.session,
      allowPaths: opts.allowPaths,
      timeoutMs: opts.timeoutMs,
      ...(opts.fetch === undefined ? {} : { fetch: opts.fetch }),
    });
  };

  return { login, logout, proxy };
}

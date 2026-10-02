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
// browser sends `{username, password}` first and `{otp}` alone second.
// Between the two, the challenge waits in the sealed, `HttpOnly`
// `uspace_mfa` cookie (challenge.ts), so it never reaches page script
// and the password crosses the network once.
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
import {
  MFA_CHALLENGE_COOKIE,
  MFA_CHALLENGE_PATH,
  challengeKey,
  checkChallengeSecret,
  openChallenge,
  sealChallenge,
} from "./challenge.js";
import { countAuth } from "./counters.js";
import {
  callUpstream,
  checkTrustedProxyHops,
  downstreamHeaders,
  forward,
  isRedirect,
  problemResponse,
  redirectRefused,
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
  /**
   * The BFF's secret, at least 32 bytes, from the deployment's secret
   * store (never the repository). It seals the MFA challenge cookie.
   * Required with `apiMfaPath`.
   */
  mfaChallengeSecret?: string;
  /** The API's logout, e.g. `/v1/auth/logout`; when set, `logout` tells the API. */
  apiLogoutPath?: string;
  session: SessionCookieOptions;
  /** The API paths `proxy` may reach (see `forward`). */
  allowPaths: RegExp[];
  /** See `ForwardOptions.trustedProxyHops`; the same for every call. */
  trustedProxyHops?: number;
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
 * The entry a chain of `trustedProxyHops` proxies recorded in a
 * forwarded header (`X-Forwarded-Proto`, `X-Forwarded-Host`): `hops`
 * places from the end, as for the client address. `null` without trusted
 * hops, without the header, or for a chain shorter than `hops`.
 */
function forwardedEntry(
  req: NextRequest,
  name: string,
  hops: number | undefined,
): string | null {
  if (hops === undefined) return null;
  const chain = (req.headers.get(name) ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "");
  return chain.length >= hops ? (chain[chain.length - hops] ?? null) : null;
}

/**
 * This site's own origin as the browser addresses it: the scheme from
 * `X-Forwarded-Proto` when the proxy hop is trusted, else from
 * `session.secure`; the host and port from `X-Forwarded-Host` when the
 * hop is trusted, else from `Host`. `null` when it cannot be formed.
 */
function ownOrigin(req: NextRequest, opts: BffOptions): string | null {
  const hops = opts.trustedProxyHops;
  const proto = forwardedEntry(req, "x-forwarded-proto", hops)?.toLowerCase();
  const scheme =
    proto === "https" || proto === "http"
      ? proto
      : opts.session.secure
        ? "https"
        : "http";
  const host =
    forwardedEntry(req, "x-forwarded-host", hops) ?? req.headers.get("host");
  if (host === null || host === "") return null;
  try {
    const url = new URL(`${scheme}://${host}`);
    // A host header that carries a path or credentials is not a host.
    if (url.pathname !== "/" || url.username !== "" || url.search !== "") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Login CSRF: there is no CSRF cookie before sign-in, so the sign-in
 * route requires the browser's `Origin` to be this site's own origin,
 * scheme, host and port alike (URL serialisation drops default ports on
 * both sides). A cross-site form or fetch carries the attacker's origin;
 * a plain-HTTP page on the same host carries another scheme.
 */
function sameOrigin(req: NextRequest, opts: BffOptions): boolean {
  const origin = req.headers.get("origin");
  const own = ownOrigin(req, opts);
  if (origin === null || own === null) return false;
  try {
    return new URL(origin).origin === own;
  } catch {
    return false;
  }
}

/**
 * The request body as text, read no further than `maxBytes`. `null` when
 * `Content-Length` announces more, before any byte is read, or when the
 * stream passes the bound, at which point the read stops and the stream
 * is cancelled. Nothing beyond the bound is buffered.
 */
export async function readBounded(
  req: Request,
  maxBytes: number,
): Promise<string | null> {
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (!/^\d+$/.test(declared.trim()) || n > maxBytes) return null;
  }
  if (req.body === null) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** The sign-in step a request carries: the password, or the code alone. */
type LoginStep =
  | { step: "password"; username: string; password: string }
  | { step: "otp"; otp: string };

async function readLoginStep(
  req: NextRequest,
): Promise<LoginStep | NextResponse> {
  const text = await readBounded(req, LOGIN_BODY_MAX_BYTES);
  if (text === null) {
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
  const refuse = (): NextResponse =>
    problemResponse(400, "validation", "Invalid request", null, errors);
  const present = (name: string): boolean =>
    rec[name] !== undefined && rec[name] !== "";
  const str = (name: string): string | null => {
    const v = rec[name];
    if (typeof v === "string" && v !== "") return v;
    errors.push({
      field: name,
      reason: v === undefined || v === "" ? "required" : "invalid",
    });
    return null;
  };
  if (present("otp")) {
    // The second step carries the code alone: the password went once.
    for (const name of ["username", "password"]) {
      if (present(name)) errors.push({ field: name, reason: "unexpected" });
    }
    const otp = str("otp");
    return otp === null || errors.length > 0 ? refuse() : { step: "otp", otp };
  }
  const username = str("username");
  const password = str("password");
  if (username === null || password === null) return refuse();
  return { step: "password", username, password };
}

function noStoreJson(body: LoginResult): NextResponse {
  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * The API's refusal as it came: status, problem body, `Retry-After`. No
 * cookie is set. A redirect is not a refusal to pass on: it becomes a
 * 502 problem without `Location`.
 */
async function passThrough(upstream: Response): Promise<NextResponse> {
  if (isRedirect(upstream.status)) return redirectRefused(upstream);
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
  clearChallenge: boolean,
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
  if (clearChallenge) setChallengeCookie(res, "", 0, opts);
  return res;
}

function setChallengeCookie(
  res: NextResponse,
  value: string,
  maxAgeS: number,
  opts: BffOptions,
): void {
  res.cookies.set(MFA_CHALLENGE_COOKIE, value, {
    httpOnly: true,
    secure: opts.session.secure,
    sameSite: "strict",
    path: MFA_CHALLENGE_PATH,
    maxAge: maxAgeS,
  });
}

function postJson(
  req: NextRequest,
  body: unknown,
  hops: number | undefined,
): RequestInit {
  const headers = upstreamHeaders(req, hops);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json, application/problem+json");
  return { method: "POST", headers, body: JSON.stringify(body) };
}

/** The three route handlers of `/_bff/*`. */
export function bffHandlers(opts: BffOptions): BffHandlers {
  const base = new URL(opts.apiBase);
  checkTrustedProxyHops(opts.trustedProxyHops);
  if (opts.apiMfaPath !== undefined) {
    checkChallengeSecret(opts.mfaChallengeSecret);
  }
  // Derived once; null when this API has no MFA step.
  const key =
    opts.apiMfaPath === undefined || opts.mfaChallengeSecret === undefined
      ? null
      : challengeKey(opts.mfaChallengeSecret);

  const login: RouteHandler = async (req) => {
    if (!sameOrigin(req, opts)) {
      countAuth("origin_refused");
      return problemResponse(
        403,
        "origin_refused",
        "Cross-origin sign-in refused",
      );
    }
    const step = await readLoginStep(req);
    if (step instanceof NextResponse) return step;
    const hadChallenge = req.cookies.get(MFA_CHALLENGE_COOKIE) !== undefined;

    if (step.step === "otp") {
      const sealed = req.cookies.get(MFA_CHALLENGE_COOKIE)?.value ?? "";
      const challenge =
        key === null || sealed === ""
          ? null
          : await openChallenge(await key, sealed, Date.now() / 1000);
      if (challenge === null || opts.apiMfaPath === undefined) {
        countAuth("mfa_challenge_invalid");
        const res = problemResponse(
          401,
          "mfa_challenge_missing",
          "Sign-in challenge missing or expired",
          "the password step is missing or has expired; sign in again",
        );
        if (hadChallenge) setChallengeCookie(res, "", 0, opts);
        return res;
      }
      const second = await callUpstream(
        apiUrl(base, opts.apiMfaPath),
        postJson(
          req,
          { mfa_token: challenge, code: step.otp },
          opts.trustedProxyHops,
        ),
        opts.timeoutMs,
        opts.fetch,
      );
      if (!second.ok) return second.response;
      // A wrong code keeps the challenge: the API bounds the attempts.
      if (!second.response.ok) return passThrough(second.response);
      const session = await jsonOf(second.response);
      const sessionToken = session?.["token"];
      if (
        session === null ||
        typeof sessionToken !== "string" ||
        sessionToken === ""
      )
        return invalidAnswer();
      return signedIn(session, sessionToken, opts, true);
    }

    const first = await callUpstream(
      apiUrl(base, opts.apiLoginPath),
      postJson(
        req,
        { username: step.username, password: step.password },
        opts.trustedProxyHops,
      ),
      opts.timeoutMs,
      opts.fetch,
    );
    if (!first.ok) return first.response;
    if (!first.response.ok) return passThrough(first.response);
    const answer = await jsonOf(first.response);
    if (answer === null) return invalidAnswer();

    // Single step: an API that wants no code for this account answers
    // the session directly.
    const token = answer["token"];
    if (typeof token === "string" && token !== "")
      return signedIn(answer, token, opts, hadChallenge);

    const challenge = answer["mfa_token"];
    const expiresAt = answer["expires_at"];
    if (
      typeof challenge !== "string" ||
      challenge === "" ||
      typeof expiresAt !== "string" ||
      key === null
    )
      return invalidAnswer();
    // The cookie lives exactly as long as the API's challenge.
    const expMs = Date.parse(expiresAt);
    const leftS = Math.floor((expMs - Date.now()) / 1000);
    if (!Number.isFinite(leftS) || leftS <= 0) return invalidAnswer();

    const result: LoginResult = { status: "mfa_required" };
    const enrolment = answer["enrolment"];
    if (typeof enrolment === "object" && enrolment !== null) {
      const { secret, otpauth_uri } = enrolment as Record<string, unknown>;
      if (typeof secret === "string" && typeof otpauth_uri === "string") {
        result.enrolment = { secret, otpauthUri: otpauth_uri };
      }
    }
    const res = noStoreJson(result);
    setChallengeCookie(
      res,
      await sealChallenge(await key, challenge, expMs / 1000),
      leftS,
      opts,
    );
    return res;
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
      const headers = upstreamHeaders(req, opts.trustedProxyHops);
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
      ...(opts.trustedProxyHops === undefined
        ? {}
        : { trustedProxyHops: opts.trustedProxyHops }),
    });
  };

  return { login, logout, proxy };
}

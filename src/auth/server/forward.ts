// The one BFF proxy (docs/PLAN.md §3.16, §7; spec 02 §3, 06 §3): the
// browser talks to `/_bff/api/*` with its cookies; the BFF talks to the
// system's API with `Authorization: Bearer <session>` and no cookie. It
// refuses a path outside the allow-list without calling upstream, checks
// the CSRF pair on unsafe methods, never follows a redirect, bounds the
// upstream call with its own timeout (LESSONS E-14: not the browser
// request's signal), and passes the API's status, problem bodies and
// headers (`Retry-After`, `ETag`, `Sunset`) through unchanged.
//
// Nothing here logs: a request or answer body may hold a credential.
import { NextResponse, type NextRequest } from "next/server.js";

import { guardResponse } from "../../api/body.js";
import { PROBLEM_TYPE_PREFIX } from "../../api/problem.js";
import { isUnsafeMethod } from "../contract.js";
import {
  checkCsrf,
  clearSession,
  readSessionToken,
  type SessionCookieOptions,
} from "./cookies.js";
import { countAuth } from "./counters.js";

export interface ForwardOptions {
  /** The cookie options: the session cookie is read, and cleared on a 401. */
  session: SessionCookieOptions;
  /**
   * The upstream paths this route may reach, matched against the target's
   * normalised pathname. Anchor them (`/^\/v1\/zones(\/|$)/`).
   */
  allowPaths: RegExp[];
  /**
   * How long the BFF waits for the API's answer headers, and then for each
   * chunk of its body while one is being read. Configuration.
   */
  timeoutMs: number;
  /** The fetch to use; the platform's by default. */
  fetch?: typeof fetch;
  /**
   * How many reverse proxies in front of Next.js append to
   * `X-Forwarded-For` (1 for one Caddy). The BFF then sends the API the
   * one address those proxies recorded for the client, never the header
   * as the client wrote it. Absent: no `X-Forwarded-For` is sent.
   */
  trustedProxyHops?: number;
}

/**
 * Request headers copied to the API; everything else is dropped.
 * `X-Forwarded-For` is not copied: the BFF writes its own (`clientAddress`).
 */
export const FORWARDED_REQUEST_HEADERS: readonly string[] = [
  "accept",
  "accept-language",
  "content-type",
  "if-match",
  "if-none-match",
  "user-agent",
];

/**
 * Response headers never passed back: the hop-by-hop set (RFC 9110
 * §7.6.1), cookies (the BFF owns the browser's cookie jar), the encoding
 * and length the platform's fetch has already undone, and the headers
 * that describe the API's own server rather than the answer (retro-audit
 * S5). Every `Access-Control-*` header is dropped too (`downstreamHeaders`):
 * one the API wrote for its own origin must not be replayed on the
 * console's.
 */
export const DROPPED_RESPONSE_HEADERS: readonly string[] = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "set-cookie",
  "content-encoding",
  "content-length",
  "server",
  "via",
  "x-powered-by",
];

/** An `application/problem+json` answer of the BFF itself (M28 shape). */
export function problemResponse(
  status: number,
  slug: string,
  title: string,
  detail: string | null = null,
  errors: { field: string; reason: string }[] = [],
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      type: `${PROBLEM_TYPE_PREFIX}${slug}`,
      title,
      status,
      detail,
      instance: null,
      errors,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "no-store",
      },
    },
  );
}

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function isIpLiteral(v: string): boolean {
  if (IPV4.test(v)) return true;
  if (!v.includes(":") || /[^0-9A-Fa-f:.]/.test(v)) return false;
  try {
    new URL(`http://[${v}]/`);
    return true;
  } catch {
    return false;
  }
}

/** Throws unless `hops` is absent or a whole number of at least 1. */
export function checkTrustedProxyHops(hops: number | undefined): void {
  if (hops !== undefined && !(Number.isInteger(hops) && hops >= 1)) {
    throw new RangeError(
      `trustedProxyHops must be an integer >= 1, got ${hops}`,
    );
  }
}

/**
 * The client's address as the BFF's own trusted proxies recorded it.
 * App Router handlers do not see the TCP peer, so the BFF reads the
 * `X-Forwarded-For` chain from the right: each of the `hops` proxies in
 * front of Next.js appended the address it received from, so the entry
 * `hops` places from the end is the client. Anything to its left was
 * written by the client and is ignored. `null` without `hops`, for a
 * chain shorter than `hops`, or for an entry that is not an IP address
 * (counted). Sound only when Next.js is reachable through those proxies
 * alone.
 */
export function clientAddress(
  req: NextRequest,
  hops: number | undefined,
): string | null {
  if (hops === undefined) return null;
  checkTrustedProxyHops(hops);
  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  const entry = chain.length >= hops ? chain[chain.length - hops] : undefined;
  if (entry === undefined || !isIpLiteral(entry)) {
    countAuth("client_address_unknown");
    return null;
  }
  return entry;
}

/**
 * The forwarded subset of the browser's headers, plus an
 * `X-Forwarded-For` the BFF wrote itself: exactly the client address
 * (`clientAddress`), or none. A client-supplied value never passes.
 */
export function upstreamHeaders(
  req: NextRequest,
  trustedProxyHops?: number,
): Headers {
  const out = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const v = req.headers.get(name);
    if (v !== null) out.set(name, v);
  }
  const client = clientAddress(req, trustedProxyHops);
  if (client !== null) out.set("X-Forwarded-For", client);
  return out;
}

/**
 * A redirect status: every 3xx but 304. A 304 Not Modified answers the
 * `If-None-Match` the BFF forwards and is passed through; a redirect is not.
 */
export function isRedirect(status: number): boolean {
  return status >= 300 && status < 400 && status !== 304;
}

/**
 * An upstream redirect becomes a 502 problem with no `Location`. The
 * browser must never be sent to wherever the API pointed: the target
 * could be the API's internal address, or a place outside the allow-list.
 * Counted.
 */
export async function redirectRefused(
  upstream: Response,
): Promise<NextResponse> {
  await upstream.body?.cancel();
  countAuth("upstream_redirect");
  return problemResponse(
    502,
    "upstream_redirect",
    "Upstream redirect refused",
    `the API answered ${upstream.status}; the BFF does not follow or pass on redirects`,
  );
}

/**
 * An absolute or scheme-relative URL reference (`http://api:8080/...`,
 * `//api:8080/...`): it names a host, which is the API's internal one.
 */
function namesAHost(ref: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref) || /^[\\/]{2}/.test(ref);
}

/**
 * The API's headers minus the dropped set and every `Access-Control-*`
 * header. A `Location` (a 201's, a 202's) passes only as a relative
 * reference: an absolute one would hand the browser the API's internal
 * address (retro-audit S5).
 */
export function downstreamHeaders(upstream: Response): Headers {
  const out = new Headers(upstream.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) out.delete(name);
  for (const name of [...out.keys()]) {
    if (name.startsWith("access-control-")) out.delete(name);
  }
  const location = out.get("location");
  if (location !== null && namesAHost(location.trim())) {
    out.delete("location");
  }
  return out;
}

export type UpstreamResult =
  { ok: true; response: Response } | { ok: false; response: NextResponse };

/**
 * One call to the API under the BFF's own timeout and controller, with
 * redirects not followed. A timeout is a 504 problem and a failure before
 * an answer a 502 problem, both counted. The answer's body stays under the
 * same controller: a read that waits `timeoutMs` for its next chunk aborts
 * the call, errors the body and is counted as a timeout, so a body that
 * stalls after the headers never holds the route open (retro-audit S4).
 */
export async function callUpstream(
  url: URL,
  init: RequestInit & { duplex?: "half" },
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<UpstreamResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
    });
    const guarded = guardResponse(response, {
      signal: controller.signal,
      idleMs: timeoutMs,
      onIdle: () => {
        countAuth("upstream_timeout");
        const reason = new DOMException(
          `no body chunk within ${timeoutMs} ms`,
          "TimeoutError",
        );
        controller.abort(reason);
        return reason;
      },
    });
    return { ok: true, response: guarded ?? response };
  } catch {
    if (timedOut) {
      countAuth("upstream_timeout");
      return {
        ok: false,
        response: problemResponse(
          504,
          "upstream_timeout",
          "Upstream timeout",
          `no answer within ${timeoutMs} ms`,
        ),
      };
    }
    countAuth("upstream_unreachable");
    return {
      ok: false,
      response: problemResponse(
        502,
        "upstream_unreachable",
        "Upstream unreachable",
      ),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether every segment of `pathname` decodes to what the allow-list saw:
 * no encoded `/` or `\`, no `.` or `..` however encoded, nothing that does
 * not decode. The allow-list matches the raw pathname, so
 * `/v1/zones/..%2F..%2Fadmin` would pass it, and what the API does with
 * it depends on its router (retro-audit N7).
 */
export function isPlainPath(pathname: string): boolean {
  for (const segment of pathname.split("/")) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return false;
    }
    if (
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\")
    )
      return false;
  }
  return true;
}

/**
 * Forwards `req` to `target` (docs/PLAN.md §3.16). Refusals happen before
 * any upstream call: a target path outside `allowPaths`, or one with an
 * encoded slash or dot segment (`isPlainPath`), is a 404 problem,
 * an unsafe method without a matching CSRF pair a 403 problem. The answer
 * is the API's own status, body and headers (minus the dropped set); on a
 * 401 the BFF also clears both cookies (the session is gone).
 */
export async function forward(
  req: NextRequest,
  target: URL,
  opts: ForwardOptions,
): Promise<Response> {
  if (
    !isPlainPath(target.pathname) ||
    !opts.allowPaths.some((re) => re.test(target.pathname))
  ) {
    countAuth("proxy_path_refused");
    return problemResponse(404, "not_found", "Not found");
  }
  if (!checkCsrf(req, opts.session)) {
    countAuth("csrf_refused");
    return problemResponse(
      403,
      "csrf_refused",
      "CSRF check failed",
      "send the uspace_csrf cookie's value as X-CSRF-Token",
    );
  }
  const headers = upstreamHeaders(req, opts.trustedProxyHops);
  const token = readSessionToken(req, opts.session);
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);
  const hasBody = isUnsafeMethod(req.method) && req.body !== null;
  const result = await callUpstream(
    target,
    {
      method: req.method,
      headers,
      ...(hasBody ? { body: req.body, duplex: "half" as const } : {}),
    },
    opts.timeoutMs,
    opts.fetch,
  );
  if (!result.ok) return result.response;
  const upstream = result.response;
  if (isRedirect(upstream.status)) return redirectRefused(upstream);
  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: downstreamHeaders(upstream),
  });
  if (upstream.status === 401) clearSession(res, opts.session);
  return res;
}

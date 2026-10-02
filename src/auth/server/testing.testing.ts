// Helpers for the BFF tests: requests, Set-Cookie parsing and a fetch stub.
// Every credential here is a fixture (CLAUDE.md rule 7, WP-5 safety notes).
import { NextRequest } from "next/server.js";
import { vi } from "vitest";

import type { SessionCookieOptions } from "./cookies.js";

export const ORIGIN = "https://console.test";
export const API = "http://api.test:8080";

export const SESSION: SessionCookieOptions = { secure: true, maxAgeS: 3600 };

/** Fixture values only; never a real credential. */
export const FIXTURE = {
  username: "TEST-user-01",
  password: "TEST-fixture-password-01",
  otp: "000000",
  jwt: "TEST.session.jwt",
  csrf: "TEST-csrf-value-01",
  mfaToken: "TEST-mfa-challenge-01",
} as const;

export function request(
  path: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    body?: string;
  } = {},
): NextRequest {
  const headers = new Headers(init.headers);
  if (init.cookies !== undefined) {
    headers.set(
      "cookie",
      Object.entries(init.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    );
  }
  return new NextRequest(new URL(path, ORIGIN), {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: init.body }),
  });
}

export interface ParsedCookie {
  name: string;
  value: string;
  /** Attribute names in lower case; a flag has the value `true`. */
  attrs: Record<string, string | true>;
}

export function parseSetCookie(line: string): ParsedCookie {
  const [pair = "", ...rest] = line.split(";").map((s) => s.trim());
  const eq = pair.indexOf("=");
  const attrs: Record<string, string | true> = {};
  for (const a of rest) {
    if (a === "") continue;
    const i = a.indexOf("=");
    if (i < 0) attrs[a.toLowerCase()] = true;
    else attrs[a.slice(0, i).toLowerCase()] = a.slice(i + 1);
  }
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), attrs };
}

export function setCookies(res: Response): Map<string, ParsedCookie> {
  const out = new Map<string, ParsedCookie>();
  for (const line of res.headers.getSetCookie()) {
    const c = parseSetCookie(line);
    out.set(c.name, c);
  }
  return out;
}

export interface Call {
  url: string;
  init: RequestInit;
  headers: Headers;
  body: string | null;
}

/** A fetch stub answering from `answer`, recording every call. */
export function stubFetch(
  answer: (url: string, call: number) => Response | Promise<Response>,
) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    let body: string | null = null;
    if (typeof init.body === "string") body = init.body;
    else if (init.body instanceof ReadableStream)
      body = await new Response(init.body).text();
    calls.push({ url, init, headers: new Headers(init.headers), body });
    return answer(url, calls.length - 1);
  });
  return { fetch: fn as unknown as typeof fetch, calls, fn };
}

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function problem(
  status: number,
  slug: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      type: `https://schemas.uspace.ge/problems/${slug}`,
      title: slug,
      status,
      detail: `${slug} detail`,
      instance: null,
      errors: [],
    }),
    {
      status,
      headers: { "Content-Type": "application/problem+json", ...headers },
    },
  );
}

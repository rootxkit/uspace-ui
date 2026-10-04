// The example's configuration: config/example.json (the policy values,
// each the spec's default marked "pending GCAA", and the display-only
// map camera) and the environment, read at request time so the image is
// built once and configured at start.
import example from "../config/example.json";

export interface PolicyValue<T> {
  value: T;
  source: string;
  /** "pending GCAA" until the regulator answers. */
  status: string;
}

export const POLICY: {
  sessionMaxAgeS: PolicyValue<number>;
  accessibilityTarget: PolicyValue<string>;
} = {
  sessionMaxAgeS: example.policy.session_max_age_s,
  accessibilityTarget: example.policy.accessibility_target,
};

/** The public map's first view: display-only, from config/example.json. */
export const MAP_INITIAL = {
  center: [example.map.center[0] ?? 0, example.map.center[1] ?? 0] as [
    number,
    number,
  ],
  zoom: example.map.zoom,
  bearing: 0,
  pitch: 0,
};

export interface BffEnv {
  /** The API as this server reaches it (EXAMPLE_API_INTERNAL_URL). */
  apiBase: string;
  /** False only for a plain-HTTP local run (EXAMPLE_SESSION_SECURE=false). */
  secure: boolean;
  /** Reverse proxies in front of Next.js (EXAMPLE_TRUSTED_PROXY_HOPS). */
  trustedProxyHops: number | null;
  timeoutMs: number;
  sessionMaxAgeS: number;
}

/**
 * The BFF's configuration, or the problem with the environment, naming
 * the variable. Without EXAMPLE_API_INTERNAL_URL the BFF talks to the
 * stub API this app serves itself, on the port it listens on.
 */
export function bffEnv(
  env: Record<string, string | undefined> = process.env,
): { cfg: BffEnv } | { problem: string } {
  const port = env["PORT"] ?? "3000";
  const apiBase =
    env["EXAMPLE_API_INTERNAL_URL"] ?? `http://127.0.0.1:${port}/stub-api`;
  const secure = env["EXAMPLE_SESSION_SECURE"] !== "false";
  const rawHops = env["EXAMPLE_TRUSTED_PROXY_HOPS"];
  let trustedProxyHops: number | null = null;
  if (rawHops !== undefined && rawHops !== "") {
    const n = Number(rawHops);
    if (!Number.isInteger(n) || n < 1) {
      return {
        problem: `EXAMPLE_TRUSTED_PROXY_HOPS: want a whole number of at least 1, got ${JSON.stringify(rawHops)}`,
      };
    }
    trustedProxyHops = n;
  }
  if (secure && trustedProxyHops === null) {
    // A secure session needs the proxy said (the kit refuses otherwise).
    return {
      problem:
        "EXAMPLE_TRUSTED_PROXY_HOPS is not set (the reverse proxies in front of Next.js; EXAMPLE_SESSION_SECURE=false for a plain-HTTP local run)",
    };
  }
  return {
    cfg: {
      apiBase,
      secure,
      trustedProxyHops,
      timeoutMs: example.bff.timeout_ms,
      sessionMaxAgeS: POLICY.sessionMaxAgeS.value,
    },
  };
}

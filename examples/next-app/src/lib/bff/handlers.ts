// The three BFF routes (/_bff/login, /_bff/logout, /_bff/api/*) on the
// kit's helpers, and nothing else (docs/PLAN.md §6.3): no database, no
// bus, no key, no judgement, no ticket route. The BFF never verifies a
// token; the API decides every request. The WebSocket, when an app has
// one (`live`), is opened same-origin and the session cookie rides the
// upgrade; it is never proxied here.
import { bffHandlers, type BffHandlers } from "@rootxkit/uspace-ui/auth/server";
import { NextResponse, type NextRequest } from "next/server";
import { bffEnv } from "../../config";

/**
 * What the console may reach through the proxy: the zones and nothing
 * else. `allowPaths` is matched against the whole upstream path, which
 * starts with `apiBase`'s own path (`/stub-api` for the stub).
 */
export function proxyAllowPaths(apiBase: string): RegExp[] {
  const prefix = new URL(apiBase).pathname
    .replace(/\/$/, "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [new RegExp(`^${prefix}/v1/zones$`)];
}

type Handler = (req: NextRequest) => Promise<Response>;

let cached: BffHandlers | null = null;

function unavailable(detail: string): Handler {
  return () =>
    Promise.resolve(
      NextResponse.json(
        {
          type: "https://schemas.uspace.ge/problems/bff_unavailable",
          title: "Console unavailable",
          status: 503,
          detail,
        },
        {
          status: 503,
          headers: {
            "Content-Type": "application/problem+json",
            "Cache-Control": "no-store",
          },
        },
      ),
    );
}

/** The handlers for this process, built at the first request (the build has no environment). */
export function bff(): BffHandlers {
  if (cached !== null) return cached;
  const env = bffEnv();
  if ("problem" in env) {
    const off = unavailable(env.problem);
    return { login: off, logout: off, proxy: off };
  }
  const { cfg } = env;
  cached = bffHandlers({
    apiBase: cfg.apiBase,
    apiLoginPath: "/v1/auth/login",
    apiLogoutPath: "/v1/auth/logout",
    session: { secure: cfg.secure, maxAgeS: cfg.sessionMaxAgeS },
    allowPaths: proxyAllowPaths(cfg.apiBase),
    timeoutMs: cfg.timeoutMs,
    ...(cfg.trustedProxyHops === null
      ? {}
      : { trustedProxyHops: cfg.trustedProxyHops }),
  });
  return cached;
}

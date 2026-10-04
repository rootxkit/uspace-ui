// Next.js request proxy (the middleware): a fresh CSP nonce per page.
// The nonce is set, never read, on a copy of the request headers, so a
// client-sent x-nonce is overwritten; the layout reads it from
// CSP_NONCE_HEADER and hands it to CspNonceProvider, and Next.js stamps
// its own scripts with the nonce it finds in the request's CSP header.
import {
  CSP_NONCE_HEADER,
  issueCspNonce,
} from "@rootxkit/uspace-ui/auth/server";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "./src/csp";

export function proxy(req: NextRequest): NextResponse {
  const nonce = issueCspNonce();
  const csp = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
  );
  const headers = new Headers(req.headers);
  headers.set(CSP_NONCE_HEADER, nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  // Pages only: not Next's assets, the BFF, the stub API or the basemap.
  matcher: ["/((?!_next/|_bff/|stub-api/|basemap/|favicon\.ico).*)"],
};

// `@rootxkit/uspace-ui/auth/server` (docs/PLAN.md §3.16, WP-5): the BFF
// helpers. `server-only` first: imported from a client component, the
// build fails, so the session JWT has no path into browser code.
import "server-only";

export {
  BFF_API_PREFIX,
  BFF_LOGIN_PATH,
  BFF_LOGOUT_PATH,
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
  isUnsafeMethod,
  type LoginResult,
} from "../contract.js";
export {
  sessionClaimsUnverified,
  sessionDisplay,
  type UnverifiedSessionClaims,
} from "./claims.js";
export {
  checkCsrf,
  clearSession,
  issueCsrf,
  readSessionToken,
  setSession,
  type CookieReader,
  type SessionCookieOptions,
} from "./cookies.js";
export {
  authCounters,
  resetAuthCountersForTests,
  type AuthCounter,
} from "./counters.js";
export {
  DROPPED_RESPONSE_HEADERS,
  FORWARDED_REQUEST_HEADERS,
  forward,
  type ForwardOptions,
} from "./forward.js";
export {
  bffHandlers,
  type BffHandlers,
  type BffOptions,
  type RouteHandler,
} from "./handlers.js";

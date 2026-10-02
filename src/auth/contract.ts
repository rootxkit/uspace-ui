// The session and cookie contract shared by the four systems
// (docs/PLAN.md §6.3; cross-plan decisions M20, M21, M22). Changing any
// of these names is a plan change in five repositories. Imported by both
// `auth/server` and `auth/client`, so it holds names only, no secret and
// no server code.

/** The cookie holding the API-issued session JWT (`HttpOnly`). */
export const SESSION_COOKIE = "uspace_session";

/** The double-submit CSRF cookie, readable by the page. */
export const CSRF_COOKIE = "uspace_csrf";

/** The header an unsafe request carries the CSRF cookie's value in. */
export const CSRF_HEADER = "X-CSRF-Token";

/** The three BFF routes every `web/` mounts (02 §3); no ticket route (M22). */
export const BFF_LOGIN_PATH = "/_bff/login";
export const BFF_LOGOUT_PATH = "/_bff/logout";
export const BFF_API_PREFIX = "/_bff/api";

/** Methods that change nothing; every other method needs the CSRF pair. */
export const SAFE_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
]);

/** True for a method that needs the CSRF pair (anything but GET, HEAD, OPTIONS). */
export function isUnsafeMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

/**
 * What the BFF's `login` route answers with on a 2xx. The session JWT is
 * never in it (06 §3): it is in the `HttpOnly` cookie.
 *
 * - `signed_in`: the cookies are set. `recoveryCodes` are present once,
 *   at the sign-in that confirms MFA enrolment, and must be shown then.
 * - `mfa_required`: the password was accepted and the API asks for a
 *   one-time code; send the same form again with `otp`. `enrolment` is
 *   present while the account has no confirmed authenticator.
 */
export type LoginResult =
  | { status: "signed_in"; recoveryCodes?: string[] }
  | {
      status: "mfa_required";
      enrolment?: { secret: string; otpauthUri: string };
    };

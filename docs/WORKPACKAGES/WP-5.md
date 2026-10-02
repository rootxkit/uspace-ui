# WP-5: `auth/server` and `auth/client` (BFF session cookie, CSRF, forwarding, login)

Branch `feat/WP-5-bff-auth`. Milestone U-M1. Owns `src/auth/`
exclusively. Depends on WP-0 (and WP-1 `ui` for the login form's
widgets; start on WP-0, rebase). Consumers: every `web/` (the three BFF
routes), WP-8 (`live` relies on the session cookie the BFF set: the
browser sends it on the same-origin WebSocket upgrade; there is no
ticket, reconciliation M22).

## Read first

1. `docs/PLAN.md` §3.1 (`SessionDisplay`), §3.16, §6.3 (the session and
   cookie contract: route set, cookie names, the reconciled session JWT
   shape, WebSocket authentication; adopted by all four systems), §7
   (every row), §14 Q9 (decided: `roles[]`, `realm`).
2. Spec `06 §3` (the `HttpOnly`, `SameSite=Strict` cookie holding the
   session JWT, forwarded as a bearer; CSRF tokens; no credential in
   browser JavaScript; MFA mandatory for some roles), `00 §6.2` ("The
   Next.js BFF never verifies tokens; it carries the cookie"), `02 §3`
   (`web` has only BFF routes under `/_bff/*`), `01` (user classes and
   roles per system; the login is against the system's own `api`),
   `06 §4` (no secret in the repo, ever).
3. LESSONS S-15 (login rate limits are the API's; the form shows the
   refusal), B-10 (`Retry-After`), E-14 (shared work never on one
   caller's cancellable context: the proxy's upstream timeout is its
   own).
4. Next.js App Router route handlers, `NextRequest`/`NextResponse`
   cookies API, `server-only`; the `Set-Cookie` attributes RFC 6265bis
   (`__Host-` prefix consideration).
5. This project's safety rules on credentials: the kit's login form is
   tested with fixture values only; no real credential ever appears in
   a test or a fixture.

## What to build

**Server.** `SessionCookieOptions` with defaults (`uspace_session`,
`uspace_csrf`, `SameSite=Strict`, `HttpOnly`, `Secure` when `secure`,
`Path=/`); `setSession`, `clearSession`, `readSessionToken`,
`issueCsrf` (random 32 bytes, base64url, cookie not `HttpOnly` so the
client can read it), `checkCsrf` (constant-time compare of cookie and
header), `forward(req, target, opts)` (allow-list of path regexes,
method pass-through, `Authorization: Bearer` from the session cookie,
`Cookie` header stripped, `Accept-Language`, `Content-Type`, body
streamed, upstream timeout via its own `AbortController`, no redirect
following, upstream status and headers passed through including
`Retry-After`, `ETag`, `Sunset`, `Content-Type: application/problem+json`;
a hop-by-hop header list removed), `bffHandlers(opts)` producing the
three route handlers: `login` (POST JSON `{username, password, otp?}` to
the API's login path given in `opts`, on 2xx stores the returned JWT
and issues a CSRF cookie, on 401/429 passes the problem and
`Retry-After` through, never logs the body), `logout` (clears both
cookies and, if `opts.apiLogoutPath`, tells the API), `proxy`
(`forward` for `/_bff/api/*` → `opts.apiBase`). There is no WebSocket
ticket route (M22): the BFF cannot proxy a WebSocket and a ticket in a
query string ends up in access logs; the browser opens the system's WS
same-origin and the `uspace_session` cookie travels on the upgrade,
where the WS process checks `Origin` and verifies it. `README.md` says
this in the BFF section so no `web/` adds a ticket route of its own.
`sessionClaimsUnverified(jwt)`: base64url-decodes the payload without
verifying, returns `sub`, `exp`, `roles` (an array; `[]` when the claim
is absent or not an array, never derived from `scope`) and `realm`
(`null` when absent); the name and the doc comment say it is for
display only. The reconciled session shape it reads (PLAN §6.3, M20):
`scope = "session"`, `roles: [string]`, `realm` ∈ `console` / `police`
/ `portal`, `aud` = the system's own host, `jti`, `exp` ≤ 12 h.

**Client.** `SessionProvider`, `useSession`, `LoginForm` (username,
password with `autocomplete="current-password"`, optional OTP field
with `autocomplete="one-time-code"`, submit to `action`, shows the
problem `detail` and a countdown from `retryAfterS`, never puts a value
in the URL, clears the password field on failure), `RequireRole`
(display gating: renders children when `session.roles` intersects
`anyOf`), `csrfToken()`.

## Tests

- Server (node, mocked `NextRequest`/`NextResponse` and a `fetch` stub):
  `setSession` sets exactly the attributes (parse the `Set-Cookie`
  string; `HttpOnly`, `SameSite=Strict`, `Secure` when `secure: true`
  and absent when `false`, `Max-Age`); `clearSession` expires both;
  `checkCsrf` passes a matching pair and fails a missing header, a
  mismatched header and a missing cookie (E-01); `forward` adds the
  bearer and strips `Cookie`; refuses a path outside `allowPaths` with
  404 *without* calling upstream (assert the stub was not called); does
  not follow a 302 (passes it through); passes `Retry-After` and a
  problem body through unchanged; times out upstream with its own
  controller and returns 504 with a problem body; `login` on 2xx sets
  cookies and on 401 does not (pair); the login body never appears in
  any log call (spy on `console`); `bffHandlers` returns exactly the
  three handlers and no `wsTicket` key (a type-level test, so a
  consumer that mounts a fourth route fails to compile against the kit).
- `sessionClaimsUnverified`: a token with a bad signature still decodes
  (that is the point; the test names it), a malformed token gives
  `null`, an `exp` in the past is still returned (display decides); a
  payload with `roles: ["supervisor", "incident_officer"]` returns both
  in order; a payload with no `roles` returns `[]`; a payload with
  `roles: "supervisor"` (a string, the pre-reconciliation shape) returns
  `[]` and is counted, never `["supervisor"]`; `realm` is passed
  through and `null` when absent.
- Client (jsdom): `LoginForm` submits with `fetch` to `action`; on 429
  with `Retry-After: 30` shows the countdown and disables submit until
  it reaches zero (fake timers); the password input is cleared on
  failure; `RequireRole` renders children when one of several `roles`
  matches, and the fallback when none does or `roles` is empty (pair).
- Browser tests: `LoginForm` in both languages and schemes with `axe`;
  golden DOM snapshot.

## Done when

- [ ] PLAN §3.16 implemented; API report updated; `auth/server` carries
  `import "server-only"` and `attw` shows it is not importable from a
  browser condition.
- [ ] The three handlers mounted in a route file example in `README.md`
  (the real example app is WP-13), with the sentence that the WebSocket
  is opened same-origin on the cookie and that the kit has no ticket
  route.
- [ ] No credential-shaped string in the repo (`gitleaks` green; a
  reviewer reads the fixtures).
- [ ] `pnpm check`, `pnpm test`, `pnpm test:browser` outputs in the PR.

## Safety notes

The BFF is the only place in a `web/` that holds a secret-bearing value
(the session JWT) and it must never let it reach browser JavaScript, a
log line, a URL or a WS handshake. The kit does not verify tokens
(spec), so nothing here grants anything: the API decides every request.
`RequireRole` is a courtesy to the layout, and the doc comment says so.

## Commits

`feat(auth): add the session and CSRF cookie helpers for the BFF [WP-5 U-M1]`,
`feat(auth): add the allow-listed BFF forward and the three route handlers [WP-5 U-M1]`,
`feat(auth): add the client session provider, login form and display gating [WP-5 U-M1]`,
`test(auth): cover cookie attributes, CSRF pairs, forwarding refusals and the roles claim [WP-5 U-M1]`.

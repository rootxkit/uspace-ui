# Consuming `@rootxkit/uspace-ui` in a `web/`

The step list for a system's Next.js app (`uspace-cisp`,
`uspace-authority`, `uspace-ussp`, `uspace-ansp`, the lab). Every step
is shown working in [`examples/next-app/`](../examples/next-app/), which
CI builds against the kit's current source and smokes in Chromium on
every pull request. The rules behind the steps are `docs/PLAN.md` §6.3
(the contracts), §7 (security) and §11 (consumption). This guide is for
`1.8.0`.

## 1. Install the release tarball with pnpm

The kit is a GitHub Release asset of this repository, not an npm
package (PLAN D10, as the owner changed it on 2026-10-02;
[`RELEASING.md`](RELEASING.md)). Pin one asset URL exactly. pnpm is the
only package manager (M34): `packageManager` pinned, `pnpm-lock.yaml`
committed, and every CI job and Docker build installs with `pnpm
install --frozen-lockfile`.

```jsonc
// web/package.json
{
  "packageManager": "pnpm@11.9.0",
  "dependencies": {
    "@rootxkit/uspace-ui": "https://github.com/rootxkit/uspace-ui/releases/download/v1.8.0/rootxkit-uspace-ui-1.8.0.tgz",
    "maplibre-gl": "5.24.0",
    "next": "16.3.8",
    "react": "19.3.0",
    "react-dom": "19.3.0",
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.3.3",
    "tailwindcss": "4.3.3",
    "eslint": "9.39.5",
    "eslint-plugin-jsx-a11y": "6.10.2",
    "eslint-plugin-react-hooks": "7.1.1",
    "typescript-eslint": "8.71.0",
  },
}
```

- `pnpm install` writes the tarball's `sha512` integrity into
  `pnpm-lock.yaml`; `--frozen-lockfile` then refuses an asset whose
  bytes changed. The repository is public: no token, no `.npmrc`.
- Before pinning, check the asset's signed build provenance:

  ```sh
  gh release download v1.8.0 --repo rootxkit/uspace-ui --pattern 'rootxkit-uspace-ui-1.8.0.tgz'
  gh attestation verify rootxkit-uspace-ui-1.8.0.tgz --repo rootxkit/uspace-ui \
    --signer-workflow rootxkit/uspace-ui/.github/workflows/release.yml
  ```

- The tarball is built output only: no `prepare` step, no
  devDependency of the kit in your image.
- Peers are yours: `react` and `react-dom` 19, `maplibre-gl` 5, `next`
  15 or later; `react-hook-form` 7.55+ and `zod` 4 if you use `form`;
  the ESLint packages above for `eslint`. With pnpm's
  `autoInstallPeers: false`, list each one you use.
- Never a `github:` spec, a branch, or a range. A pre-release
  (`0.1.0-rc.N`) is pinned the same way.

## 2. CSS

```css
/* web/app/globals.css */
@import "tailwindcss";
@import "@rootxkit/uspace-ui/styles/tokens.css";
@import "@rootxkit/uspace-ui/styles/map.css";
@import "@rootxkit/uspace-ui/fonts/fonts.css";
@source "../node_modules/@rootxkit/uspace-ui/dist";
```

`@source` makes your Tailwind scan the kit's compiled components, so
their classes exist (D4, §14 Q13). `postcss.config.mjs` is `{ plugins:
{ "@tailwindcss/postcss": {} } }`. No `transpilePackages`: the kit
ships compiled ESM, and the example builds without it.

## 3. The root layout

```tsx
// web/app/layout.tsx (server component)
import { cookies, headers } from "next/headers";
import { CSP_NONCE_HEADER, readSessionToken, sessionDisplay } from "@rootxkit/uspace-ui/auth/server";
import { fontClassName } from "@rootxkit/uspace-ui/fonts";
import { LANG_COOKIE, negotiateLang } from "@rootxkit/uspace-ui/i18n";
import { SCHEME_COOKIE, brandFromEnv, parseScheme, schemeAttribute } from "@rootxkit/uspace-ui/theme";

export const dynamic = "force-dynamic"; // the nonce, the language and the session are per request

export default async function RootLayout({ children }) {
  const jar = await cookies();
  const h = await headers();
  const lang = negotiateLang(h.get("accept-language"), jar.get(LANG_COOKIE)?.value ?? null);
  const session = sessionDisplay(readSessionToken(jar)); // display only, decoded unverified
  const nonce = h.get(CSP_NONCE_HEADER) ?? undefined;
  const scheme = schemeAttribute(parseScheme(jar.get(SCHEME_COOKIE)?.value)); // 1.0.0: no first-paint flash
  return (
    <html lang={lang} className={fontClassName} data-theme={scheme} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {/* a client component: CspNonceProvider > ThemeProvider brand={brandFromEnv(process.env)}
            > I18nProvider lang catalogues onLangChange > SessionProvider session */}
      </body>
    </html>
  );
}
```

- **Fonts**: `fontClassName` on `<html>` loads Noto Sans and Noto Sans
  Georgian through `next/font/local` from the package. No Google Fonts,
  no font request off your origin (D7).
- **Colour scheme** (1.0.0): render `data-theme` on `<html>` with
  `schemeAttribute` from the `uspace_scheme` cookie, so an explicit
  scheme is painted from the first byte. For `system` (or no cookie) it
  renders nothing, and `tokens.css` follows `prefers-color-scheme` until
  `ThemeProvider` sets `data-theme`: a dark preference no longer paints
  light first and turns dark after hydration. `suppressHydrationWarning`
  because `ThemeProvider` sets the attribute on the client.
- **Branding** is configuration: `UI_BRAND_NAME`, `UI_BRAND_SHORT_NAME`,
  `UI_BRAND_LOGO_URL`, `UI_BRAND_CONTACT`, `UI_BRAND_ACCENT`, read at
  request time with `brandFromEnv(process.env)`.
- **Language**: the `uspace_lang` cookie, then `Accept-Language`, then
  `ka`. `I18nProvider`'s `onLangChange` is where the app writes the
  cookie (the kit never does) and asks the server to render again
  (`router.refresh()`); `<html lang>` follows. Your own strings go in
  your `ka` and `en` catalogues, passed as `catalogues`.
- **Session**: `SessionProvider` gets the display claims (`sub`,
  `roles`, `realm`, `exp`); `RequireRole anyOf={[...]}` hides what a role
  does not use and grants nothing. The API decides every request.

## 4. Lint

```js
// web/eslint.config.js
import kit from "@rootxkit/uspace-ui/eslint";
export default [{ ignores: [".next/**", "next-env.d.ts"] }, ...kit /* , your rules */];
```

The kit's rules fail a geometry or geodesy import, a database or bus
client, business logic in a route handler under `app/api/**` or
`app/%5Fbff/**` (which may import only `@rootxkit/uspace-ui/auth/server`,
`next/*` and `lib/bff/*`), and a hand-written type in the generated
directory. Run `eslint --max-warnings 0 .` in CI (`next lint` is gone
in Next.js 16).

## 5. The BFF: three routes, two cookies

The BFF is `/_bff/login`, `/_bff/logout` and `/_bff/api/*` and nothing
else (the session contract every system shares). Next.js ignores App
Router folders whose name starts with `_`, so they live under
`app/%5Fbff/`. Build the handlers once, in `src/lib/bff/handlers.ts`:

```ts
import { bffHandlers } from "@rootxkit/uspace-ui/auth/server";

export const bff = bffHandlers({
  apiBase: process.env.API_INTERNAL_URL!, // the API as the web container reaches it
  apiLoginPath: "/v1/auth/login",
  apiLogoutPath: "/v1/auth/logout",
  session: { secure: true, maxAgeS: 12 * 3600 },
  allowPaths: [/^\/v1\/zones$/], // matched against the whole upstream path
  timeoutMs: 10_000,
  trustedProxyHops: 1, // one reverse proxy in front; or noTrustedProxy: true
});
```

```ts
// app/%5Fbff/login/route.ts, app/%5Fbff/logout/route.ts
export const POST = bff.login; // bff.logout
// app/%5Fbff/api/[...path]/route.ts
export const GET = bff.proxy; // and POST, PUT, PATCH, DELETE
```

- The session JWT the API issues is in `uspace_session` (`HttpOnly;
  Secure; SameSite=Strict`); page script never sees it. `uspace_csrf`
  is readable and goes back as `X-CSRF-Token` on every unsafe request
  (`createClient({ csrfToken })` does it). Sign-in, before there is a
  CSRF cookie, needs a same-origin `Origin`.
- With an MFA step, add `apiMfaPath` and `mfaChallengeSecret` (at least
  32 bytes, from the secret store); the README's "BFF session" has the
  sequence.
- `allowPaths` is matched against the upstream path **including the
  path of `apiBase`**: with `apiBase` `http://api:8080/console`, allow
  `^/console/v1/...`. The example builds the pattern from `apiBase`.
- With `session.secure`, `bffHandlers` throws unless it gets
  `trustedProxyHops: n` or `noTrustedProxy: true` (new in `0.1.0`). A
  module that builds the handlers at the first request, as the example
  does, can answer `503` naming the missing variable instead of
  throwing.
- `<LoginForm action="/_bff/login" onSuccess={...} />` is the sign-in
  page. A refusal shows the API's `detail`.

## 6. The WebSocket: same-origin, on the cookie, no ticket

The BFF cannot proxy a WebSocket and has no ticket route. A page that
uses `live` opens its system's WebSocket on the page's own origin; the
`uspace_session` cookie travels on the upgrade, where the WS process
checks `Origin` against its allow-list and verifies the cookie. A close
with `4401` means "sign in again" (`onUnauthorized`). Never put a token
in a URL or a subprotocol. The example opens no WebSocket.

## 7. Generated API types and the client

```jsonc
// web/package.json "scripts"
"gen:api": "uspace-ui-gen-api ../api/openapi.yaml src/api/generated/openapi.d.ts",
"check:api": "uspace-ui-gen-api ../api/openapi.yaml src/api/generated/openapi.d.ts --check"
```

Commit the output, list it in `.prettierignore` (a formatter would make
`--check` fail), and run `pnpm check:api` in CI. If a formatter touches
`openapi.yaml`, regenerate: the header records the input's SHA-256.

```ts
import { createClient } from "@rootxkit/uspace-ui/api";
import { csrfToken } from "@rootxkit/uspace-ui/auth/client";
import type { paths } from "./generated/openapi";
export const api = createClient<paths>({ baseUrl: "/_bff/api", csrfToken: () => csrfToken(), lang });
```

A non-2xx answer rejects with an `ApiError`; the client never retries.
`freshnessOf(response, body)` reads the `ETag` and the CISP's
`cis_version`, `cis_updated_at`, `cis_age_s` and `stale` (point it
elsewhere with a pick, such as `updatedAt: "metadata.issued"` for the
authority's export).

### Periodic reads

What no console frame carries (a summary, a queue, a list) is read on a
period with `usePolling`, not with a `setInterval` of your own:

```tsx
import { usePolling } from "@rootxkit/uspace-ui/live";

const summary = usePolling(
  async (signal) => (await api.GET("/v1/requests/summary", { signal })).data ?? null,
  SUMMARY_READ_PERIOD_MS, // a display period of yours, not a threshold
  { enabled: signedIn, key: "summary:requests" },
);
// summary.data, summary.error, summary.loading, summary.lastOkAtMs,
// summary.failingSinceMs, summary.reload()
```

- Pass the `signal` to the request: it is aborted on unmount, when
  `enabled` goes false and when `key` or the period changes.
- Pass `enabled` from your session. A page that polls without one asks
  for a `401` every period.
- `read` may be an inline function; put what it closes over (an id, a
  filter, a cursor) in `key`, and a change starts over. Until the new
  read settles, `loading` is true and `data` is still the previous
  key's: do not draw it as the new key's.
- A failure does not clear `data`. Show `error` beside it, with
  `failingSinceMs` and `lastOkAtMs`, so a page that cannot read says
  since when; it is never an empty page.
- After your own `POST` or `PUT`, call `reload()`.
- A hidden page does not read. That is what lets the server's idle
  sign-out fire for a tab left open in the background; `whileHidden:
  "poll"` gives that up, for the one display that must stay current
  unseen. Reads resume by themselves when the page is shown.
- It only reads. Never hand it a request with a side effect.

`useNowMs` pauses the same way: no tick while the page is hidden, one
at once when it is shown.

## 8. Adapters: the one hand-written mapping

Each `web/` maps its generated types onto the kit's view models
(`@rootxkit/uspace-ui/model`) in an adapter it owns, copying what the
API said and deciding nothing (`examples/next-app/src/map/adapt.ts`):

- `extendedProperties.cis_applicability` onto `ZoneView.applies`:
  `applies` is `true`, `not_applicable` is `false`, `unknown` or absent
  is `null`. Ask with `?applies_at=<RFC 3339>`; the API evaluates it,
  never the page (spec 02 F3; M17). The kit dims only on `false`.
- Limits only when the API gave metres, with their reference; never a
  conversion in TypeScript.
- The geometry as served.

## 9. The basemap

`MapView` reads `${origin}/basemap/` (`basemap={{ baseUrl:
window.location.origin }}`; the paths default to the bundle layout of
PLAN §6.3: `basemap.pmtiles`, `SOURCE.json`, `fonts/`, `sprites/v4/`).
The deployment's reverse proxy serves `/basemap/*` from one
shared read-only volume on every host, with range requests and long
cache headers; the bundle is the lab's (WP-L3). Your image contains no
tiles, and the page shows the extract's OSM date. The map's first view
is configuration, not a constant in code.

## 10. The Content Security Policy

Set it per request in the middleware (`proxy.ts` in Next.js 16), with a
fresh nonce from `issueCspNonce()`: always `set` `CSP_NONCE_HEADER` on a
copy of the request headers, never read a client's.

```
default-src 'self'; script-src 'self' 'nonce-N' 'strict-dynamic';
style-src 'self' 'nonce-N'; img-src 'self' data: blob:; font-src 'self';
connect-src 'self'; worker-src blob:; child-src blob:; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

`connect-src 'self'` covers the API through the BFF, the WebSocket and
the basemap; a console makes no third-party request, ever. `worker-src
blob:` is MapLibre's. No `unsafe-eval` (development may add it for the
dev server only). Hand the nonce to `CspNonceProvider` (Radix
ScrollArea injects a `<style>`). Two things the example's smoke found:

- A `style` attribute rendered on the server (`<div style={{ height: 480
  }}>` in a component that renders on the server) is refused by
  `style-src` without `'unsafe-inline'`. Use a class
  (`className="h-[480px]"`); a style set by script after hydration is
  allowed.
- Middleware does not run for `_next/` assets; exclude `_bff/` and
  `basemap/` from its matcher too, and check the header on every page
  response, including the RSC payloads of client navigations.

## 11. The Docker image

`output: "standalone"` in `next.config`, and the image built in CI and
pulled by tag; a server never runs `next build` (spec `05 §6`). The
example's `Dockerfile` is the recipe:

```dockerfile
FROM node:22-alpine@sha256:<digest> AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine@sha256:<digest> AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
CMD ["node", "server.js"]
```

The lockfile pins the kit's tarball integrity, so the image installs
exactly the bytes that were reviewed; nothing of the kit is built in it.
`pnpm-workspace.yaml` carries pnpm's settings (`allowBuilds` with
`sharp: false`, `autoInstallPeers: false`).

## Upgrading

A `web/` pins an exact version and bumps it in its own pull request:
replace the URL, `pnpm install`, commit the lockfile, and run its own
lint, build and tests against its adapters (PLAN §11). Before `v1.0.0`
an export may change in a minor; that version's `CHANGELOG.md` section
says what moved and what a consumer must do. From `v1`, a removal, a
renamed prop, a changed meaning of a colour, shape or pattern, a
changed wording rule, a changed cookie name or BFF route set, or a
changed console frame is a major, and two majors are maintained for six
months (PLAN §12). A system is never forced to upgrade in step with
another.

From `0.1.0-rc.1` to `0.1.0`: the `alerts` stub export `ENTRY` is gone,
and a secure `bffHandlers` needs `trustedProxyHops` or `noTrustedProxy:
true`.

From `0.1.0` to `1.0.0` (the API freeze): replace the asset URL and
commit the lockfile. The `CHANGELOG.md` section "What a consumer on 0.1.0
does" lists the four cases that need an edit (a `@beta` export, an
exhaustive switch over a counter union, a hand-built status body, a page
without `data-theme`); every export the four consoles imported at their
pins is `@public`. New in `1.0.0` and worth taking: `schemeAttribute` on
`<html>` (§3), `ThresholdsPanel` over `LiveStatus.extras.thresholds`,
and `DrawLayer` with `OutlineFields` where a page lets a person draw an
outline (a circle's outline is your API's to draw, with uspace-core's
geodesy, and to hand back as `circleOutline`).

From `1.0.0` to `1.1.0` (the console redesign): replace the asset URL
and commit the lockfile; nothing needs an edit. Every existing component
keeps its props and its meanings (no legend colour changed); the
surfaces, borders and text of both schemes are refined, so a page looks
new without a change. To take the new frame, wrap the layout in
`AppShell` (navigation groups with `active` from your router, a
`renderLink` for `next/link`, the environment from configuration, a
`StatusPill` fed by your feed's `connection` and the server's `stale`),
open each page with `PageHeader`, and put lists, tables and maps in
`Panel` and `MapPanel` (the map's height is a class, never a style, so
the CSP of §7 holds). `StatTile` and `StatusBadge` take a `StatusTone`
and always the status in words. `examples/next-app` shows every one of
them on `/dashboard`.

From `1.1.0` to `1.1.1` (table cells wrap): replace the asset URL and
commit the lockfile. `TableHead`, `TableCell` and `DataTable` cells now
wrap, so a long text cell no longer widens a table past its container.
A `TableCell` holding an id, a code, a timestamp or a number takes
`className={TABLE_NOWRAP}` (from `@rootxkit/uspace-ui/ui`) to stay on
one line; `DataTable`'s `num`, `utc`, `age` and `mono` `text` columns
already do, and any helper takes `nowrap` to say otherwise. A local
override that made a kit table cell wrap can be removed.

From `1.1.x` to `1.2.0` (identification reason `details_unavailable`,
uspace-core v1.8.0): replace the asset URL and commit the lockfile. A
track whose reason is `details_unavailable` is pending, not judged: the
Service Provider's details have not been fetched yet. Show it as the
kit does, never as `no_serial`. Code that switches exhaustively over
`IdentReason`, or keeps its own `Record<IdentReason, ...>`, needs the new
case; nothing else needs an edit.

From `1.2.0` to `1.3.0` (an identification that was not judged is
pending, spec 04 §3.2, LESSONS G-13): replace the asset URL and commit
the lockfile. `TrackLayer`, `IdentificationLegend`, `TrackDetail` and
the table's `ident()` column draw `details_unavailable` and
`registry_unavailable` as `pending` (muted `--us-ident-pending`, the
mark "…", the missing input named) instead of the status the block
carries; judged `unidentified` is unchanged. `IdentKey` gains
`"pending"`: a `Record<IdentKey, ...>` of your own needs the key, and
counts built from `identDrawn` gain a `pending` row that is not an
attention status. A local rule that singled out `details_unavailable`
can go: ask `isJudged(identification)`, or name the input with
`IDENT_PENDING_KEYS[unjudgedReason(reason)]`.

From `1.3.0` to `1.3.1` (the built JavaScript ships without comments):
replace the asset URL and commit the lockfile. The `.d.ts` files, and
so the doc comments your editor shows, are unchanged; nothing needs an
edit.

From `1.3.1` to `1.3.2` (a `DataTable` keyboard move is not lost):
replace the asset URL and commit the lockfile. No export, prop or
string changes; nothing needs an edit.

From `1.3.2` to `1.4.0` (a manned-emergency `restriction_activated`
names its aircraft): replace the asset URL and commit the lockfile. No
export or prop changes; four catalogue keys are added, and an app that
overrides the catalogue adds them in `en` and `ka`.

From `1.4.0` to `1.5.0` (the identification reason
`registration_mismatch`): replace the asset URL and commit the
lockfile. No export or prop changes. `IDENT_REASONS` and `isIdentReason`
gain the value, so an adapter that checks a reason with them now
accepts it; an app that keeps its own list of reasons adds it. Three
catalogue keys are added, and an app that overrides the catalogue adds
them in `en` and `ka`.

From `1.5.0` to `1.5.1` (the user menu's trigger passes axe-core 4.14's
`label-content-name-mismatch`): replace the asset URL and commit the
lockfile. No export or prop changes, and no key is added; the
trigger's accessible name is still "Account menu: {user}". One `ka`
string changes: `ui.next_page` is "შემდეგი გვერდი", so an app that
overrides it keeps the visible "შემდეგი" in it. The avatar's initials are drawn
by CSS from `data-initials`, so a test that read them as the trigger's
text reads that attribute instead.

From `1.5.1` to `1.6.0` (`ClusterLayer` draws the server's clusters of
Network RID peer flights, F3411 NET0480): replace the asset URL and
commit the lockfile. Additive only: `ClusterLayer`, `ClusterLayerProps`
(`layers`) and `ClusterView` (`model`) are new, with beta helpers
beside them; nothing existing changes, and no catalogue key is added.
An app shows clusters by mapping the server's cluster message to
`ClusterView`s and rendering `<ClusterLayer clusters={...} />` over its
map; the layer measures nothing.

From `1.6.0` to `1.6.1` (the sidebar's collapse button grows with its
label): replace the asset URL and commit the lockfile. No export, prop
or key changes. The button is no longer a fixed 2rem high; with the
`ka` label it is two lines high.

From `1.6.1` to `1.7.0` (a track's age is the age of its observation;
the feed client notices a silent server; Apache-2.0): replace the asset
URL and commit the lockfile. No export or prop is removed or changed,
so the upgrade compiles as it is, but a console that stops there still
draws a sample that arrived old as fresh. Do these four things:

1. Pass the feed's clock offset to both layers:
   `<TrackLayer clockOffsetMs={feed.clockOffsetMs} />` and
   `<MannedLayer clockOffsetMs={feed.clockOffsetMs} />`
   (`LiveStatus.clockOffsetMs`; null until the first status frame).
   Without it the layers cannot age a sample from its `capturedAt`.
2. In the adapter, map the server's `state` and `age_s` of a track to
   `serverState` (`TrackServerState`: `live`, `stale`,
   `source_disabled`) and `serverAgeS` on `TrackView` and `MannedView`,
   where the system's API sends them. A track is then never drawn
   fresher than the server says it is, and `TrackDetail` shows the
   server's state. Leave them unset where the API does not send them;
   never derive them in TypeScript.
3. Replace the console's own `ageS(track, nowMs)` on a track with
   `observedAgeS(track, nowMs, feed.clockOffsetMs)` (`live`), and its
   own `ageBucket(...)` on a track with
   `freshnessBucket(observedAgeS(...), staleAfterS, track.serverState)`
   (`symbology`). `ageS` is unchanged and on the `"received"` basis is
   still the age of the last delivery, which a sample delivered again
   resets; it is no longer the age to show for a track.
   `sampleReceivedAtMs` is set by the kit's stores, not by the adapter.
4. Expect a silent feed to go `down`. **A change of behaviour:** an
   open socket on which no valid `console/status/v1` arrives within
   `stale_after_s` (the last status frame's own value) is closed by the
   client, which goes `down` with `silent: true` and retries; before
   `1.7.0` it stayed `live` for ever. A server that does not send the
   status frame every 2 s (PLAN §6.3) will be seen to flap.
   `FeedOptions.silentAfterS` (a number of seconds, `"stale_after_s"`
   or `"live_max_age_s"`) sets another bound; no bound is assumed
   before a status frame or the option gives one. `FeedStatusBar` and
   `FrozenOverlay` say "Server silent" themselves; a console with its
   own silent-stream rule can drop it and read `feed.silent` and
   `feed.connection`.

Five catalogue keys are added (`feed.silent`, `detail.server_state`
and `detail.server_state.live`, `.stale`, `.source_disabled`); an app
that overrides the catalogue adds them in `en` and `ka`. The tarball
is licensed under Apache-2.0 (`license` in its `package.json`).

From `1.7.0` to `1.8.0` (periodic reads; a hidden page stops asking
and stops ticking): replace the asset URL and commit the lockfile. No
export or prop is removed or changed, so the upgrade compiles as it is,
but a console that stops there still reads behind a hidden tab, which
keeps its server session active so that an idle sign-out never fires
for it. Do these four things:

1. Replace the console's own periodic reads (a `setInterval` around a
   load hook, a chained `setTimeout`) with `usePolling` (`live`; §7,
   "Periodic reads"). The read becomes the reader, the period stays the
   console's own display period, and what the reader closes over (an
   id, a filter, a cursor) goes in `key`. `data`, `error`, `loading`,
   `lastOkAtMs`, `failingSinceMs` and `reload()` take the place of the
   console's own state; a failure keeps `data`, so show `error` beside
   it with the time since which the reads fail.
2. Pass the reader's `AbortSignal` to the request
   (`api.GET(path, { signal })`), so a read is cancelled on unmount, on
   sign-out and on a change of `key` or of the period.
3. Pass `enabled` from the session ("signed in"). Without it a page
   whose session has ended asks for a `401` on every period.
4. Check what the console does with `useNowMs`. **A change of
   behaviour:** it does not tick while the page is hidden; it re-reads
   the clock the moment the page is shown again and ticks on. Every age
   drawn from it is right when it is seen. A console that timed
   anything but a display with it (a read, a sign-out, a rule that
   decides whether a stream is still live) gets that tick on return
   and not before; give such a rule a timer of its own.

A hidden page that must stay current unseen passes `whileHidden:
"poll"` and accepts that its session stays active. After a failure the
reads slow down by themselves (never sooner than the period nor than
the API's `Retry-After`) and return to the period on the first answer;
a console's own retry or backoff around a periodic read can go. No
catalogue key is added.

## Minimum version per consumer

PLAN §11 (M33): the CISP's `web/` `0.1.0` (public map, console shell);
the ANSP's WP-11 `0.1` (`RestrictionLayer`); the authority's WP-21
(`live`, `TrackLayer`), the USSP's WP-17 intents pages (`form`,
`table`) and traffic pages (`alerts`), and the ANSP's WP-12
(`MannedLayer`) were planned on `0.2` and `0.3`, and every one of those
components is in `0.1.0` (PLAN §12 as amended), so `0.1.0` is the
minimum for all of them.

## Where the example differs from the CISP's `web/`

For the CISP planner (`uspace-cisp/web`, its WP-9 scaffold):

- The CISP pins `1.0.0`. Its `createBff` passes `trustedProxyHops`
  from `CISP_WEB_TRUSTED_PROXY_HOPS`; since `0.1.0`, `bffHandlers` with
  `secure: true` throws without it or `noTrustedProxy: true`, so the
  deployment sets the variable.
- The CISP routes by locale prefix (`/ka`, `/en`, redirected in
  `proxy.ts`); the example keeps one URL per page and switches language
  by the `uspace_lang` cookie. Both negotiate the same way.
- The CISP's public map reads `/public/v1/*` straight from the API
  through the reverse proxy; the example reads zones through the BFF, the console's
  path. The CISP revokes a session with `DELETE` through `forward`; the
  example uses the kit's `logout` with `apiLogoutPath`.
- The CISP's web image uses `node:22-alpine` without a digest; the
  example pins the base image by digest.

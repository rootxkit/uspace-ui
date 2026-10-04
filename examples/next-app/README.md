# examples/next-app: the minimal consumer of `@rootxkit/uspace-ui`

A Next.js App Router app that uses the kit exactly as a system's `web/`
does (`docs/CONSUMING.md`, `docs/PLAN.md` §11): the tokens and `@source`
in `app/globals.css`, `fontClassName`, `ThemeProvider` with the brand
from `UI_BRAND_*`, `I18nProvider` with the language from the
`uspace_lang` cookie and `Accept-Language`, the kit's ESLint config, the
three BFF routes on `bffHandlers`, API types generated with
`uspace-ui-gen-api`, the public zone map (`MapView`, `ZoneLayer`,
`ZoneLegend`, `MapControls`, with "version V, updated T" from
`freshnessOf`), a sign-in page with `LoginForm`, a page behind
`RequireRole`, the Content Security Policy of PLAN §7 (`proxy.ts`,
`src/csp.ts`), `output: "standalone"` and a `Dockerfile`.

It opens no WebSocket: `live` is not used here. An app that uses it
opens its system's WebSocket same-origin, with the `uspace_session`
cookie on the upgrade, never a ticket route.

```
app/                     pages, the BFF routes (app/%5Fbff/ serves /_bff/*) and the stub API routes
src/lib/bff/handlers.ts  the BFF on the kit's auth/server helpers
src/api/                 generated types (pnpm gen:api, from openapi.yaml) and the typed client
src/map/                 the public map and the one hand-written adapter (generated type -> ZoneView)
src/stub/stub.ts         the stub API
config/example.json      the policy values (each "pending GCAA") and the display-only map camera
fixtures/                the stub's test accounts and ED-318 zones (GEO-TEST-*, TEST-*)
docker/                  the Docker build's pnpm lockfile and settings
scripts/smoke.mjs        the smoke test CI runs
```

## The stub API is not a template

`src/stub/stub.ts` answers `POST /stub-api/v1/auth/login`, `POST
/stub-api/v1/auth/logout` and `GET /stub-api/v1/zones` from
`fixtures/`, so the example runs without a system. It signs nothing
(the session JWT is `alg: none`; the BFF never verifies a token and the
stub never reads one back), checks no clock, evaluates no
applicability (`?applies_at=` copies each fixture feature's
`stub_applicability` into `extendedProperties.cis_applicability`),
stores nothing and limits nothing. A system's API does all of that, in
Go. Never copy it into a system.

## Configuration

| Variable | Meaning |
|---|---|
| `EXAMPLE_API_INTERNAL_URL` | The API as this server reaches it. Default: the stub on this server's own port (`http://127.0.0.1:$PORT/stub-api`). |
| `EXAMPLE_TRUSTED_PROXY_HOPS` | Reverse proxies in front of Next.js (one Caddy: `1`). Required with secure cookies; the BFF answers `503 bff_unavailable` naming it otherwise. |
| `EXAMPLE_SESSION_SECURE` | `false` only for a plain-HTTP local run: the cookies lose `Secure`. |
| `UI_BRAND_NAME`, `UI_BRAND_SHORT_NAME`, `UI_BRAND_LOGO_URL`, `UI_BRAND_CONTACT`, `UI_BRAND_ACCENT` | Branding (PLAN §6.3). |
| `EXAMPLE_BASEMAP_ORIGIN` | Build time, smoke test only: rewrites `/basemap/*` to a local server of the browser tests' extract. |

`config/example.json` holds the values a regulator sets. GCAA has not
answered its policy questions, so each is the spec's default, marked
`"status": "pending GCAA"`: the session's 12 h ceiling (spec `00 §6.2`)
and the accessibility target, WCAG 2.2 AA (spec `08` Q15; PLAN §14
Q11). The footer shows the target and its status.

## The basemap

The app serves no tiles and its image holds none. A deployment's Caddy
(`uspace-deploy`) serves `/basemap/*` from the shared read-only volume
the lab's basemap bundle is on, and `MapView` reads it at
`${origin}/basemap/` (`BasemapConfig.baseUrl` is the page's origin; the
paths default to the bundle layout of PLAN §6.3). For the smoke test
only, a build with `EXAMPLE_BASEMAP_ORIGIN` rewrites `/basemap/*` to the
Tbilisi extract under `browser/public/basemap/`.

## In this repository, and in a Docker build

`package.json` pins the kit as a system's `web/` does, by the exact
release asset URL. The two installs differ only in where that URL goes:

- **In this repository** the root `pnpm-workspace.yaml` lists the example
  and overrides `@rootxkit/uspace-ui` to `link:.`, so CI builds it
  against the kit's current source (the root `pnpm-lock.yaml` records
  `link:../..`). Run `pnpm build` at the root first: the example reads
  the kit's `dist/`.
- **In a Docker build** the context is this directory alone, and
  `docker/pnpm-lock.yaml` records the asset's integrity, so `pnpm
  install --frozen-lockfile` refuses changed bytes. The pin is the
  latest published release; it moves to `v0.1.0` after the owner tags
  it (replace the URL, regenerate the lockfile as below, commit both).

`scripts/example.test.ts` at the root asserts both states. To regenerate
`docker/pnpm-lock.yaml` after a change to `package.json`:

```sh
tmp=$(mktemp -d)
cp package.json "$tmp"/ && cp docker/pnpm-workspace.yaml "$tmp"/
(cd "$tmp" && pnpm install --lockfile-only)
cp "$tmp"/pnpm-lock.yaml docker/pnpm-lock.yaml
```

## Commands

Node 22 and pnpm through corepack, from the repository root:

```sh
pnpm install --frozen-lockfile && pnpm build          # the kit's dist/
cd examples/next-app
pnpm check:api      # the generated types are what openapi.yaml generates
pnpm lint           # the kit's ESLint config
EXAMPLE_BASEMAP_ORIGIN=http://127.0.0.1:4599 pnpm build
pnpm typecheck
pnpm smoke          # the standalone server in Chromium: CSP, map, language, sign-in, roles
docker build -t uspace-ui-example .                  # the image, from the release tarball
docker run --rm -p 3000:3000 -e EXAMPLE_SESSION_SECURE=false uspace-ui-example
```

Sign in as `TEST-operator` (roles `viewer` and `auditor`; the protected
page needs `auditor`) or `TEST-viewer` (`viewer` only), with the test
password in `fixtures/users.json`.

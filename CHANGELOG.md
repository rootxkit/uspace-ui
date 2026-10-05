# Changelog

All notable changes to `@rootxkit/uspace-ui`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning
follows docs/PLAN.md §12. One line per work package under Unreleased.
Releases are GitHub Release assets, not npm versions (docs/RELEASING.md).

## Unreleased

## 1.0.0

U-M4: the API is frozen (PLAN §12, D12). Prepared on `main`, not tagged:
the owner reads `docs/api/uspace-ui.api.md`, tags `v1.0.0`, and the
release is a GitHub Release asset as before (docs/RELEASING.md). Pin it
exactly:

```jsonc
"@rootxkit/uspace-ui": "https://github.com/rootxkit/uspace-ui/releases/download/v1.0.0/rootxkit-uspace-ui-1.0.0.tgz"
```

### Compatibility policy (PLAN §12)

- Within a major only additive changes: new exports, new optional props,
  new catalogue keys, new enumeration values rendered because `model`
  gained them.
- A major: removing or renaming an export or a prop; changing what a
  colour, shape or pattern means (operators are trained on the legend);
  changing a wording rule (R-05, C-12, B-11); changing a cookie name or
  the BFF route set; changing the console frame; dropping a `next`,
  `react` or `maplibre-gl` major. A palette change that keeps every
  meaning, and a new translation, are a minor.
- Two majors are maintained for six months, on `release/v<N>` branches
  (CLAUDE.md "Release branches").
- The contract is what `docs/api/uspace-ui.api.md` tags `@public`;
  `@beta` exports may change in a minor, with a line here. The semver
  gate (`scripts/semver-gate.mjs`, CI `semver-gate`) holds a pull
  request that removes or changes a public line to the label `breaking`
  and a new major heading, and one that changes a legend token or
  symbology mapping to the label `legend-change` and a line citing the
  lesson or spec row.

### Entry points that ship

`model`, `theme`, `ui`, `i18n`, `fonts`, `map`, `api` (with the
`uspace-ui-gen-api` bin), `auth/server`, `auth/client`, `symbology`,
`layers` (now with `DrawLayer`), `legend`, `live`, `status` (now with
`ThresholdsPanel`), `alerts`, `table`, `form` (now with
`OutlineFields`), `eslint`, `test` (now with the lab-derived fixtures),
and `styles/tokens.css`, `styles/map.css`, `fonts/fonts.css` with the
woff2 files.

### What a consumer on 0.1.0 does

Why this is a major and not a minor: the release tags, and the few
lines that changed rather than grew. A console that builds with 0.1.0
builds with 1.0.0 unless it does one of these:

- It uses an export now tagged `@beta` (366 declarations: counters,
  `...ForTests` helpers, layer ids and feature builders, the reference
  adapters, and the like): it still works, but a minor may change it.
  Every export the four consoles imported at their pins is `@public`
  (PLAN §3, "The 1.0.0 freeze").
- It switches exhaustively over `LayerCounter` or `LiveCounter`: add
  `draw_vertex_refused` and `status_extra_ignored`.
- It builds a `StatusExtras` or `StatusBody` itself (a test double, say):
  add `thresholds`, `evaluationPeriodS` and, on `StatusBody`, `ignored`.
- It relies on a page without `data-theme` painting light under a dark
  preference: `tokens.css` now paints it dark (A5, below).

### Added

- `layers`: `DrawLayer`, the drawing tool the USSP operator portal had
  to do without in 0.1.0 (uspace-ussp PLAN Q28 gap 1). A click adds a
  polygon vertex or places a circle's centre, a drag moves a point, each
  point as MapLibre reports it. A circle's outline needs geodesy, which
  lives once in Go (PLAN §1.1; uspace-core `geodesy`), so the layer draws
  the app's `circleOutline` as its API drew it and otherwise only the
  centre. `maxVertices` is required; a click past it is refused and
  counted (`draw_vertex_refused`). `model` gains `DrawPoint` and
  `DrawOutline` (additive).
- `form`: `OutlineFields`, the typed and keyboard path to the same
  outline (WCAG 2.5.7): vertices added, edited and removed, a circle's
  centre and radius said in words, WGS84 ranges and a radius above zero
  as the only checks; the API judges the outline. `emptyOutline`.
- `live`, `status`: the thresholds in force (uspace-ussp PLAN Q28 gap 2).
  `StatusExtras` gains `thresholds` and `evaluationPeriodS`, read from a
  status frame's `thresholds{}` and `evaluation_period_s`; the lab
  schema does not name them yet (PLAN §14 Q21), so a malformed member is
  left out, counted (`status_extra_ignored`) and the frame still applies.
  `ThresholdsPanel` shows them with units and the policy version, and
  says when a frame carries none; nothing is defaulted (INV-03).
- `theme`: `schemeAttribute(scheme)`, the `data-theme` a server renders
  on `<html>` for an explicit scheme (docs/CONSUMING.md §3).
- `test`: `fixtures({ source: "lab" })`, `labFixtures()`,
  `labDecodings()`, `LAB_COMMIT`, and the reference adapters (`@beta`,
  examples of what a `web/` writes): the lab's schema examples at the
  commits in `src/test/fixtures/VERSION` (`docs/LAB_VERSION`), decoded
  the way a console would.
- `live`: `parseStatusSource` (`@beta`), the `source/status/v1` reader
  the status frame already used.

### Fixed

- `ThemeProvider` changes the scheme with CSS transitions off, so a
  control no longer fades from the old scheme's text colour (near-black
  on a dark field) after mounting in dark (WP-1; merged after 0.1.0).
- `LoginForm` returns the focus to the field to fill again after a
  refused sign-in (the cleared password, or the code); it fell to
  `<body>` because the submit button is disabled during the request
  (docs/ACCESSIBILITY.md A4, WCAG 2.4.3).
- No first-paint flash: `tokens.css` gives a page without `data-theme`
  the dark values under `prefers-color-scheme: dark`, and `dark:`
  utilities follow, so a dark preference no longer paints light and turns
  dark after hydration (A5). An explicit scheme from the cookie is
  rendered on the server with `schemeAttribute`.
- `auth/server`: the BFF proxy forwards the client's `Idempotency-Key`,
  which the ANSP's `POST /v1/restrictions` requires (uspace-ansp PLAN row
  49, item 1); a request without one still sends none.

### Contract changes

Each is additive or a bug fix; none changes a wire format, a cookie, a
route or a meaning.

- Console frame (`console/status/v1`): the kit now reads the optional
  `thresholds{}` and `evaluation_period_s` the USSP's traffic stream
  sends; a frame without them reads as before. Additive; the lab schema
  should name them (PLAN §14 Q21).
- BFF forwarding: `Idempotency-Key` joins the forwarded request headers
  (`FORWARDED_REQUEST_HEADERS`). A bug fix: an idempotent API refused
  every console request without it.
- `tokens.css`: the dark values under `prefers-color-scheme` before
  `data-theme` is set. A bug fix (A5); no value changed, no meaning.
- API report: every declaration tagged `@public` or `@beta`. The gate's
  label `breaking` is on this change for that reason.

### The v1 gate (WP-14)

- CI `semver-gate` (its own workflow, every pull request and label
  change), `fixtures` (the lab fixtures offline and online, required
  online on `main`), and the hardened `enums` job: `scripts/check-enums.sh`
  reads uspace-core with a Go tokenizer (`scripts/go-consts.mjs`), covers
  `alerting.ClearReason` and `sources.Why` beside `core`, prints a
  table, and fails on any difference (one listed skip:
  `acknowledged_timeout`, which core does not raise).
- api-extractor fails on an untagged export and on a public signature
  that reaches a beta type.

### Not yet

- The owner reads `docs/api/uspace-ui.api.md`, makes `semver-gate` and
  `fixtures` required checks on `main`, and tags `v1.0.0`.
- Lab coverage (`src/test/fixtures.lab.test.ts`, visible skips): 42
  enumeration values appear in no lab example; three examples leave out
  a member their schema requires (the lab snapshot's violation and
  manned items, the envelope's manned frame); `violation/v1` has no
  examples (uspace-authority); the CISP's `cis/change/v1` examples carry
  the production hostname and are not vendored; the authority's
  `violation/v1` names clear reasons `reconfigured` and `authorised`
  that `model.ClearReason` lacks (PLAN §14 Q22).
- uspace-ansp row 49 items 2 (a QR code of the enrolment URI) and 5 (the
  snapshot's `restrictions` extras) stay open for the kit.
- No screen reader pass (docs/ACCESSIBILITY.md). The target, WCAG 2.2 AA,
  is pending GCAA.

## 0.1.0

The first stable release, U-M1. It is a GitHub Release asset of this
repository, not an npm version (PLAN D10; docs/RELEASING.md), marked the
latest release. Pin it exactly; the pnpm lockfile records its integrity:

```jsonc
"@rootxkit/uspace-ui": "https://github.com/rootxkit/uspace-ui/releases/download/v0.1.0/rootxkit-uspace-ui-0.1.0.tgz"
```

The asset carries a signed build provenance attestation; verify it
with `gh attestation verify` before pinning it (docs/RELEASING.md).

Before `v1.0.0` an export may still change in a minor, and its
CHANGELOG section says what moved and why (PLAN §12).

### Entry points that ship

`model`, `theme`, `ui`, `i18n`, `fonts`, `map`, `api` (with the
`uspace-ui-gen-api` bin), `auth/server`, `auth/client`, `symbology`
(zones, restrictions, tracks, identification, age, severity, manned,
intent), `layers` (`ZoneLayer`, `RestrictionLayer`, `ZoneCard`,
`TrackLayer`, `AlertLayer`, `MannedLayer`, `IntentLayer`,
`ReceiverLayer`, `IntentCard`, `HoverPortal`, `useLayer`), `legend`
(`ZoneLegend`, `TrackLegend`, `IdentificationLegend`, `AgeLegend`,
`SeverityLegend`), `live`, `status` (with `TrackDetail`), `alerts`,
`table`, `form`, `eslint`, `test`, and `styles/tokens.css`,
`styles/map.css`, `fonts/fonts.css` with the woff2 files.

PLAN §12 put `live`, `status`, `table`, `form` and the track legends in
`0.2.0` and `alerts` and the traffic layers in `0.3.0`. They were on
`main` before this tag and ship in it; a console's minimum version of
PLAN §11 is unchanged, since what it needs is here.

### Not yet

- The API is not frozen: no semver gate in CI and no lab schema
  fixtures (WP-14, `v1.0.0`).
- Accessibility (docs/ACCESSIBILITY.md): the registry check page is a
  system's page and was not audited here, no screen reader pass was
  run, and two findings are open: `LoginForm` drops focus to `<body>`
  after a refusal (A4) and the scheme is applied after hydration (A5).
  The target, WCAG 2.2 AA, is pending GCAA.

### Changes since 0.1.0-rc.1

A consumer on `0.1.0-rc.1` must act on the first two of these.

- Removed: the `alerts` stub export `ENTRY` (the only line the API
  report removes since rc.1; everything else is added).
- `bffHandlers` with `session.secure` now refuses to build unless it
  gets `trustedProxyHops` or `noTrustedProxy: true` (retro-audit S6). A
  consumer that set neither must add one.
- `alerts` (WP-11): `AlertList`, `AlertSummary` / `alertSummary` (one
  line per alert and violation kind, `ka` and `en`), `AlertToaster` with
  the gesture-gated repeating tone (`useAlertTone(active, repeatMs)`;
  the period is required, no default) and `SeverityMark`; `layers` gains
  `AlertLayer` and the counters `alert_peer_missing`,
  `alert_aircraft_missing`.
- `layers` (WP-12): `MannedLayer` (plane symbols by trust class, hollow
  for broadcast, faded by age and never removed by the client, hover
  card with both altitudes by datum), `IntentLayer` (footprints passed
  through, styled by DSS state, `peer` pattern, emphasis by the app's
  `activeIds`; replaces PLAN's `nowIso`), `ReceiverLayer` (source-state
  colour, mark and words, B-11), `IntentCard`, `HoverPortal`;
  `symbology` gains `manned` and `intent` (`DSS_STATES` from uspace-core
  v1.3.0, `MannedTrack`); `status` gains `TrackDetail` and
  `sourceDetailLines`. `docs/CORE_VERSION` moves to v1.3.0.
- Retro-audit fixes: `auth/server` keeps its timeout over the API's
  answer body (an upstream body silent for `timeoutMs` is aborted and
  counted as `upstream_timeout`) and `api`'s client keeps its deadline
  until the body is read (S4); the BFF drops an absolute `Location`,
  `Server`, `Via`, `X-Powered-By` and every `Access-Control-*` header
  (S5); the proxy refuses an encoded slash or dot segment (N7); a
  sign-in answer whose session has already expired is
  `502 upstream_invalid` (N10); `resolveFeedUrl` refuses every URL as
  `no_page` when the page URL is unknown (N8). CI pins every action to a
  commit SHA (B1) and releases only a tag on `main` (N6).
- Release provenance: `release.yml` attests the tarball keylessly
  (`actions/attest-build-provenance`, Sigstore through the run's OIDC
  token) before it creates the GitHub Release, and its read-back
  verifies the attestation on the asset downloaded from its public URL.
  `SHA256SUMS` alone was unsigned, written by the same job. `v0.1.0` is
  the first release that carries an attestation.
- The release read-back also checks the latest mark: a plain version
  must be the repository's latest release, a pre-release never. It
  reads the tag's own release up to 10 times 6 s apart, so a slow
  release index does not fail a correct release and a missing mark
  fails after the bound (`release.mjs check-latest`). Every
  `release.yml` step runs with `bash -eo pipefail`, as CI's do.
- `version` is `0.1.0`.
- WP-13: `examples/next-app/`, the minimal Next.js consumer (in the
  repository, not in the tarball): the tokens and `@source`, the fonts,
  the theme with the brand from `UI_BRAND_*`, the language from the
  cookie and `Accept-Language`, the kit's ESLint config, the three BFF
  routes, types generated with `uspace-ui-gen-api`, the public zone map
  with "version V, updated T", `LoginForm`, `RequireRole`, the CSP of
  PLAN §7 per request with its nonce, `output: "standalone"` and a
  `Dockerfile` that installs the release tarball with
  `--frozen-lockfile`, over a stub API that is not a template. CI's
  `example` job builds it against the current source and smokes the
  standalone server in Chromium (CSP on every page and no violation,
  nothing off the origin, the map, Georgian, sign-in, roles).
- WP-13: `docs/CONSUMING.md`, the step list for a `web/`: install from
  the GitHub Release tarball with pnpm and verify its attestation, CSS,
  layout, lint, the BFF routes and cookies, the same-origin WebSocket,
  generated types, adapters, the basemap, the CSP, the Docker recipe,
  upgrading, the minimum versions, and where the example differs from
  the CISP's `web/`.
- WP-13: the accessibility audit of the example's public map, sign-in
  and role-gated pages (docs/ACCESSIBILITY.md; PLAN §14 Q11), by hand
  and with `axe` at WCAG 2.2 AA in English light and Georgian dark.
  `map` gains the catalogue key `map.canvas`: `MapView` names
  MapLibre's focusable canvas in the page's language, apart from the
  map region around it, where it was "Map" in English (A2). The
  example gets page titles (A1) and a skip link that moves focus (A3);
  its smoke test checks all of it.

## 0.1.0-rc.1

The first pre-release. It is a GitHub Release asset of this repository,
not an npm version (PLAN D10 was superseded on 2026-10-02; see
docs/RELEASING.md). Pin it exactly; the pnpm lockfile records its
integrity:

```jsonc
"@rootxkit/uspace-ui": "https://github.com/rootxkit/uspace-ui/releases/download/v0.1.0-rc.1/rootxkit-uspace-ui-0.1.0-rc.1.tgz"
```

An rc may still change an export; the next rc's section says what moved.

### Entry points that ship

`model`, `theme`, `ui`, `i18n`, `fonts`, `map`, `api` (with the
`uspace-ui-gen-api` bin), `auth/server`, `auth/client`, `symbology`
(zones, restrictions, tracks, identification, age, severity), `layers`
(`ZoneLayer`, `RestrictionLayer`, `ZoneCard`, `TrackLayer`, `useLayer`),
`legend` (`ZoneLegend`, `TrackLegend`, `IdentificationLegend`,
`AgeLegend`, `SeverityLegend`), `live`, `status`, `table`, `form`,
`eslint`, `test`, and `styles/tokens.css`, `styles/map.css`,
`fonts/fonts.css` with the woff2 files.

### Not yet

- `alerts` is a stub that exports only `ENTRY` (WP-11).
- `layers` has no `AlertLayer`, `MannedLayer`, `IntentLayer` or
  `ReceiverLayer` yet (WP-11, WP-12).
- There is no example app or `docs/CONSUMING.md` yet (WP-13).

### Changes

- WP-13a: the release path. `release.yml` checks that the tag equals
  `version` and that this section exists, runs every CI job on the tag,
  and attaches the tarball CI's `pack` job built and tested, with
  `SHA256SUMS`, to a GitHub Release (a pre-release for an rc). CI's
  `pack` job checks that the tarball holds exactly `files`, runs publint
  and attw on it, and installs it by URL into a scratch consumer: the
  lockfile pins its integrity, every subpath resolves, the entry points
  type-check, the bin runs, and changed bytes are refused. `files` adds
  `README.md` and `CHANGELOG.md`; `version` is `0.1.0-rc.1`.
- WP-0: scaffold (pnpm, TypeScript strict `tsc` build to `dist/`, the
  `exports` map with stub entry points), the frozen view models and
  enumerations of `model` mirrored from `uspace-core` `v1.0.0`, the
  `eslint` flat config with the no-geometry, no-server-client,
  no-route-logic and no-hand-written-type rules, the `test` helpers
  (`renderWithKit`, `fixtures`, `axeCheck`), the enumeration check against
  `uspace-core` and CI. Toolchain pinned on 2026-10-02 (PLAN §14 Q12):
  Node 22, pnpm 11.9.0, TypeScript 5.9.3, React 19.3.0 (peer `^19`),
  ESLint 9.39.5 with typescript-eslint 8.71.0, eslint-plugin-react-hooks
  7.1.1 and eslint-plugin-jsx-a11y 6.10.2, Vitest 4.1.11, Playwright
  1.63.0, Storybook 9.1.20, Vite 7.3.6, api-extractor 7.59.3, publint
  0.3.25, attw 0.18.5. Newer majors exist and were not taken: TypeScript 7
  (typescript-eslint supports `<6.1`, api-extractor bundles 5.9),
  ESLint 10 (eslint-plugin-jsx-a11y supports `^9`), Storybook 10 (the
  plan names Storybook 9), and with it Vitest 5 and Vite 8. Next.js is
  16.3 at this date; the peer stays `>=15`.
- WP-1: `theme` (`styles/tokens.css` with the light and dark tokens, the
  shadcn semantic set, the severity, trust, identification, zone and age
  palettes and the Tailwind `@theme inline` mapping; `ThemeProvider`,
  `useTheme`, `brandFromEnv`, `tokens`, the `uspace_scheme` cookie reader)
  and `ui` (the shadcn/ui set of PLAN §3.3 vendored with shadcn 4.21.1,
  `new-york-v4`, plus `Kbd`, `Stat`, `EmptyState`, `InlineCode`). The
  palettes are checked for WCAG 2.2 AA contrast and CIEDE2000 separation
  under simulated deuteranopia and protanopia. `LayerPanel` now uses the
  `Sheet` and `map.css` the tokens without fallbacks. radix-ui 1.6.7,
  class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0,
  lucide-react 1.49.0, sonner 2.0.8, cmdk 1.1.1; tailwindcss 4.3.3 (peer
  `^4`, optional).
- WP-3: `map`: `MapView` (one MapLibre map, the `pmtiles` protocol once
  per page, `SOURCE.json` with a timeout, style re-apply on language or
  scheme with every kit layer re-added through `useStyleLoad`, visible and
  counted no-basemap and no-WebGL notices), `basemapStyle` (Protomaps
  layers, `name:ka` labels in `ka`, the OSM date in the attribution),
  `useViewport`, `useBBoxSubscription`, `MapControls` and `LayerPanel`,
  `mapCounters`, `styles/map.css`, the MapLibre mock for jsdom and a 3.3 MB
  Tbilisi extract for the stories. maplibre-gl 5.24.0 (peer `^5`; 6.x
  exists and was not taken, the plan names 5), pmtiles 4.5.0,
  @protomaps/basemaps 5.7.2.
- WP-2: `i18n` (`ka` and `en` catalogues with the common, map and `ui`
  keys and the R-05, C-12, B-11, G-10 and datum wording pinned by tests;
  `I18nProvider`, `useT` with `{name}` and `_one`/`_other`, `useLang`,
  `useTFor`, `negotiateLang` over `uspace_lang` and `Accept-Language`,
  `missingKeys()`; formatters that name every datum and unit, say UTC and
  keep a registration secret part off the screen) and `fonts` (Noto Sans
  2.015 and Noto Sans Georgian 2.005 woff2 subsets, OFL, 97 796 bytes,
  next/font loaders with `unicode-range`, `fonts/fonts.css`,
  `mapFontstack`). The map's interim `messages.ts` (`mapText`,
  `MAP_MESSAGES`, `MapKey`, `MapLang`) is gone: its strings are in the
  catalogues and `MapView` takes `Lang`. fontkit 2.0.4 and next 16.3.8
  as dev pins.
- WP-6: zones. `symbology` (`zoneToken`, `zonePattern`, `zoneOpacity`,
  `zoneStyle` and the restriction line per state; PROHIBITED solid,
  REQ_AUTHORIZATION hatched, CONDITIONAL dotted, NO_RESTRICTION and
  USPACE outline only, told apart by weight; dimmed only on the server's
  `applies: false` or a planned, ended or cancelled restriction, never on
  `applies: null`; LESSONS Z-10, T-09, spec 02 F2, F3), `layers`
  (`useLayer` with one `setData` per animation frame and re-add on
  `style.load`, `ZoneLayer`, `RestrictionLayer`, `ZoneCard` with limits,
  applicability as served, version and update time, `layerCounters`) and
  `legend` (`ZoneLegend`). The jsdom MapLibre mock gains images,
  `getLayoutProperty` and the `remove` event.
  @maplibre/maplibre-gl-style-spec 24.10.0 as a dev pin.
- WP-5: `auth/server` (`import "server-only"`; `setSession`,
  `clearSession`, `readSessionToken`, `issueCsrf`, `checkCsrf`,
  `forward`, `bffHandlers` with exactly `login`, `logout` and `proxy`,
  `sessionClaimsUnverified`, `sessionDisplay`, `issueCspNonce`,
  `authCounters`) and `auth/client` (`SessionProvider`, `useSession`,
  `LoginForm`, `RequireRole`, `csrfToken`). Sign-in follows the API's two
  steps (password, then MFA code) inside one BFF request; the challenge
  and the session token never reach the page. `ui` gains
  `CspNonceProvider`, which ScrollArea reads for its injected style.
  server-only 0.0.1.
- WP-4: `api`: `createClient<Paths>` over openapi-fetch (same-origin
  credentials, `X-CSRF-Token` on POST, PUT, PATCH and DELETE,
  `Accept-Language` from `lang()`, a per-request timeout, no retry of any
  kind), `ApiError` for every non-2xx with the RFC 9457 `problem`, its
  `slug` off `https://schemas.uspace.ge/problems/<slug>`, `retryAfterS`
  (delay-seconds or HTTP-date), `requestId` and `sunset`; `onUnauthorized`
  once per run of 401s; a `Sunset` header warns once per value and is
  counted (`apiCounters`, `sunsetNotices`); `parseProblem`,
  `fieldErrorsOf`, `freshnessOf` with the CISP pick by default (M15).
  The `uspace-ui-gen-api` bin wraps openapi-typescript and writes the
  `@generated by uspace-ui-gen-api` header; `--check` fails on a stale
  output. openapi-fetch 0.17.0; openapi-typescript 7.13.0 as a runtime
  dependency, since the bin runs in each `web/`.
- WP-8: `live` (`useFeed` and `FeedClient`: one same-origin WebSocket on
  the session cookie, a URL with a token, credentials or another origin
  refused; reconnect forever, 1 s doubling to 30 s with equal jitter;
  `connecting` until a valid `console/status/v1`, then `live`, `down` on
  close; 4401 calls `onUnauthorized` once per outage and the retries go
  on; status frames set `FeedStatus`, the clock offset, the extras and the
  source store; snapshots replace the stores given in `stores` (C-08);
  the rest goes to `onFrame`; every malformed, unhandled or refused frame
  counted in `liveCounters`; `send` for `console/subscribe/v1`, re-sent on
  every open), the bounded `createTrackStore`, `createMannedStore`,
  `createAlertStore` and `createSourceStore` with counted eviction,
  `useStore`, `useNowMs`, `ageS` on the received or captured clock, and
  the frame parsers; `status` (`FeedStatusBar`, `SourceStateBadge`,
  `SourcesPanel` with a reason-required switch dialog, `DegradedBanner`,
  `AgeChip`, `FrozenOverlay`). `layers` reads track age and capture-time
  order from `live` (`receivedAgeS` and `compareCapturedAt` stay as
  re-exports). No new dependency.
- WP-9: `table` (`DataTable` on TanStack Table: a native `role="grid"`
  table with a required caption, `aria-sort`, roving tabindex and the APG
  keys, sorting with Shift for multi-sort and unknowns last both ways,
  column filters, pagination, virtualisation above 200 rows, column
  visibility and keyboard-resizable columns, sticky header, dense mode,
  row and checkbox selection, and an empty, filtered-out, loading, error
  with Retry-After and freshness state; `useTableUrlState` with the PII
  deny-list kept out of the URL and malformed URL state counted; the
  `columns` helpers `num`, `utc`, `age`, `severity`, `trust`, `ident`,
  `enum`, `text`, `select`; `tableCounters`). No export button (01 A10).
  @tanstack/react-table 8.21.3 (9.x exists and was not taken: its column
  types and feature API changed, and the plan's signatures are v8's),
  @tanstack/react-virtual 3.14.13.
- WP-10: `form` (`Form` on react-hook-form with the zod resolver: API
  field errors from a returned `FieldError[]` or a thrown `ApiError` put
  on the field whose name matches the JSON path, the rest listed with
  their path, the truncation note, an error summary that counts, links
  and takes focus, submit disabled while busy and through a Retry-After
  countdown, and a success that clears every error; `Field` with the
  unit and datum in the label; `NumberField` (locale decimals, null when
  empty), `TextField`, `SelectField`, `CheckboxField`, `EnumField`,
  `UTCDateTimeField` (read as UTC by text, no drift across DST),
  `BBoxField` in `[lng, lat]` order, `ReasonField`; `ConfirmDialog` with
  a mandatory reason that never focuses a destructive confirm; `shapes`
  for RFC 3339 UTC, bbox order and the reason; `kitErrorMap` so zod
  issues read in `ka` and `en`). @hookform/resolvers 5.9.1;
  react-hook-form (peer `^7.55`, dev 7.89.0) and zod (peer `^4`, dev
  4.6.5) as optional peers.
- Storybook removed (the owner's decision, 2026-10-02; PLAN D9): every
  story and the golden set are plain Vitest browser-mode tests under
  `browser/` that render the components in the kit's providers, with
  axe after every test and the same golden DOM snapshots; the test
  basemap moved to `browser/public/basemap/`; the Storybook packages,
  config, scripts and the CI build are gone, and no Pages site is
  planned. No change to the package or its API.

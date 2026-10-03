# Changelog

All notable changes to `@rootxkit/uspace-ui`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning
follows docs/PLAN.md §12. One line per work package under Unreleased.
Releases are GitHub Release assets, not npm versions (docs/RELEASING.md).

## Unreleased

- `alerts` (WP-11): `AlertList`, `AlertSummary` / `alertSummary` (one
  line per alert and violation kind, `ka` and `en`), `AlertToaster` with
  the gesture-gated repeating tone (`useAlertTone(active, repeatMs)`; the
  period is required, no default) and `SeverityMark`; `layers` gains
  `AlertLayer` and the counters `alert_peer_missing`,
  `alert_aircraft_missing`. The `alerts` stub marker `ENTRY` is gone.

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

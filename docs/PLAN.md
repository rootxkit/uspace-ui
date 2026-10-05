# uspace-ui implementation plan

Status: plan for parallel implementation by independent agents. Branch
`plan/initial`. Inputs: the spec at `uspace-lab/docs/spec/` (especially
`00 §6`, `00 §6.2`, `00 §6.3` (the `rootxkit/uspace-ui` paragraph), `01`
(users and roles per system), `02 §1` (conventions: time, geometry,
failure rule), `02 §3` (the WS and public surfaces every console reads),
`04 §2` (envelope, trust and source classes), `04 §3.2` (identification),
`04 §3.3` (alerts and violations), `05 §1` and `§5` (console load and the
viewport throttle), `05 §6` (what a console shows when something is down),
`06 §3` (the BFF cookie), `06 §4` (public repository constraints), `07`
(U-M1 and the milestones the consoles belong to), `08` Q15), the knowledge
base at `uspace-lab/knowledge/` (`LESSONS.md`: the lessons that end in a
display or a wording rule are listed per package in §5), `uspace-core`
(`docs/PLAN.md` as the template; `core/` for the enumerations the UI must
mirror exactly) and the predecessor `rootxkit/utm/web-pilot` (reference for
hard-won display behaviour only: basemap, feed state, source wording,
identification badges, null formatting).

Reconciled on 2026-10-02 against the four system plans (the cross-plan
decisions document; its mismatch ids `M-nn` and question ids are cited
where a row was changed by it): one console frame, one session and
cookie contract, one error body, distribution with an early
`0.1.0-rc` (GitHub Release tarballs since the owner's change of
2026-10-02, which supersedes D10's npmjs-only rule), pnpm everywhere, the lab-built basemap served by the
deployment repo. Two owner-only questions of §14 stay open; the owner decided Q1
(distribution) on 2026-10-02, superseding D10 and M32.

Sections: 1 scope, role boundary and decisions; 2 package layout and
dependency graph; 3 public API per entry point; 4 third-party dependencies;
5 lessons and spec rules per package; 6 data, bus and the published
contract; 7 security; 8 performance budgets; 9 testing strategy; 10 CI;
11 consumption and deployment; 12 versioning and release; 13 milestones,
work packages and waves; 14 spec gaps and open questions.

---

## 1. Scope, role boundary and decisions

`uspace-ui` is an npm-format package, `@rootxkit/uspace-ui`, released as a
GitHub Release tarball (D10) and consumed at build
time by the `web/` Next.js app of every system (`uspace-cisp`,
`uspace-authority`, `uspace-ussp`, `uspace-ansp`, and the lab's results
dashboard). Spec `00 §6.3`: the shadcn/ui theme and design tokens, the
MapLibre map components (viewport, tile sources, bbox subscription hooks),
track and zone legends and symbology (trust class, identification status,
age, zone type, restriction state), `ka` / `en` i18n with a
Georgian-capable font and message catalogues, and the auth / session
helpers for the BFF (cookie exchange, CSRF, token forwarding). Semver,
pinned by each `web/`; additive within a major.

### 1.1 What this package is not

| It does not | Because |
|---|---|
| Run. No process, no port, no database, no NATS client, no Docker image, no migrations, no bus subjects. | It is a library (`00 §6.3`). The "data model", "events on the bus" and "deployment" sections of the template reduce to: none, none, and "published to a registry and built into images elsewhere" (§6, §11). |
| Judge anything. No identification resolution, no zone containment or applicability, no CPA, no conformance, no altitude conversion, no time placement, no distance. | Spec `00 §6` hard rule and `06` T12: safety logic exists once, in Go, in `uspace-core`. A TypeScript file here that imports a geometry or geodesy library fails lint (§7, §10), and the kit ships that lint rule to every consumer. The kit renders what the API says, including `applies`, `stale`, `age_s`, `within_band`, `vertical_known`, and never recomputes them. |
| Hold a threshold. No default for `stale_after_s`, `live_max_age_s`, a CPA window, a height limit or a zone severity. | INV-03. Every such number is a required prop or arrives in the feed's status frame (§6.3). A display-only constant (debounce, animation frame, trail length, legend order) is allowed and named as such. |
| Know a system. No hostname, no system id, no USSP, no role list beyond what the spec's `01` tables name as enumerations, no API path. | `00 §7` discovery not configuration; `06 §4` no production hostname in code. The kit takes a `baseUrl` and a generated `paths` type; the system's `web/` owns both. |
| Hand-write an API type. | `00 §6.2`: Go to TypeScript only. The kit's own types are *view models* (§3.1), the shape its components render; each `web/` maps its generated client types onto them in an adapter it owns (§3.14). |
| Contain a credential, a key, a token or branding. | `06 §4`. Branding (name, logo, contact, colours) is injected by configuration (§3.2). |
| Command an aircraft, or render a control that would. | INV-01 is permanent. There is no "send", "upload", "arm", "geofence this aircraft" affordance anywhere in the kit, and `CLAUDE.md` forbids adding one. Alerts and advice go to people (`01 §1` MUST NOT, `C-11`). |

### 1.2 Decisions

| # | Decision | Why |
|---|---|---|
| D1 | One package with explicit entry points (`@rootxkit/uspace-ui/map`, `/i18n`, ...), not one package per concern and not a barrel root export. | One version to pin per app; each entry point pulls only its own dependencies (a public zone map does not load TanStack Table; the BFF helpers never reach the browser). `exports` map in §2. |
| D2 | View-model types are frozen now in `model/` (§3.1) in the same way `uspace-core/core` froze the Go base types: enumerations mirror `uspace-core/core` string by string, and a test pins them to spec `04 §2`, `04 §3.2`, `04 §3.3` and `00 §5`. | Work packages start in parallel against real types. The enumerations are the one place the kit and core must agree (a status the kit cannot name is a status it cannot show). |
| D3 | Build with `tsc` only: ESM output, one JS file per source file, declaration files, `"use client"` directives preserved per file. No bundler. | Tree-shaking by the consumer's bundler (Next.js), no directive loss, no second module graph, no bundler to configure. `publint` and `@arethetypeswrong/cli` check the result in CI (§10). |
| D4 | Styling: Tailwind v4 with the kit's tokens as a CSS file the app imports (`@rootxkit/uspace-ui/styles/tokens.css`) and the kit's compiled components scanned by the app's Tailwind via `@source`. No prebuilt stylesheet of utilities. | shadcn/ui components are Tailwind classes; the app already runs Tailwind; one theme, one scan. Tokens are CSS custom properties, so branding and dark mode are configuration, not a rebuild. |
| D5 | shadcn/ui components are vendored into `src/ui/` with the shadcn CLI once, committed, and upgraded by a documented procedure (WP-1). They are exported from `/ui` so no app copies them again. | One visual language across five apps (`00 §6.3`); an app that re-runs the CLI gets a second, drifting copy. |
| D6 | The basemap is self-hosted: one PMTiles file served with HTTP range requests, Protomaps style layers, glyphs and sprites under one path the app configures. No third-party tile or font request from a console, ever. | Predecessor P1-12 and `06 §4`: state consoles must not leak viewport positions to a tile vendor, must work on an isolated network, and must show the extract's date. The bundle itself is built in the lab (§14 Q4). |
| D7 | Fonts ship in the package (Noto Sans and Noto Sans Georgian, OFL, woff2 subsets) and are loaded with `next/font/local` through `/fonts`; a CI test reads each file's `cmap` and fails if any Georgian block (Mkhedruli U+10D0–U+10FF, Mtavruli U+1C90–U+1CBF, Nuskhuri U+2D00–U+2D2F, Asomtavruli U+10A0–U+10CF) is missing a glyph. | "A font that has full Georgian glyphs" is checked, not assumed (E-02). No Google Fonts request from a console (D6). |
| D8 | The live feed client (`/live`) is a generic, reconnect-forever WebSocket store that understands the common envelope of `04 §2` and the console frame of §6.3, never a system's business messages. Message bodies are passed to app adapters typed by the app's generated types. | B-08 (reconnect forever, start degraded), C-08 (replay on connect is the server's duty; the client shows what it was given and its age), `05 §5` (`dropped_frames` visible), `05 §6` (freeze with age shown). |
| D9 | Visual testing is plain component tests in vitest browser mode (Playwright Chromium) under `browser/`: each test renders the component in the kit's providers in a chosen scheme and language, `axe` runs after every test, and a named golden set has DOM snapshots. No Storybook and no GitHub Pages site (the owner removed Storybook, and the Pages site planned for it, on 2026-10-02). No hosted visual-diff service. | CI-cheap: Actions is free on a public repo; a paid snapshot service is a recurring cost and a secret. Map pixels are not snapshotted (WebGL in CI is noise); the style expressions the symbology produces are tested instead (§9). |
| D10 | **Superseded on 2026-10-02 by the owner (this also supersedes reconciliation M32's "npmjs only").** Distributed as GitHub Release assets of this repository: on a tag `v<version>`, `release.yml` runs every CI job and attaches the `pnpm pack` tarball (`rootxkit-uspace-ui-<version>.tgz`), built and tested by CI's `pack` job, and a `SHA256SUMS` file, using the run's `GITHUB_TOKEN` (`contents: write` on that job only). A version with a pre-release suffix is a GitHub pre-release. Consumers depend on the exact asset URL; the pnpm lockfile pins its integrity. Still excluded: GitHub Packages, a `github:` tag dependency, a branch. The first release is a pre-release, `0.1.0-rc.1` (WP-13a), so the CISP's `web/` starts on an rc and bumps. npmjs with OIDC trusted publishing and provenance stays a documented, switched-off path (`publishConfig` kept; `docs/RELEASING.md` "Switching to npm later"). *Was:* npmjs only under `@rootxkit`, with trusted publishing and provenance, rc under the `next` dist-tag; no GitHub Packages, no `github:` dependency, no tarball. | *Why the change:* publishing to npm needs an npm account and the `@rootxkit` scope set up by the owner, and that is not available (§14 Q1). A release tarball keeps what D10 wanted: consumers install without a token (the repository is public), the asset is built output with no `prepare` step (M32's objection to a `github:` dependency was a build with all devDependencies inside every Docker image, which a tarball does not need), every version is tied to a tag and a workflow run, and the lockfile's integrity makes a changed asset fail `--frozen-lockfile`. What it gives up: npm provenance attestations and resolution by version number. |
| D11 | The kit ships its ESLint flat config (`/eslint`) with the rules the spec requires of every `web/`: no geometry or geodesy imports, no database or bus client imports, no business logic in route handlers, no hand-written API types in the generated directory. | `00 §6` ("a Next.js file importing geometry or geodesy libraries fails lint"), `07` KT-3 ("no-geometry-import and no-server-side-business-logic rules"). Writing the rule once here is how five apps get it the same. |
| D12 | The first release `v0.1.0` is U-M1 (with C-M1; pre-releases `0.1.0-rc.N` precede it, D10); `v1.0.0` follows the first two consoles in production use of the track and alert components (the authority's A-M2 picture and the USSP's S-M2 console), when §3's API is declared stable. | Spec `07`. A kit's API is proven by its second consumer, not its first. |

---

## 2. Package layout and dependency graph

```
@rootxkit/uspace-ui                        (package root; no root export, see D1)
├── src/
│   ├── model/        frozen view-model types and enumerations (WP-0)      deps: none
│   ├── theme/        tokens, ThemeProvider, branding, dark mode (WP-1)    deps: model
│   ├── ui/           vendored shadcn/ui primitives (WP-1)                  deps: theme
│   ├── i18n/         catalogues ka/en, provider, t(), formatters (WP-2)    deps: model
│   ├── fonts/        next/font/local loaders for the bundled fonts (WP-2)  deps: next (peer)
│   ├── map/          MapView, basemap, viewport and bbox hooks (WP-3)      deps: theme, i18n
│   ├── api/          typed fetch adapter, problem errors, freshness (WP-4) deps: model
│   ├── auth/         server: cookie, CSRF, forwarding; client: session (WP-5)  deps: next (peer)
│   ├── symbology/    pure maps from enumerations to colour, shape, order (WP-6, WP-7)  deps: model, theme
│   ├── layers/       ZoneLayer, TrackLayer, AlertLayer, MannedLayer, IntentLayer, RestrictionLayer (WP-6, WP-7, WP-11, WP-12)  deps: map, symbology, i18n
│   ├── legend/       ZoneLegend, TrackLegend, IdentificationLegend, TrustLegend (WP-6, WP-7)   deps: symbology, i18n, ui
│   ├── live/         reconnecting feed, track/alert/source stores (WP-8)   deps: model, api
│   ├── status/       source state, degraded banner, age chip, freeze overlay (WP-8)  deps: live, i18n, ui
│   ├── alerts/       alert list, toast, acknowledgement, tone (WP-11)      deps: live, i18n, ui, symbology
│   ├── table/        accessible data table kit (WP-9)                      deps: ui, i18n, status, symbology
│   ├── form/         form kit with field errors and units (WP-10)          deps: ui, i18n, api
│   ├── eslint/       the flat config every web/ extends (WP-0)             deps: eslint (peer)
│   └── test/         render helpers, fixtures from the lab's schema examples (WP-0, WP-14)
├── bin/              uspace-ui-gen-api (WP-4)
├── fonts/            woff2 files (WP-2)
├── styles/           tokens.css, map.css (WP-1, WP-3)
├── browser/          vitest browser-mode tests per package, golden snapshots, the test basemap (each WP)
├── examples/next-app/  a minimal consumer, built in CI (WP-13)
├── docs/             this plan, work packages, API report
└── scripts/          font glyph check, exports check, api report
```

Entry points (`package.json` `exports`; every key is a contract, §12):

```
"./model"  "./theme"  "./ui"  "./i18n"  "./fonts"  "./map"  "./api"
"./auth/server"  "./auth/client"  "./symbology"  "./layers"  "./legend"
"./live"  "./status"  "./alerts"  "./table"  "./form"  "./eslint"  "./test"
"./styles/tokens.css"  "./styles/map.css"  "./fonts/*.woff2"
```

Dependency DAG (edges point at what is imported). No cycles; `model` is
the single root; `test` is imported by tests only.

```
model <- theme <- ui, map, symbology
model <- i18n <- map, legend, status, alerts, table, form
model <- api <- live, form
map <- layers ;  symbology <- layers, legend, alerts, table
live <- status, alerts, layers   (layers reads ageS and compareCapturedAt from live, WP-8)
alerts <- layers   (AlertLayer reads alertPeer, the one reader of `detail.peer`, WP-11)
status <- layers   (MannedLayer's hover card is TrackDetail compact; ReceiverLayer words its card with sourceDetailLines, WP-12)
symbology <- status   (TrackDetail reads the identification, trust, age and manned keys, WP-12)
status <- table   (columns.age renders the AgeChip, WP-9; table imports the api Freshness type only)
ui <- legend, status, alerts, table, form
fonts, auth/server, auth/client: next (peer) only; nothing imports them
eslint: nothing imports it
```

Rules: `model` imports nothing. `symbology` is pure (no React, no
MapLibre): functions from enumerations to style values, so it is tested
without a browser. `layers` never computes a position, a distance, a
containment or an applicability; it reads the fields of a view model and
emits MapLibre expressions. `auth/server` is marked `server-only` and
`auth/client` never imports it. No entry point imports `next` except
`fonts` and `auth/*`, so vitest runs without Next.js.

---

## 3. Public API per entry point

Signatures below are the contract between work packages and with the
five consumers. A work package may add exports and optional props; it may
not rename, remove or change the meaning of what is listed without a plan
change (§12). `null` means "unknown / not provided by the API", never a
zero; a component shows a dash for it (predecessor `format.ts`: an absent
number must never read as zero or as a perfect value).

### 3.1 `model` (frozen, WP-0)

Enumerations mirror `uspace-core/core` string values exactly (`00 §6.3`
table; `04 §2`; `04 §3.2`; `04 §3.3`). `model/enums.test.ts` pins every
list to the spec text; WP-14 adds the test against the lab's schema
examples (`04 §4` "every repo's CI runs the schema examples").

```ts
export type VerticalRef = "AGL" | "AMSL" | "WGS84";
export type AltSource = "geodetic" | "pressure" | "network" | "none";
export type Trust = "authenticated" | "provider" | "surveillance" | "broadcast" | "sensor" | "simulated";
export type Severity = "info" | "warning" | "critical";
export type ZoneType = "PROHIBITED" | "REQ_AUTHORIZATION" | "CONDITIONAL" | "NO_RESTRICTION" | "USPACE";   // ED-318 spelling (00 §5)
export type IdentStatus = "registered" | "suspended" | "unknown_operator" | "unidentified";
export type IdentReason = "matched" | "session_binding" | "uas_suspended" | "uas_revoked" | "operator_suspended" | "operator_revoked" | "serial_unknown" | "not_a_serial" | "operator_absent" | "operator_mismatch" | "owner_unknown" | "not_in_registry" | "serial_conflict" | "no_serial" | "registry_unavailable";
export type IdentBasis = "authenticated" | "as_broadcast" | "provider";   // `provider` = a Display Provider peer's claim, neither authenticated nor broadcast (core v1.1.0 `BasisProvider`, reconciliation Q-A8); rendered with its own caveat, never as `authenticated`
export type TimeSource = "source_clock" | "broadcast" | "receiver" | "provider" | "system";
export type AlertKind = "proximity" | "nonconformance" | "nonconformance_nearby" | "height_exceedance" | "zone_incursion" | "lost_link" | "restriction_activated" | "emergency_nearby";
export type ViolationKind = "height_120m" | "zone_incursion" | "unregistered" | "no_authorisation" | "identification_mismatch" | "rid_absent";
export type AlertState = "raised" | "updated" | "cleared";
export type ClearReason = "resolved" | "stale" | "source_disabled" | "flight_ended" | "acknowledged_timeout" | "landed";   // 04 §3.3 plus `landed` (LESSONS C-14, decided in uspace-core)
export type RestrictionState = "planned" | "active" | "ended" | "cancelled";
export type SourceState = "disabled" | "healthy" | "stale" | "lagging" | "unreachable" | "never_heard";   // B-03, B-04, B-11 wording; disabled wins
export type DisabledBy = "type" | "instance" | "default_deny";

export interface Times { ts: string | null; rxTs: string; capturedAt: string; timeSource: TimeSource; backlog: boolean }   // 04 §2
export interface Identification { status: IdentStatus; reason: IdentReason; serial: string | null; operatorReg: string | null; registeredOperatorReg: string | null; mismatch: boolean; basis: IdentBasis }

export interface TrackView {
  trackId: string; trust: Trust; source: string; sourceInstance: string;
  lat: number; lng: number;                           // WGS84 degrees; the only numbers the map needs
  altAmslM: number | null; altWgs84M: number | null; altSource: AltSource;
  heightM: number | null; heightRef: "TakeoffLocation" | "GroundLevel" | null;
  speedMs: number | null; trackDeg: number | null; vspeedMs: number | null;
  status: string | null; emergency: boolean;          // F3411 operational status as the API spells it
  identification: Identification | null;
  flightId: string | null; intentId: string | null;
  times: Times;
  receivedAtMs: number;                               // browser clock; set by the live store, never by the API
}
export interface MannedView { trackId: string; icao24: string | null; callsign: string | null; lat: number; lng: number; altPressureM: number | null; altWgs84M: number | null; gsMs: number | null; trackDeg: number | null; vrateMs: number | null; sourceClass: string; emergency: boolean; times: Times; receivedAtMs: number }
export interface ZoneView {                           // one ED-318 feature as the API serves it, untouched geometry
  identifier: string; name: string | null; type: ZoneType; variant: string | null; reason: string[]; message: string | null;
  lowerLimitM: number | null; lowerRef: VerticalRef | null; upperLimitM: number | null; upperRef: VerticalRef | null;   // metres as the API converted them, with their reference; shown with the reference, never compared here
  geometry: GeoJSON.Geometry; applies: boolean | null; restrictionState: RestrictionState | null; version: string | null; updatedAt: string | null;
}
export interface AlertView { alertId: string; kind: AlertKind | ViolationKind; severity: Severity; state: AlertState; clearReason: ClearReason | null; aircraft: string[]; peerTrackId: string | null; detail: Record<string, unknown>; capturedAt: string; raisedAt: string; policyVersion: string; acknowledged: boolean; receivedAtMs: number }
export interface IntentView { intentId: string; authorisationNumber: string | null; dssState: string | null; localState: string | null; volumes: GeoJSON.Polygon[]; timeStart: string; timeEnd: string; priority: number | null }
export interface SourceView { sourceType: string; instanceId: string | null; state: SourceState; disabledBy: DisabledBy | null; disabledByWho: string | null; lastSeenAt: string | null; lagS: number | null; accepted: number; refused: number }
export interface FeedStatus { connection: "connecting" | "live" | "down"; sinceMs: number; droppedFrames: number; degraded: string[]; policyVersion: string | null; staleAfterS: number | null; liveMaxAgeS: number | null; serverTs: string | null }
export interface FieldError { field: string; reason: string }      // uspace-core core.FieldError (its CLAUDE.md rule 5: an error names the field and the reason)
export interface Problem { type: string; title: string; status: number; detail: string | null; instance: string | null; errors: FieldError[]; truncated?: boolean }   // §14 Q2 (decided, M28): `type` = https://schemas.uspace.ge/problems/<slug>; `errors` capped at 100 by the server, `truncated: true` when it was cut; the form kit says "and more" on it
export interface SessionDisplay { sub: string; roles: string[]; realm: string; exp: number }   // the session JWT claims the BFF decodes for display (M20): `roles` is always an array (one element where a system has single-role users); `realm` is `console` (default), `police` (authority) or `portal` (USSP operators)

// 1.0.0 (additive): an outline a person is drawing or typing (layers/DrawLayer, form/OutlineFields), passed to the app as entered. The kit never closes, simplifies, buffers or measures it, and never turns a circle into a polygon: the API judges the outline and, where a circle must be drawn, draws its outline in Go (uspace-core geodesy) and returns it.
export interface DrawPoint { lat: number; lng: number }   // WGS84 degrees, as clicked (MapLibre's lngLat) or typed
export type DrawOutline =
  | { kind: "polygon"; vertices: readonly DrawPoint[] }   // in the order given; the first is not repeated
  | { kind: "circle"; center: DrawPoint | null; radiusM: number | null };   // radius in metres as typed; null: not yet given
```

### 3.2 `theme` (WP-1)

```ts
export interface Brand { name: string; shortName: string; logoUrl: string | null; contact: string | null; accent: string | null }   // from configuration (06 §4); never a default naming an organisation
export function brandFromEnv(env: Record<string, string | undefined>, prefix?: string): Brand   // UI_BRAND_NAME, UI_BRAND_SHORT_NAME, UI_BRAND_LOGO_URL, UI_BRAND_CONTACT, UI_BRAND_ACCENT; missing name -> "U-space" (the role, not an organisation)
export type ColorScheme = "light" | "dark" | "system";
export function ThemeProvider(props: { brand: Brand; scheme?: ColorScheme; children }): JSX.Element   // sets data-theme and the brand CSS variables
export function useTheme(): { scheme: ColorScheme; resolved: "light" | "dark"; setScheme(s: ColorScheme): void; brand: Brand }
export function schemeAttribute(scheme: ColorScheme | null | undefined): "light" | "dark" | undefined   // 1.0.0: the data-theme the server renders on <html> for an explicit scheme (the uspace_scheme cookie); undefined for system, so tokens.css follows prefers-color-scheme until ThemeProvider sets it (no first-paint flash, docs/ACCESSIBILITY.md A5)
export const tokens: { severity: Record<Severity, string>; trust: Record<Trust, string>; ident: Record<IdentStatus, string>; zone: Record<ZoneType, string>; age: readonly string[] }   // CSS variable names, not colours; colours live in styles/tokens.css
```

`styles/tokens.css` defines `--us-*` variables for light and dark
(`[data-theme="dark"]`), the Tailwind `@theme` mapping, and the semantic
palette: one colour per severity, trust class, identification status and
zone type, chosen so that each set is distinguishable with deuteranopia
and protanopia simulated and meets WCAG 2.2 AA contrast on both schemes
(checked by a test, §9). Shape and pattern carry the meaning beside colour
(§3.8), so colour is never the only cue.

### 3.3 `ui` (WP-1)

The vendored shadcn/ui set: `Button`, `Badge`, `Card`, `Dialog`,
`AlertDialog`, `Sheet`, `Tabs`, `Tooltip`, `Popover`, `DropdownMenu`,
`Command`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Input`,
`Textarea`, `Label`, `Separator`, `ScrollArea`, `Table` (primitives),
`Skeleton`, `Sonner` (toasts), `Breadcrumb`, `Pagination`, `Collapsible`.
Exported unchanged in name and props from upstream, so the upstream
documentation applies; `cn()` re-exported. Additions over upstream are
separate components, never edits inside a vendored file.

### 3.4 `i18n` (WP-2)

```ts
export type Lang = "ka" | "en";
export const LANGS: readonly Lang[];
export type Catalogue = Record<string, string>;                      // keys are the kit's; apps add their own catalogues
export function I18nProvider(props: { lang: Lang; catalogues?: Partial<Record<Lang, Catalogue>>; children }): JSX.Element   // the kit's catalogue plus the app's, app wins on a duplicate key; a key missing in ka falls back to en, then to the key, counted
export function useT(): (key: string, vars?: Record<string, string | number>) => string   // {name} interpolation; plural by `_one` / `_other` suffix
export function useLang(): { lang: Lang; setLang(l: Lang): void }
export function negotiateLang(acceptLanguage: string | null, cookie: string | null): Lang   // cookie `uspace_lang` wins; else Accept-Language; else "ka"
// Formatters (display only; never convert a unit or a datum)
export function fmtNum(v: number | null | undefined, digits?: number, unit?: string): string   // "—" for null/NaN/Infinity
export function fmtAltitude(v: number | null, ref: VerticalRef | AltSource | null, lang: Lang): string   // "550 m AMSL", "120 m AGL", "pressure altitude" marked as such (R-09); never bare metres
export function fmtAge(ageS: number | null, lang: Lang): string          // "3 s", "2 min", "—"
export function fmtTimeUTC(iso: string | null, lang: Lang, opts?: { seconds?: boolean }): string   // always UTC, always says "UTC" (02 §1; predecessor S-16)
export function fmtTimeLocal(iso: string | null, lang: Lang, tz: string): string                  // display layer only; the tz is the app's
export function fmtSpeed(ms: number | null, lang: Lang): string; export function fmtHeading(deg: number | null): string   // "045°"
export function fmtRegistrationNumber(publicPart: string | null): string   // never a secret part; the API never sends one (06 §5)
```

Catalogue rules: every user-facing string in the kit has a `ka` and an
`en` entry; the test fails on a key present in one and not the other, and
on an `en` string that is a key. Wording rules the catalogue encodes:
R-05 ("broadcast and unverified" on every broadcast track and alert,
and "as broadcast and unverified" beside a `registered` status whose
basis is `as_broadcast`); C-12 (`unreachable` and `lagging` never say
"lost"; loss wording only for a recorded gap or a moved drop counter);
B-11 (`disabled by <who>` looks different from `silent since <t>`);
G-10 (no registry personal data in any track string).

### 3.5 `fonts` (WP-2)

```ts
export const notoSans: NextFont;            // next/font/local over fonts/NotoSans-*.woff2 (Latin, Cyrillic, Greek subsets)
export const notoSansGeorgian: NextFont;    // fonts/NotoSansGeorgian-*.woff2; Mkhedruli, Mtavruli, Nuskhuri, Asomtavruli
export const fontClassName: string;         // both, with `unicode-range` so Georgian text falls to the Georgian face
export const mapFontstack: string;          // the MapLibre fontstack name the basemap glyphs are built with (§14 Q4), used by every label layer
```

### 3.6 `map` (WP-3)

```ts
export interface BasemapConfig { baseUrl: string; pmtilesPath?: string; glyphsPath?: string; spritesPath?: string; sourceInfoPath?: string }   // defaults "/basemap/basemap.pmtiles", "/basemap/fonts/{fontstack}/{range}.pbf", "/basemap/sprites/v4/{flavor}", "/basemap/SOURCE.json"
export interface BasemapInfo { bounds: [[number, number], [number, number]]; osmDataAsOf: string | null }   // from SOURCE.json; an offline map has no other way to say it is stale
export function basemapStyle(cfg: BasemapConfig, info: BasemapInfo | null, lang: Lang, scheme: "light" | "dark"): StyleSpecification   // Protomaps layers; in `ka`, labels read name:ka then name (predecessor basemap.ts); attribution with the OSM date; with no info: a plain background and a visible "no base map" notice
export interface Viewport { center: [number, number]; zoom: number; bearing: number; pitch: number }
export interface BBox { minLng: number; minLat: number; maxLng: number; maxLat: number }
export function MapView(props: { basemap: BasemapConfig; initial: Viewport; lang: Lang; scheme: "light" | "dark"; onViewport?(v: Viewport, bbox: BBox): void; onLoad?(map: maplibregl.Map): void; attributionExtra?: string; children?: ReactNode; className?: string }): JSX.Element   // owns the Map instance; children are layer components reading it via context
export function useMap(): maplibregl.Map | null
export function useViewport(): { viewport: Viewport; bbox: BBox; fitBounds(b: BBox, opts?): void; flyTo(v: Partial<Viewport>): void }
export function useBBoxSubscription(opts: { marginFraction: number; debounceMs: number; quantizeDeg: number; onChange(bbox: BBox): void }): void   // calls onChange with the padded, quantised bbox when it changes by more than the quantum; the app subscribes its WS with it (05 §5 "consoles subscribe only to the cells intersecting their viewport plus a margin")
export function MapControls(props: { layers: LayerToggle[]; scheme?: boolean; locate?: false }): JSX.Element   // zoom, compass, layer toggles, scale; no geolocation control (a console is a desk)
export interface LayerToggle { id: string; labelKey: string; visible: boolean; onChange(v: boolean): void }
export function LayerPanel(...)   // the toggles as a sheet
```

`styles/map.css` carries the MapLibre stylesheet import and the kit's
control overrides. The WebGL-unavailable path renders a notice with the
viewport bbox as text, never a blank (E-02).

### 3.7 `api` (WP-4)

```ts
export interface ClientOptions { baseUrl: string; fetch?: typeof fetch; csrfToken?: () => string | null; onUnauthorized?(): void; lang?: () => Lang }
export function createClient<Paths extends {}>(opts: ClientOptions): Client<Paths>   // openapi-fetch under the hood; Paths is the app's generated `paths`; adds Accept-Language, X-CSRF-Token on unsafe methods, credentials: "same-origin"
export class ApiError extends Error { readonly status: number; readonly problem: Problem | null; readonly retryAfterS: number | null; readonly requestId: string | null }
export function parseProblem(res: Response): Promise<Problem | null>   // application/problem+json (§14 Q2); otherwise null
export interface Freshness { etag: string | null; version: string | null; updatedAt: string | null; ageS: number | null; stale: boolean }   // from ETag, cis_updated_at (or metadata.issued, the core ed318 name; M15 retired updateDateTime), cis_version, cis_age_s and `stale` markers (02 F3, F5 geo-awareness) as headers or body fields the app points at
export function freshnessOf(res: Response, body: unknown, pick?: FreshnessPick): Freshness
export function fieldErrorsOf(err: unknown): FieldError[]   // [] when not a Problem
```

The kit never retries a non-idempotent request (utm "What not to do").
A `503` with `Retry-After` is surfaced as `retryAfterS` (B-10) and the
status components render it as "refused, retry in N s", not as an error
of the console.

The error body is the same on every national API (reconciliation M28):
`{type, title, status, detail, instance, errors: [{field, reason}],
truncated?}`, `type` = `https://schemas.uspace.ge/problems/<slug>` with
`slug` the refusal name (`unauthenticated`, `forbidden`, `signature`,
`cis_stale`, ...), `field` = the JSON path as `core.FieldError` writes
it. `parseProblem` reads the slug off `type` so a status component can
label a refusal by key; an unknown slug is shown by its `title`. The
USSP's `conflicts[]` is on the decision body, never on the problem.

### 3.8 `symbology` (WP-6 zones, WP-7 tracks)

Pure functions from enumerations to visual values; no React, no map.
Every function is total over its enumeration (a `switch` with
`satisfies never`), so a new enum value in `model` fails the build here.

```ts
export type Shape = "triangle" | "diamond" | "square" | "circle" | "hexagon" | "cross";
export function trustShape(t: Trust): Shape                   // authenticated triangle, provider diamond, surveillance square, broadcast hexagon with a hollow fill, sensor cross, simulated circle dashed
export function trustToken(t: Trust): string                  // CSS variable name
export function identToken(s: IdentStatus | null): string; export function identOrder(): readonly (IdentStatus | "none")[]   // legend order: expected first, then those needing attention (predecessor identification.ts)
export function needsAttention(s: IdentStatus | null): boolean   // unknown_operator, unidentified (G-03 lists them; the kit only orders the legend by it)
export function ageBucket(ageS: number | null, staleAfterS: number): "live" | "aging" | "stale" | "unknown"   // live < staleAfterS/3, aging < staleAfterS, else stale; staleAfterS is the policy value from the feed, required
export function severityToken(s: Severity): string; export function severityOrder(): readonly Severity[]
export function zoneToken(t: ZoneType): string; export function zonePattern(t: ZoneType): "solid" | "hatched" | "dotted" | "none"   // PROHIBITED solid red, REQ_AUTHORIZATION hatched amber, CONDITIONAL dotted, NO_RESTRICTION outline only, USPACE blue outline
export function zoneOpacity(z: Pick<ZoneView, "applies" | "restrictionState">): number   // dimmed when applies === false or restrictionState in (planned, ended, cancelled); full when applies is null (unknown is not "off")
export function restrictionStateToken(s: RestrictionState): string
export function trackStyle(...): ExpressionSpecification;  export function zoneStyle(...): ExpressionSpecification   // the MapLibre expressions the layers use, tested as data
```

### 3.9 `layers` (WP-6, WP-7, WP-11, WP-12)

Each layer is a React component rendered inside `MapView`; it owns a
GeoJSON source and its MapLibre layers, applies updates at most once per
animation frame (§8), and removes itself on unmount.

```ts
export function ZoneLayer(props: { zones: ZoneView[]; selectedId?: string | null; onSelect?(id: string): void; labels?: boolean; visible?: boolean }): null
export function TrackLayer(props: { tracks: Iterable<TrackView>; staleAfterS: number; nowMs: number; selectedId?: string | null; onSelect?(id: string): void; labels?: boolean; trails?: { points: number } | false; visible?: boolean }): null   // symbol per trust shape, colour by identification, opacity by age bucket, rotation by trackDeg (null: no arrow), emergency ring; a broadcast track always carries the hollow fill (R-05)
export function MannedLayer(props: { tracks: Iterable<MannedTrack>; staleAfterS: number; nowMs: number; selectedId?: string | null; onSelect?(id: string): void; labels?: boolean; visible?: boolean }): null   // WP-12: a plane per aircraft, colour by trust (none sent: drawn as broadcast, §14 Q20), hollow for broadcast (R-05), faded by age, ringed when trackDeg is null, emergency ring; never removed by the client; a backlog sample and an age without a threshold are labelled, never drawn as fresh; hover card with both altitudes by datum (R-09)
export function AlertLayer(props: { alerts: Iterable<AlertView>; tracks: ReadonlyMap<string, TrackView>; visible?: boolean }): null   // proximity: a line between the two aircraft coloured by severity; zone_incursion / height: a ring on the aircraft; nothing for cleared
export function IntentLayer(props: { intents: IntentInput[]; activeIds?: Iterable<string>; selectedId?: string | null; onSelect?(id: string): void; labels?: boolean; visible?: boolean }): null   // footprints as the API derived them (volumes passed through, Polygon or MultiPolygon); fill and outline per DSS state, a diamond pattern for `peer`; WP-12 replaced `nowIso` with `activeIds` (the WP-12 brief): "current" is the app's list from the API's state, never a time comparison in the kit
export function RestrictionLayer(props: { restrictions: ZoneView[]; visible?: boolean }): null   // ED-318 features with reason DAR, styled by restrictionState (02 F2)
export function ReceiverLayer(props: { receivers: ReceiverInput[]; selectedId?: string | null; onSelect?(id: string): void; labels?: boolean; visible?: boolean }): null   // authority: receiver positions and state; ReceiverInput = { id, lat, lng, state } plus the optional SourceView fields its hover card words in B-11's terms (disabledBy, disabledByWho, lastSeenAt, lagS)
export function DrawLayer(props: { outline: DrawOutline; onChange(next: DrawOutline): void; maxVertices: number; circleOutline?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null; active?: boolean; visible?: boolean; id?: string }): null   // 1.0.0 (uspace-ussp Q28 gap 1): a click adds a polygon vertex or places a circle's centre, a drag moves a point, every point as MapLibre reports it; the edges closed by a copy of the first vertex; a circle's outline is the app's `circleOutline` as its API drew it (geodesy is Go's, §1.1), else the centre only; `maxVertices` required, a click past it refused and counted (`draw_vertex_refused`); a crosshair while clicks place points
```

### 3.10 `legend` (WP-6, WP-7)

```ts
export function ZoneLegend(props: { counts?: Partial<Record<ZoneType, number>> }): JSX.Element
export function TrackLegend(props: { counts?: Partial<Record<Trust, number>> }): JSX.Element
export function IdentificationLegend(props: { counts?: Record<IdentStatus | "none", number> }): JSX.Element   // with the hint text per status; the broadcast caveat (R-05)
export function SeverityLegend(): JSX.Element;  export function AgeLegend(props: { staleAfterS: number }): JSX.Element
```

### 3.11 `live` (WP-8)

```ts
export interface FeedOptions { url: string | (() => Promise<string>); protocols?: string[]; backoff?: { initialMs: number; maxMs: number; factor: number }; onFrame(frame: ConsoleFrame): void; onUnauthorized?(): void; now?: () => number }   // `url` stays generic (a string, or a function for an app that must compute it); a console passes its system's same-origin WS path and the browser sends the session cookie on the upgrade (M22); there is no ticket
export interface ConsoleFrame { schema: string; msgId: string; producer: string; ts: string | null; rxTs: string; capturedAt: string | null; timeSource: TimeSource; backlog: boolean; body: unknown }   // the common envelope of 04 §2 plus `body`; §6.3 names the frames; `uspace-lab/schemas/common/envelope/v1`
export function useFeed(opts: FeedOptions): FeedStatus   // reconnects forever (B-08); status frames update droppedFrames, degraded, policyVersion, staleAfterS; close code 4401 = the session is gone: `onUnauthorized` once (the app re-logins), connection `down`, retries continue so a renewed session resumes without a reload; never gives up, never throws
export function createTrackStore(opts: { trailPoints: number; maxTracks: number }): TrackStore   // bounded (E-10): oldest evicted and counted; receivedAtMs stamped on insert
export interface TrackStore { upsert(t: Omit<TrackView, "receivedAtMs">): void; remove(id: string, reason: ClearReason | "source_disabled"): void; get(id): TrackView | undefined; snapshot(): ReadonlyMap<string, TrackView>; subscribe(fn): () => void; counters(): Readonly<Record<string, number>> }
export function createAlertStore(): AlertStore    // raised/updated replace by alertId; cleared keeps the alert for `clearedHoldMs` with its clear numbers and reason (C-14), then drops it; acknowledged flag per console (not recorded; recording is the app's POST)
export function createSourceStore(): SourceStore  // per (type, instance) SourceView from status frames; `disabled` beats every other state (B-11)
export function useStore<T>(store: { subscribe; snapshot }): T   // useSyncExternalStore
export function ageS(t: { receivedAtMs: number } | { times: Times }, nowMs: number, by?: "received" | "captured"): number | null   // display age; captured age needs the server's clock offset from the status frame, else null
// 1.0.0: StatusExtras (LiveStatus.extras) gains `thresholds: Readonly<Record<string, number>> | null` (a status frame's thresholds{} by wire name, each ending in its unit, `_s` or `_m`; the USSP's cpa_tcpa_max_s, cpa_horizontal_min_m, cpa_vertical_min_m, cpa_neighbour_radius_m, cpa_clear_after_s, traffic_radius_m) and `evaluationPeriodS: number | null`, read leniently because console/status/v1 does not name them yet (§14 Q21): a malformed member is left out and counted (`status_extra_ignored`), the frame still applies; never defaulted
```

### 3.12 `status` (WP-8)

```ts
export function FeedStatusBar(props: { status: FeedStatus; nowMs: number }): JSX.Element   // "live", "connecting…", "feed down — retrying, last frame N s ago"; dropped_frames and degraded[] visible (05 §5, §6); never says "lost" (C-12)
export function SourceStateBadge(props: { source: SourceView; nowMs: number }): JSX.Element   // disabled by <who> | healthy | stale since | lagging, behind N s, nothing lost | unreachable, data buffered at the source | never heard
export function SourcesPanel(props: { sources: SourceView[]; nowMs: number; onSwitch?(s: SourceView, enabled: boolean, reason: string): void; canSwitch: boolean }): JSX.Element   // the switch is a confirm dialog with a mandatory reason; the kit only calls back
export function DegradedBanner(props: { degraded: string[]; cisAgeS?: number | null; cisStaleBoundS?: number | null }): JSX.Element   // "manned traffic unavailable since", "DSS unavailable", "CIS data N s old" — from the API's words, labelled by key
export function AgeChip(props: { ageS: number | null; staleAfterS: number }): JSX.Element
export function FrozenOverlay(props: { status: FeedStatus; nowMs: number }): JSX.Element   // when the feed is down: the picture stays, dimmed, with "showing data as of" and the age (05 §6)
export function TrackDetail(props: { track: TrackView | MannedTrack; nowMs: number; staleAfterS: number | null; clockOffsetMs?: number | null; renderLink?(link: { kind: "flight" | "intent"; id: string }): ReactNode; compact?: boolean; lang?: Lang }): JSX.Element   // WP-12: identification block (status, hint, reason, basis caveat, mismatch, public registration part, serial), position, every altitude with its datum in the same string, speed, course, vertical speed positive up, emergency, trust with its meaning, source and instance ("heard by" for broadcast), the three times each labelled with its clock, time source, backlog badge, ages; every null a dash
export function ThresholdsPanel(props: { thresholds: Readonly<Record<string, number>> | null; evaluationPeriodS?: number | null; policyVersion: string | null; className?: string }): JSX.Element   // 1.0.0 (uspace-ussp Q28 gap 2): the thresholds in force as the status frame carries them, each with its unit and the policy version; "the system sends no thresholds; none is assumed" when it carries none; a name the kit has no words for shown as the system spells it; judges nothing (INV-03)
```

### 3.13 `alerts` (WP-11)

```ts
export function AlertList(props: { alerts: AlertView[]; tracks?: ReadonlyMap<string, TrackView>; nowMs: number; onAcknowledge?(a: AlertView): void; canAcknowledge: boolean; onSelect?(a: AlertView): void }): JSX.Element   // sorted critical first then raisedAt; a cleared alert shows its clear reason and numbers for the hold period
export function AlertSummary(props: { alert: AlertView; lang: Lang }): string    // the one-line text per kind from `detail`, with units and datums (E-13); never a loss claim (C-12); "as broadcast and unverified" when a party is broadcast
export function AlertToaster(props: { alerts: AlertView[]; critical?: { tone: boolean; repeatMs: number } }): JSX.Element   // a tone while an unacknowledged critical alert exists; the repeat period is a prop from policy (02 F5: every 10 s is the server's number)
export function useAlertTone(active: boolean, repeatMs: number, cue?: string): AlertTone   // Web Audio; starts only after a user gesture (browser rule; `enable()` from the toaster's visible control); no audio file. WP-11 changed it from `(enabled): void`: the repeat period is the server's (02 F5) and has no default, and the gesture, mute and "unavailable" states are returned so the toaster shows them (E-02)
```

### 3.14 `table` (WP-9)

```ts
export function DataTable<Row>(props: { columns: ColumnDef<Row>[]; rows: Row[]; state?: TableState; onStateChange?(s: TableState): void; getRowId(r: Row): string; selectedId?: string | null; onSelect?(r: Row): void; empty: ReactNode; loading?: boolean; error?: Problem | null; freshness?: Freshness; caption: string; dense?: boolean; virtualize?: boolean }): JSX.Element   // TanStack Table headless; `aria-sort`, roving tabindex, column resize; keyboard: arrows, Home/End, Enter selects; virtualised above 200 rows
export interface TableState { sorting: SortingState; columnFilters: ColumnFiltersState; pagination: { pageIndex: number; pageSize: number }; columnVisibility: Record<string, boolean> }
export function useTableUrlState(key: string): [TableState, (s: TableState) => void]   // in the URL search params so a view is shareable; never PII in the URL (safety rules)
export const columns: { age(nowMs): ColumnDef; severity(): ColumnDef; trust(): ColumnDef; ident(): ColumnDef; utc(key): ColumnDef; num(key, unit, digits): ColumnDef }   // typed helpers with the kit's cells
```

### 3.15 `form` (WP-10)

```ts
export function Form<Schema extends z.ZodTypeAny>(props: { schema: Schema; defaults: z.input<Schema>; onSubmit(values: z.output<Schema>): Promise<void | FieldError[]>; children; submitLabelKey: string; busyLabelKey?: string }): JSX.Element   // react-hook-form + zod; FieldError[] returned by the API are mapped onto fields by `field` path (JSON path as uspace-core writes it, e.g. features[3].geometry[0].upperLimit)
export function Field(props: { name: string; labelKey: string; unit?: string; datum?: VerticalRef; hintKey?: string; required?: boolean; children }): JSX.Element   // the unit and datum are in the label, always (E-13)
export function NumberField, TextField, SelectField, CheckboxField, UTCDateTimeField (label says UTC; value RFC 3339 Z), BBoxField, EnumField<E>(options from a `model` enumeration with i18n labels)
export function FieldErrors(props: { errors: FieldError[] }): JSX.Element    // the unmapped remainder, by field path
export function ConfirmDialog(props: { titleKey; bodyKey; reason?: { required: true; minLength: number }; destructive?: boolean; onConfirm(reason?: string) }): JSX.Element   // every audited act (a source switch, a publication, a certificate status) goes through a dialog with a reason (02 §1 failure rule: "every disable is an audited act by a person")
export function OutlineFields(props: { outline: DrawOutline; onChange(next: DrawOutline): void; maxVertices: number; circleOutlineShown?: boolean; kinds?: readonly ("polygon" | "circle")[]; legendKey?: string }): JSX.Element   // 1.0.0: the typed and keyboard path to DrawLayer's outline (WCAG 2.5.7): vertices added, edited, removed; a circle's centre and radius, said in words; checks only the form of a number (WGS84 ranges, a radius above zero), the API judges the outline; emptyOutline(kind)
```

### 3.16 `auth/server` and `auth/client` (WP-5)

Server (`server-only`; Next.js route handlers and server components):

```ts
export interface SessionCookieOptions { name?: string; csrfName?: string; secure: boolean; domain?: string; path?: string; maxAgeS: number }   // defaults "uspace_session", "uspace_csrf"; SameSite=Strict, HttpOnly on the session, Secure when secure
export function setSession(res: NextResponse, jwt: string, opts: SessionCookieOptions): void      // stores the API-issued session JWT; never decodes or verifies it (06 §3: the BFF never verifies tokens)
export function clearSession(res: NextResponse, opts: SessionCookieOptions): void
export function readSessionToken(req: NextRequest | ReadonlyRequestCookies, opts?): string | null
export function issueCsrf(res: NextResponse, opts): string; export function checkCsrf(req: NextRequest, opts): boolean   // double submit: cookie value equals X-CSRF-Token header on unsafe methods
export function forward(req: NextRequest, target: URL, opts: { session: SessionCookieOptions; allowPaths: RegExp[]; timeoutMs: number }): Promise<Response>   // the one BFF proxy: adds Authorization: Bearer <session>, strips cookies, copies Accept-Language and Content-Type, passes status and problem bodies through; refuses a path not in allowPaths with 404; never follows redirects
export function bffHandlers(opts): { login: RouteHandler; logout: RouteHandler; proxy: RouteHandler }   // the three routes every web/ mounts under /_bff/* (02 §3); login POSTs the credentials to the API's login endpoint over the server side and sets the cookie; the browser never sees the JWT. No WebSocket ticket route (M22): the BFF cannot proxy a WebSocket and a ticket in a query string is logged; the WS process accepts the session cookie on a same-origin upgrade with an `Origin` allow-list and verifies it with the shared verifier
// WP-5 additions: sessionDisplay(jwt | null): SessionDisplay | null (the SessionProvider value; null without sub, exp or realm); issueCspNonce() and CSP_NONCE_HEADER (the per-request CSP nonce the app's middleware puts in style-src, read back by ui's CspNonceProvider for Radix ScrollArea); authCounters(); the contract names (SESSION_COOKIE, CSRF_COOKIE, CSRF_HEADER, BFF_*_PATH); LoginResult (the login route's 2xx body: signed_in with recoveryCodes?, or mfa_required with enrolment?). BffOptions: apiBase, apiLoginPath, apiMfaPath? (the API's second sign-in step, e.g. the authority's /v1/auth/mfa), mfaChallengeSecret? (required with apiMfaPath, >= 32 bytes: seals the MFA challenge in the BFF-internal cookie uspace_mfa, HttpOnly, Secure, SameSite=Strict, Path=/_bff, Max-Age = the challenge's expiry; no API or WS process reads it), apiLogoutPath?, session, allowPaths, trustedProxyHops? (X-Forwarded-For is written by the BFF from its trusted proxy chain, never passed through), timeoutMs. The login route takes {username, password}, then {username, otp}; the seal binds the challenge to that username
export function sessionClaimsUnverified(jwt: string): { sub: string | null; roles: string[]; realm: string | null; exp: number | null } | null   // display only (which menu to show); authorisation is the API's; the name says so. Reads the reconciled session shape (M20): `sub`, `exp`, `roles: [string]`, `realm`; a `roles` claim that is absent or not an array gives `[]`, never a guess from `scope`
```

Client:

```ts
export function SessionProvider(props: { session: SessionDisplay | null; children }): JSX.Element   // the server component reads the cookie, decodes for display, passes it down (§3.1 `SessionDisplay`: `sub`, `roles[]`, `realm`, `exp`)
export function useSession(): { session: ...; signOut(): Promise<void> }
export function LoginForm(props: { action: string; mfa?: boolean; onSuccess(): void }): JSX.Element   // POSTs to /_bff/login; the password field is never logged, never put in the URL, autocomplete per spec
export function RequireRole(props: { anyOf: string[]; children; fallback?: ReactNode }): JSX.Element   // display gating only; matches when `session.roles` intersects `anyOf`
export function csrfToken(): string | null   // reads the non-HttpOnly csrf cookie for the api client
```

### 3.17 `eslint` (WP-0)

```ts
export default config: Linter.Config[]   // typescript-eslint strict + react-hooks + jsx-a11y + the rules below
export const rules: { noGeometryImports; noServerClientsInWeb; noBusinessLogicInRoutes; noHandWrittenApiTypes }
```

`noGeometryImports`: `no-restricted-imports` over `@turf/*`, `turf`,
`geolib`, `h3-js`, `proj4`, `cheap-ruler`, `geographiclib*`,
`@mapbox/geojson-area`, `geodesy`, `spherical-geometry-js`, `d3-geo`,
`ol`, `leaflet` (the map is MapLibre), and a regex on relative imports
named `geo`, `geodesy`, `cpa`, `conformance`. `noServerClientsInWeb`:
`pg`, `postgres`, `nats`, `nats.ws`, `ioredis`, `redis`, `@prisma/*`,
`drizzle-orm`, `kysely`, `knex`, `mongodb` anywhere under `web/`.
`noBusinessLogicInRoutes`: under `app/api/**` and `app/_bff/**` (served from `app/%5Fbff/**`, WP-5), only
imports from `@rootxkit/uspace-ui/auth/server`, `next/*` and the app's
own `lib/bff/*` are allowed. `noHandWrittenApiTypes`: under
`src/api/generated/**` only generated files (header check) may exist;
`interface`/`type` declarations elsewhere named like a schema component
are reported.

### 3.18 `test` (WP-0, WP-14)

```ts
export function renderWithKit(ui: ReactNode, opts?: { lang?: Lang; scheme?; brand?; now?: number }): RenderResult   // providers wired; fake timers friendly
export function fixtures(opts?: { source?: "synthetic" | "lab" }): { tracks: TrackView[]; zones: ZoneView[]; alerts: AlertView[]; manned: MannedView[]; sources: SourceView[]; status: FeedStatus }   // synthetic by default (GEO-TEST-* numbers, TEST* serials, 06 §4), covering every enumeration value at least once; `{ source: "lab" }` (WP-14): the lab's schema examples at the commits in src/test/fixtures/VERSION, decoded through the reference adapters
export function labFixtures(): Fixtures; export function labDecodings(): LabDecoding[]; export const LAB_COMMIT: string   // WP-14: the lab-derived set, and what each example decoded to (the conformance hook of 04 §4); the reference adapters (adaptTelemetry, adaptManned, adaptAlert, adaptSource, adaptStatus, adaptEd318Feature, adaptApplicability, adaptCisChange) are exported as @beta examples
export function axeCheck(container: HTMLElement): Promise<void>   // fails on any WCAG 2.2 AA violation
```

---

## 4. Third-party dependencies

Standard library and React first. A dependency is added with a one-line
reason in the commit body and a row here. Every runtime dependency is
pinned exact in `package.json` and locked; peers carry ranges.

| Package | Entry point | Why it is allowed |
|---|---|---|
| `react`, `react-dom` (peer `^19`) | all but `symbology`, `eslint` | The UI framework (`00 §6`). |
| `next` (peer `>=15`, optional; dev pin for the type check) | `fonts`, `auth/*` | `next/font/local`, `NextRequest`/`NextResponse`. Optional peer so vitest runs without it; the dev copy (exact pin, WP-2) gives `tsc` the `next/font/local` types. Verify the current major at WP-0 time, not from memory (§14 Q12). |
| `maplibre-gl` (peer `^5`) | `map`, `layers` | The map (`00 §6`). Peer, so the app controls one copy. |
| `pmtiles`, `@protomaps/basemaps` | `map` | D6: the self-hosted basemap protocol and the style layers the predecessor already used (P1-12). |
| `tailwindcss` (peer `^4`) | styles | D4. The app runs Tailwind; the kit ships tokens and source classes. |
| `radix-ui` (the unified package), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `cmdk` | `ui` | What the vendored shadcn/ui components import. Accepted as the cost of shadcn/ui (D5). |
| `server-only` (exact pin) | `auth/server` | The marker React and Next.js define for server-only modules: it resolves to an empty module under the `react-server` condition and throws everywhere else, so a client component that imports the BFF helpers fails to build (WP-5). No code beyond the throw. |
| `openapi-fetch` | `api` | The typed fetch companion of `openapi-typescript` (`00 §6.2`): the generated `paths` type gives typed requests and responses with a 6 kB runtime. |
| `openapi-typescript` (exact pin) | `bin/uspace-ui-gen-api` | The generator every `web/` runs through the kit's bin (§14 Q14), so it is a runtime dependency, not a dev one: the bin runs in the consumer's install and pins the generator version for all five apps (WP-4). Its peer `typescript` is the consumer's. |
| `@tanstack/react-table` | `table` | Headless table with sorting, filtering, pagination and virtualisation hooks; the accessible markup is ours. |
| `@tanstack/react-virtual` | `table` | Row virtualisation above 200 rows (§8). |
| `react-hook-form` (peer `^7.55`, optional), `zod` (peer `^4`, optional), `@hookform/resolvers` | `form` | Form state and schema validation; `zod` schemas are the app's, the kit maps errors. The first two are peers (WP-10) so the app and the kit share one copy: a second `react-hook-form` would split the form context, and the app builds its schemas with its own `zod`. Exact dev pins for the kit's own tests. |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` (peers of `/eslint`) | `eslint` | D11. |
| dev: `typescript`, `vitest`, `@vitest/browser`, `playwright`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `axe-core`, `prettier`, `publint`, `@arethetypeswrong/cli`, `@microsoft/api-extractor`, `fontkit` | tests, build, release | §9, §10, §12. `fontkit` reads the font `cmap` for D7. `api-extractor` writes the API report the semver gate diffs (§12). |
| `@types/geojson` (exact pin) | `model` | `ZoneView.geometry` and `IntentView.volumes` are GeoJSON types that appear in every consumer's declarations, so the types are a dependency, not a dev dependency. Types only, no runtime code (WP-0). |
| dev: `@vitest/browser-playwright`, `@vitest/coverage-v8`, `vite`, `@testing-library/dom`, `@types/react`, `@types/react-dom`, `@types/node` | tests | The Vitest 4 Playwright provider and v8 coverage; the Vite the browser project runs on; the peer of `@testing-library/react`; type packages (WP-0). |
| dev: `tailwindcss`, `@tailwindcss/vite` | the browser tests and the golden set | Tailwind v4 compiled the way the apps compile it (D4), so the vendored shadcn/ui classes and the token utilities exist in the browser tests and in axe's contrast checks (WP-1). Build-time only; never in `dist/`. |
| dev: `@maplibre/maplibre-gl-style-spec` (exact pin, the version `maplibre-gl` already resolves) | tests | MapLibre's own expression parser and style validator: the symbology's expressions are evaluated as MapLibre would and the layers a layer component builds are validated, without a WebGL context (§9 "tested as data"; WP-6). Never imported by `src/` outside tests. |
| example dev: `@tailwindcss/postcss` (exact pin, the `tailwindcss` version) | `examples/next-app` only | Tailwind v4's PostCSS plugin, which Next.js runs to compile `globals.css` with the kit's tokens and `@source` scan (D4, §14 Q13); every `web/` has it. Not a dependency of the package. (WP-13) |

Rejected: any geometry or geodesy library (the lint rule forbids it for
everyone, the kit included); `i18next`/`react-intl` (two catalogues and
`{name}` interpolation do not need a framework; the plural rule for `ka`
and `en` is one suffix); a state library (`useSyncExternalStore` and
three small stores); a bundler (D3); `next-auth` (the session is a cookie
the API issued; there is nothing to negotiate); any analytics or error
reporting SDK (a state console reports nowhere); a hosted visual-diff
service (D9); `three`/`deck.gl` (no 3D at this scale; MapLibre fill
extrusions cover intent volumes if ever needed).

---

## 5. Lessons and spec rules per package

"Embodies" lists the LESSONS IDs whose rule ends in a display, a wording
or a client behaviour; the package's tests name them. The judgement
behind a lesson stays in `uspace-core`; the kit shows its result.

| Package | Spec | Embodies |
|---|---|---|
| `model` | `04 §2`, `04 §3.2`, `04 §3.3`, `00 §5`, `02 F2` states | G-01 (four statuses), R-05 (basis), E-13 (units in names: `altAmslM`, `speedMs`, `ageS`) |
| `theme`, `ui` | `00 §6.3`, `06 §4` branding, `08` Q15 | — (accessibility: WCAG 2.2 AA contrast per token pair) |
| `i18n`, `fonts` | `00 §6.3`, `02 §1` time, `06 §5`, `08` Q15 | R-05, C-12, B-03, B-04, B-11, G-10, E-13 (a label never shows a bare altitude), S-16 (UTC said out loud); format: null is a dash |
| `map` | `05 §5` viewport subscription, `06 §4` | P1-12 (self-hosted basemap, OSM date shown), E-02 (no WebGL and no basemap are visible states) |
| `api` | `02 §1` versioning (unknown fields ignored), F3/F5 freshness fields, `06 §3` | B-10 (503 + Retry-After is a refusal, not an error), "no retry loops around side effects" |
| `symbology`, `legend` | `00 §6.3` (trust class, identification status, age, zone type, restriction state), `04 §2` | R-05 (broadcast always hollow), G-03 (legend order: attention statuses listed, not judged), Z-10 (severity per type is the API's; the colour per type is ours), E-13 |
| `layers` | `04 §3.1` track fields, `04 §3.4` ED-318, `02 F2` restriction states, `04 §3.5` Volume4D | R-05, R-12 (height over take-off is labelled as such, never "AGL"), R-09 (pressure altitude marked), C-10 (the conflict line is the API's pair, no prediction drawn by the client), T-13 (a track only moves forward: an older `capturedAt` for the same id is ignored and counted) |
| `live`, `status` | `04 §2` envelope, `05 §5`, `05 §6`, `02 §1` failure rule | B-08, C-08 (replay is expected on connect and shown), C-12, B-03, B-04, B-11, E-09 (every drop counted and shown), E-10 (bounded stores), T-04 (`backlog: true` frames are drawn as history, never as live) |
| `alerts` | `04 §3.3`, `02 F5` conformance alerts | C-06 (raise once; a repeated raise under one key replaces), C-07 (a severity change shows as a new raise), C-12, C-14 (a clear shows its own numbers and reason), S-25, C-16 (the console never waits for delivery; a failed delivery is itself shown as an alert when the API says so) |
| `table`, `form` | `02 §1` conventions, `06 §5` (no PII in URLs), uspace-core `FieldError` | E-13, S-16, Z-02 (an import names every problem: the form shows the whole list), B-09/B-11 (a switch needs a reason) |
| `auth/*` | `06 §3`, `00 §6.2` JWT paragraph, `02 §3` `/_bff/*` | S-15 (login limits are the API's; the form shows `Retry-After`), "no credential in browser JavaScript" |
| `eslint` | `00 §6` hard rule, `06` T12, `07` KT-3 | E-01 (the rule has a test that fails on a forbidden import and one that passes a permitted one) |

---

## 6. Data, bus and the published contract

### 6.1 Data model and migrations

None. The kit has no database. Per-viewer conveniences (language,
colour scheme, layer toggles, table state) live in a cookie
(`uspace_lang`, `uspace_scheme`) or the URL; nothing else is stored in
the browser by the kit. No `localStorage` of track, alert or registry
data (a console at a shared desk must not leak the last picture to the
next user; `06 §5`).

### 6.2 Events on the bus

None. The kit never holds a NATS client (`00 §6`); `noServerClientsInWeb`
makes that a lint failure in every consumer too. What a console receives
is the WebSocket its own system serves (`02 §3`: `/v1/picture/*`,
`/v1/traffic`, `/v1/stream`, `/v1/manned-traffic/stream`), opened
same-origin with the session cookie on the upgrade (§6.3, M22).

### 6.3 Contracts this package publishes

| Contract | Where | Consumers |
|---|---|---|
| The package API of §3 and the `exports` map of §2 | `docs/api/uspace-ui.api.md` (api-extractor report, committed) | every `web/` |
| The view-model enumerations, mirroring `uspace-core/core` | `model/` | every `web/` adapter; the lab's schema examples test |
| The console frame (adopted by all four systems, M29; the schemas live in `uspace-lab/schemas/common/`) | below | every system's WS process and the kit's `live` |
| The session and cookie contract (adopted by all four systems, M20, M21, M22): the BFF route set `/_bff/login`, `/_bff/logout`, `/_bff/api/*`; cookie names `uspace_session` (`HttpOnly; Secure; SameSite=Strict`, the API-issued session JWT) and `uspace_csrf` (readable, double-submit), header `X-CSRF-Token` on unsafe methods; the session JWT shape the kit decodes for display: `iss` = the system's issuer, `aud` = the system's own host, `sub` = account id, `scope = "session"`, `roles: [string]`, `realm` (`console` / `police` / `portal`), `jti`, `exp` ≤ 12 h, `kid`; WebSocket authentication = the session cookie on a same-origin upgrade with an `Origin` allow-list, close code `4401` = re-login; no ticket route | `auth/server`, `live` | every `web/` and every WS process; the Caddy config in `uspace-deploy` |
| The basemap bundle layout `/basemap/basemap.pmtiles`, `/basemap/SOURCE.json` (`bounds`, `osm_data_as_of`), `/basemap/fonts/{fontstack}/{range}.pbf`, `/basemap/sprites/v4/{light,dark}.*` and the fontstack name | `map`, `fonts` | the lab's basemap build; each compose and Caddy |
| Branding variables `UI_BRAND_NAME`, `UI_BRAND_SHORT_NAME`, `UI_BRAND_LOGO_URL`, `UI_BRAND_CONTACT`, `UI_BRAND_ACCENT`; language cookie `uspace_lang` and `Accept-Language` negotiation | `theme`, `i18n` | each deploy's config bundle (`06 §4`) |
| The lint rules of §3.17 | `eslint` | every `web/` CI |

**The console frame** (adopted by all four systems in the cross-plan
reconciliation, M29; §14 Q5). Every WebSocket message from a system to
a console is one JSON object carrying the common envelope of `04 §2`
(`schema`, `msg_id`, `producer`, `ts`, `rx_ts`, `captured_at`,
`time_source`, `backlog`) and a `body` whose shape is named by `schema`.
The JSON Schemas and examples of `envelope/v1`, `console/status/v1`,
`console/snapshot/v1` and `console/subscribe/v1` are owned by
`uspace-lab/schemas/common/` (lab WP-L1), not by this repo or by any
system; the kit's `live` tests and WP-14's fixtures consume them.
Machine-facing streams (the ANSP's F4 feed, the USSP's `/v1/traffic`)
carry the same envelope, so one client code path parses both; only
their bodies differ. Frames the kit understands by `schema`:

| `schema` | Body | Kit behaviour |
|---|---|---|
| `console/status/v1` | `{connection_id, server_ts, policy_version, stale_after_s, live_max_age_s, dropped_frames, degraded[], sources[]}` sent on connect and every 2 s (`04 §3.6` `source/status/v1` cadence); optional per-system extras the kit renders when present and ignores when absent: `datasets{}` and `cis_version` (CISP), `projection_age_s` and `dp_state` (authority), `cis_age_s` (any CIS consumer), `nats` (bus state), `resync_since` (the CISP's resync: "re-fetch everything changed since T") | `FeedStatus`; thresholds for the age buckets; `SourceView`s; server clock offset for captured-age display; `DegradedBanner` shows `cis_age_s` and the `datasets{}` ages; a `resync_since` is passed to `onFrame` as a status frame so the app refetches |
| `console/snapshot/v1` | `{tracks[], alerts[], manned[], zones_version}` on connect and on re-subscribe (C-08 replay) | stores replaced, not merged; a track absent from the snapshot is dropped as `resolved` |
| `track/telemetry/v1`, `track/manned/v1` | per `04 §3.1` | app adapter to `TrackView` / `MannedView`; `backlog: true` goes to the trail, never to the live position |
| `alert/v1`, `violation/v1` | per `04 §3.3` | app adapter to `AlertView`; `state` drives raise/update/clear |
| `cis/change/v1` | per `04 §3.4` | the app refetches the dataset; the kit shows "zones updated to version V at T" |
| `traffic/product/v1` | per `02 F5` (the USSP's traffic information to operators) | app adapter to `TrackView`s and `AlertView`s; the same stores |
| anything else | — | passed to `onFrame` untouched, counted as `frames_unhandled` |

Subscription control from the client is one frame
`{schema: "console/subscribe/v1", body: {bbox, layers[]}}` sent on open
and whenever `useBBoxSubscription` fires; the server answers with a
snapshot. The adapter seam (`onFrame`) remains for a machine-facing body
the kit does not catalogue; the envelope and the three `console/*`
frames are not optional for a browser-facing WebSocket.

### 6.4 Contracts this package depends on

| From | What | Status |
|---|---|---|
| each system repo | `api/openapi.yaml` (OpenAPI 3.1), from which the app generates `paths` with `openapi-typescript` and passes it to `createClient<Paths>` | the kit never reads a system's spec; it ships the generator wrapper so every app generates the same way (WP-4) |
| `uspace-lab/schemas/` (KT-2) | `schemas/common/`: `envelope/v1`, `track/telemetry/v1`, `source/status/v1`, `zone/applicable/v1`, `console/status/v1`, `console/snapshot/v1`, `console/subscribe/v1`, `problem/v1` (shapes produced by several systems, M14); mirrored per-system schemas of `track/manned/v1` (ANSP), `alert/v1`, `traffic/product/v1` (USSP), `violation/v1` (authority), `cis/change/v1` (CISP); each with examples | **does not exist yet** at `uspace-lab@2b98ee8`; lab WP-L1 creates it (common schemas first); WP-14 wires the examples into `test/fixtures` when it does; until then the fixtures are synthetic and the enumerations are pinned to spec text (§14 Q16) |
| `uspace-core` | the string values of `core` enumerations (`Trust`, `Severity`, `ZoneType`, `IdentStatus`, `IdentReason`, `IdentBasis`, `AltSource`, `VerticalRef`, `TimeSource`), `core.FieldError` shape, `ed318` field names | mirrored by hand in `model/` with a test; a divergence is a kit bug |
| the lab | the basemap bundle (D6) | predecessor `utm/infra/basemap/fetch_basemap.sh` is the reference; §14 Q4 |
| every system's `api` | the session JWT the console login returns, in the reconciled shape (`sub`, `roles[]`, `realm`, `exp`, `scope = "session"`) for display gating | `00 §6.2`; M20 decided; the kit decodes without verifying and says so in the function name |
| every API | an error body the form kit can map: `application/problem+json` with `errors: [{field, reason}]`, `truncated?` | §14 Q2, decided (M28) |
| every WS process | the console frame of §6.3; the session cookie accepted on a same-origin upgrade with an `Origin` check | §14 Q5, decided (M29, M22) |
| every API that serves a picture or a feed | the display thresholds (`stale_after_s`, `live_max_age_s`) in the status frame | §14 Q6, decided (M29) |
| the CISP read API and the authority's `GET /v1/zones/export` | `?applies_at=<RFC 3339>`: annotate every feature with `extendedProperties.cis_applicability` ∈ `applies` / `not_applicable` / `unknown`, no filtering, beside the filtering `?at=` | §14 Q3, decided (M17); the app maps `cis_applicability` onto `ZoneView.applies` (`applies` → `true`, `not_applicable` → `false`, `unknown` → `null`) |
| `uspace-deploy` and the lab | `/basemap/*` served by the deployment's Caddy from one shared read-only volume on every host; the bundle built by lab WP-L3 | §14 Q4, decided (M38) |

---

## 7. Security

| Rule | Mechanism |
|---|---|
| No credential in browser JavaScript (`06 §3`) | `LoginForm` posts to `/_bff/login`; the session JWT lives in an `HttpOnly` cookie; `auth/client` never sees it; `sessionClaimsUnverified` runs server side on the cookie and passes a display struct down. `gitleaks` in CI. |
| CSRF | double-submit token on every unsafe BFF call; `createClient` adds the header; `checkCsrf` refuses without it. |
| The BFF is a proxy with an allow-list | `forward()` refuses paths outside `allowPaths`, strips cookies, never follows redirects, bounds the timeout, passes `Retry-After` through. |
| WebSocket authentication (M22) | the browser opens the system's WS same-origin and sends the `uspace_session` cookie on the upgrade; the WS process checks `Origin` against its allow-list and verifies the cookie with the shared verifier. No ticket, no token in a query string (it would be logged), no BFF proxying of WebSockets. A `4401` close means the session is gone and the kit asks the app to re-login. |
| No PII in URLs (safety rules of this project; `06 §5`) | `useTableUrlState` and every link helper refuse keys named like identity fields (`name`, `email`, `phone`, `address`, `registration_number` secret part) — a test pins the list. |
| No judgement in TypeScript (`06` T12) | the `/eslint` rules, applied to the kit itself in its own CI. |
| Supply chain (`06 §4`) | exact pins, `pnpm install --frozen-lockfile`, Dependabot, `pnpm audit` as a non-gating report, release tarballs built and tested in CI and pinned by lockfile integrity, with `SHA256SUMS` (D10; npm provenance if the npm path is switched on), `SECURITY.md` with a 90-day policy. |
| Content Security Policy | the kit documents the CSP every `web/` sets (`connect-src 'self'` for API, WS and the basemap; `worker-src blob:` for MapLibre; `font-src 'self'`; no `unsafe-eval`) and `examples/next-app` ships it; a browser test (`browser/csp/`) loads under it. |
| Public repository | no hostname, no organisation name, no logo in the repo; `GEO-TEST-*` and `TEST*` fixtures only; a CI grep for `chikox.net` fails outside `examples/*/README.md`. |
| Display is not authorisation | `RequireRole` hides, the API decides. Every component that triggers an audited act collects a reason and calls back; it never calls an API itself. |

---

## 8. Performance budgets

Derived from spec `05 §1` (consoles 10 / 30 / 60 concurrent, each viewing
a cell set with ≤ 200 tracks; console WS out 2 000 / 6 000 / 12 000
msg/s), `05 §5` (server throttle to ≤ 2 Hz per track above 200 tracks in
a viewport) and `05 §7` (ingest-to-picture p99 < 1 s, of which the
browser gets a share). Budgets are checked by vitest benchmarks run in
browser mode and reported in the job summary; the lab's load test (L-M2)
is the proof.

| Quantity | Budget | How |
|---|---|---|
| Frames into one console | 200 tracks × 2 Hz = 400 track frames/s plus alerts and status | `useFeed` parses and dispatches 400 frames/s at < 10 % of one core on a 2-core laptop |
| WS frame to painted position | ≤ 100 ms p99 (the browser's share of the 1 s) | stores update synchronously; layers coalesce into one `setData` per animation frame; measured by a benchmark that feeds 400 frames and times the next frame |
| GeoJSON source update | one `setData` (or `updateData` partial) per layer per frame; never per message | `TrackLayer` batches with `requestAnimationFrame`; at 1 000 tracks in view (over the throttle case) ≤ 8 ms per update |
| Memory | track store ≤ 1 000 tracks × (1 view + 60 trail points) ≈ 10 MB; alert hold ≤ 500; eviction counted (E-10) | bounded stores with tests past the bound |
| Initial JS | `map` + `layers` + `symbology` + `legend` ≤ 60 kB gzipped on top of `maplibre-gl` (≈ 250 kB gz); a public zone map page ≤ 400 kB gz total; `table` ≤ 40 kB; `form` ≤ 30 kB | `size-limit`-style check in CI with the numbers in `package.json` |
| Basemap first paint | ≤ 2 s on a 10 Mbit link for a city view (PMTiles range requests, tiles cached by the browser) | a map page with the lab's bundle, measured by hand at WP-3 and noted |
| Table | 10 000 rows virtualised scroll at 60 fps; sort of 10 000 rows ≤ 50 ms | benchmark |
| Fonts | ≤ 120 kB woff2 total for Latin + Georgian regular and bold subsets | CI test on file sizes |
| Reconnect | first retry at 1 s, factor 2, cap 30 s, jitter; forever (B-08) | test with fake timers |
| Accessibility | every browser test passes `axe` WCAG 2.2 AA; keyboard-only operation of map controls, table and alert list | CI |

---

## 9. Testing strategy

Rules of `CLAUDE.md` (from LESSONS E-01, E-02, E-04, E-10, E-11): test
presence, not only absence (every "renders nothing" has a "renders it"
twin; every "does not call back" has a "calls back"); run the branch
that says nothing is wrong (a feed that stays live for ten minutes with
no frames must show the age climbing; a basemap that loads must show the
OSM date; a form that succeeds must clear its errors); report what was
run and seen; drive every bounded structure past its bound; tests restore
global state (timers, `matchMedia`, cookies) and pass shuffled.

| Level | Tool | What |
|---|---|---|
| Unit (pure) | vitest, node | `symbology` (total functions; expression snapshots as data), `i18n` formatters and catalogue parity, `model` enumeration pins, `api` problem and freshness parsing, `live` stores with fake timers, `auth/server` cookie and CSRF logic with mocked `NextRequest`, the ESLint rules with `RuleTester` |
| Component | vitest + Testing Library, jsdom | `status`, `alerts`, `table`, `form`, `legend`, `LoginForm`, `MapControls`: behaviour, keyboard, ARIA, wording per lesson, every enumeration value rendered at least once (presence) |
| Browser | vitest browser mode (Playwright Chromium), the `browser` project over `browser/**/*.test.tsx` | every component renders without error in both languages and both schemes, `axe` passes after every test, interaction tests drive the real browser (`vitest/browser` `userEvent`), DOM snapshots of the golden set (`browser/golden/`): legends, status bar in each state, alert list, a table page, a form with field errors, the login form; MapLibre renders with `--use-gl=angle --use-angle=swiftshader` for smoke only (no pixel snapshot, D9) |
| Benchmarks | vitest `bench` in browser mode | the §8 rows; reported, not gated |
| Fonts | vitest + `fontkit` | every Georgian block covered (D7); size budget |
| Package | `publint`, `@arethetypeswrong/cli`, `api-extractor` | `exports` resolve for `node16`/`bundler`, types ship, no `any` in the public API, the API report is up to date |
| Consumer | `examples/next-app` built with `next build` in CI (`output: standalone`), lint with `/eslint`, `openapi-typescript` run on a tiny fixture spec and `createClient<Paths>` type-checked | the integration a `web/` will do; also the CSP test |
| Conformance hooks (lab) | `test/fixtures` from `uspace-lab/schemas/` examples (WP-14); `model` enums against `uspace-core/core` by a script that reads the Go source at a pinned tag (`scripts/check-enums.sh`, online, best-effort on PRs, required on `main`, like core's vector check) | `04 §4`: schema examples pass everywhere; a kit that cannot render a value the bus can carry fails here |

"Integration with a real Postgres/NATS in CI" from the template does not
apply (§1.1); the integration surface is the consumer app and the WS
frame, both exercised above with a mock WS server (`live` tests run
against an in-process `ws` server that replays recorded frame sequences,
including a 4401 session expiry, a 60 s silence and a `backlog` burst).

Coverage: a work package is done at ≥ 90 % statement coverage of its
entry points, with every branch that produces a distinct wording or a
distinct visual state covered by a named test.

---

## 10. CI workflow

`.github/workflows/ci.yml` (written by WP-0; it does not exist on
`plan/initial` because there is nothing to run yet, and a workflow that
is green over nothing is the kind of success path this project has been
bitten by). Jobs on push to `main` and pull requests, and on tags `v*`
through `release.yml` (`workflow_call`); `ubuntu-latest`; Node 22 from
`.nvmrc`; pnpm from `packageManager`; `concurrency: ci-${{
github.workflow }}-${{ github.ref }}` with cancel-in-progress; every job
`timeout-minutes: 15`; path filter ignores `docs/**` and `*.md` except
`docs/api/**` (the API report is code). No scheduled job.

1. `check`: `pnpm install --frozen-lockfile`; `prettier --check`; `eslint`
   (the kit's own `/eslint` config, so the kit obeys its own rules);
   `tsc --noEmit`; `pnpm build`; `publint`; `attw`; `api-extractor run`
   (fails if `docs/api/uspace-ui.api.md` is stale); size budget check;
   the `chikox.net` grep.
2. `test`: `vitest run --coverage` (node and jsdom projects); coverage
   summary printed; profile uploaded.
3. `browser`: Playwright Chromium from the cache (`~/.cache/ms-playwright`
   keyed on the Playwright version); `vitest run --project browser`
   (component tests, `axe`, golden DOM snapshots).
4. `fonts`: the glyph coverage and size tests (fast; separate so a font
   change shows its own job).
5. `example`: `examples/next-app` with `next build`, its lint, and the
   generated-types check (`openapi-typescript` output committed and
   diffed).
6. `gitleaks` (`06 §4`).
7. `enums` (`main` only, required; best-effort on PRs): `scripts/check-enums.sh`
   against `uspace-core` at the tag in `docs/CORE_VERSION`.

8. `pack` (WP-13a): `pnpm build`, `pnpm pack` with the pack test (the
   tarball holds exactly `files`, nothing from `src/`, `browser/`,
   `docs/`, `scripts/`, `.github/`, and every `exports` and `bin`
   target), publint and attw on the tarball, then the consumer test: the
   tarball served under its release URL path and installed by URL into a
   scratch pnpm project (lockfile integrity, every subpath resolves, the
   entry points type-check under `NodeNext` and `Bundler`, the bin runs,
   changed bytes refused by `--frozen-lockfile`). Uploads the tarball as
   the `package` artifact and writes a "would release" line.

`.github/workflows/release.yml` (written by WP-13a, first run on
`v0.1.0-rc.1`): on tag `v*`: a `tag` job that fails unless the tag is
`v<version>` and `CHANGELOG.md` has the version's section; then all of
`ci.yml` on the tag through `workflow_call`; then a `release` job with
`contents: write` (only there) and the run's `GITHUB_TOKEN` that takes
the `pack` artifact, checks its SHA-256, writes `SHA256SUMS`, and
creates the GitHub Release with both files and the CHANGELOG section,
marked pre-release when the version has a pre-release suffix, and reads
it back (flag, assets, the downloaded bytes). No registry publish (D10).

Branch protection on `main` requires jobs 1–6 and 8.

Caches: pnpm store (`actions/setup-node` with `cache: pnpm`), Playwright
browsers, Next.js build cache for the example. No Docker in this repo.

---

## 11. Consumption and deployment

The kit is not deployed. Each system's `web/` consumes it:

```jsonc
// web/package.json
"packageManager": "pnpm@<exact>",   // pnpm everywhere (M34): corepack, `pnpm install --frozen-lockfile`, `pnpm-lock.yaml` committed; no npm ci, no package-lock.json
"dependencies": { "@rootxkit/uspace-ui": "https://github.com/rootxkit/uspace-ui/releases/download/v0.3.1/rootxkit-uspace-ui-0.3.1.tgz", "maplibre-gl": "5.x", "next": "...", "react": "19.x", "react-dom": "19.x" }   // one release asset URL (D10): the lockfile pins its integrity; never a `github:` spec or a branch
```

Minimum kit version per consumer (M33): CISP `web/` ≥ `0.1.0-rc.1`
then `0.1.0` (public map, console shell); ANSP WP-11 ≥ `0.1`
(`RestrictionLayer`), ANSP WP-12 ≥ `0.3` (`MannedLayer`); authority
WP-21 ≥ `0.2` (`live`, `TrackLayer`); USSP WP-17 ≥ `0.2` for the intents
pages (`form`, `table`) and ≥ `0.3` for the traffic pages (`alerts`).

```css
/* web/app/globals.css */
@import "tailwindcss";
@import "@rootxkit/uspace-ui/styles/tokens.css";
@import "@rootxkit/uspace-ui/styles/map.css";
@source "../node_modules/@rootxkit/uspace-ui/dist";
```

```ts
// web/app/layout.tsx
import { fontClassName } from "@rootxkit/uspace-ui/fonts";
import { ThemeProvider, brandFromEnv } from "@rootxkit/uspace-ui/theme";
import { I18nProvider, negotiateLang } from "@rootxkit/uspace-ui/i18n";
// web/eslint.config.js
import kit from "@rootxkit/uspace-ui/eslint"; export default [...kit, /* app rules */];
// web/app/_bff/[...route]/route.ts
import { bffHandlers } from "@rootxkit/uspace-ui/auth/server";
// web/src/api/client.ts
import { createClient } from "@rootxkit/uspace-ui/api"; import type { paths } from "./generated/openapi";   // openapi-typescript api/openapi.yaml
export const api = createClient<paths>({ baseUrl: "/_bff/api", csrfToken });
// web/src/adapters/track.ts  — the one hand-written mapping, from generated types to the kit's view model
export function toTrackView(t: components["schemas"]["Track"]): Omit<TrackView, "receivedAtMs"> { ... }
```

Every `web/` also (M38, M22, M21):

- sets the kit's Content Security Policy (§7: `connect-src 'self'` for
  the API, the WS and the basemap; `font-src 'self'`; `worker-src
  blob:`; no `unsafe-eval`) in its `next.config`, as `examples/next-app`
  shows; a console makes no third-party request, ever;
- serves the kit's fonts through `next/font/local` from `/fonts`
  (`fontClassName` on `<html>`); no Google Fonts;
- reads the basemap at `/basemap/` (`BasemapConfig.baseUrl`), which the
  deployment's Caddy (`uspace-deploy`) serves from one shared read-only
  volume on every host with range requests and long cache headers; the
  bundle is built by the lab (WP-L3) as a release artefact with a size
  budget (a Georgia-wide extract with city-level zooms for Tbilisi,
  Kutaisi, Batumi and Poti, `z ≤ 12` elsewhere, under about 1 GB); the
  `web/` image contains no tiles;
- mounts the three BFF routes under `/_bff/*`, uses the cookie names
  `uspace_session` / `uspace_csrf` and opens its WebSocket same-origin
  with the cookie (§6.3 session contract); its `api` and WS processes
  verify that cookie with the shared `core/auth.Verifier`.

Upgrade policy for consumers: a `web/` pins an exact version and bumps
it in its own PR, running its own lint, build and tests against its
adapters. Two majors of the kit are maintained for
six months (§12), so a system is never forced to upgrade in step with
another. Pre-releases (`0.1.0-rc.N`) are GitHub pre-releases; a consumer
pins their asset URL exactly like a release's and moves to `0.1.0`'s
when it is tagged.

Images: each system's CI builds its `web/` with `next build` (`output:
standalone`) into that system's image; the droplet never builds Next.js
("Never build Next.js on the server"). The kit adds nothing to runtime
memory beyond its JS; the 3.8 GB droplet constraint is the systems'
concern and the kit's bundle budget (§8) is its contribution.

This repo hosts nothing: the release tarball is its only artefact (D9,
D10).

---

## 12. Versioning and release

- `v0.1.0-rc.1` (WP-13a, D10): the first release, a GitHub pre-release,
  as soon as WP-0..WP-5 merge: `model`, `theme`, `ui`, `i18n`, `fonts`,
  `map`, `api`, `auth/*`, `eslint`, `test`, and whatever else is on
  `main` by then (its CHANGELOG section lists what ships and what does
  not). `rc.2`, `rc.3`, ... were to follow each merge the CISP's `web/`
  needs; none was cut, and `v0.1.0` followed `rc.1`. An rc may still
  change an export; the CHANGELOG says what moved.
- `v0.1.0` = U-M1 (`07`), tagged by the owner from `main`. *Amended on
  2026-10-04 to what it ships:* everything that was on `main` before
  the tag, which is every entry point of §2: `model`, `theme`, `ui`,
  `i18n`, `fonts`, `map`, `api`, `auth/server`, `auth/client`,
  `symbology`, `layers` (`ZoneLayer`, `RestrictionLayer`, `TrackLayer`,
  `AlertLayer`, `MannedLayer`, `IntentLayer`, `ReceiverLayer`), `legend`
  (`ZoneLegend`, `TrackLegend`, `IdentificationLegend`, `AgeLegend`,
  `SeverityLegend`), `live`, `status`, `alerts`, `table`, `form`,
  `eslint` and `test`. In the repository at the tag, not in the
  tarball: the example app (`examples/next-app/`) and
  `docs/CONSUMING.md`. The CISP public map and console build on it and
  nothing else. *Was:* the rc entry points plus `ZoneLayer`,
  `RestrictionLayer` and `ZoneLegend` (WP-6; `RestrictionLayer` because
  the ANSP's N-M1 console, WP-11, needs it: M33) and the example app.
- `v0.2.0` and `v0.3.0`: *amended on 2026-10-04.* What they were to
  bring (WP-7..WP-12: the live feed, status, tracks, table, form,
  alerts and the traffic layers) merged before `v0.1.0` and shipped in
  it, so neither has planned content. A minor before `v1.0.0` now
  carries whatever merges next, and its CHANGELOG section says what
  moved and why. The `0.2` and `0.3` minimums of §11 name components
  that are all in `0.1.0`, so a consumer can pin `0.1.0` for them.
- `v1.0.0` (D12): the API report of §3 declared stable, the semver gate
  in CI, the lab's schema examples wired, two consoles in use.
- From `v1`: within a major only additive changes (new exports, new
  optional props, new catalogue keys, new enumeration values *rendered*
  because `model` gained them). The following are a **major**: removing
  or renaming an export or a prop; changing what a colour, shape or
  pattern *means* (operators are trained on the legend); changing a
  wording rule (R-05, C-12, B-11); changing a cookie name or the BFF
  route set; changing the console frame; dropping a `next`, `react` or
  `maplibre-gl` major. A palette change that keeps every meaning, and a
  new translation, are a minor. Two majors are maintained for six months
  on `release/v<N>` branches.
- Before `v1` the same rules apply with a minor in place of a major, and
  the CHANGELOG says why.
- The semver gate (WP-14): `api-extractor` writes
  `docs/api/uspace-ui.api.md`; a PR whose diff removes or changes a line
  there (as opposed to adding one) must add a new major heading to
  `CHANGELOG.md` and carry the label `breaking`; a diff under
  `styles/tokens.css` that changes a semantic colour, or under
  `src/symbology/` that changes a `*Token`/`*Shape` mapping, needs the
  label `legend-change` and a CHANGELOG line naming the lesson or spec
  row behind it.
- `docs/CORE_VERSION` pins the `uspace-core` tag the enumerations are
  mirrored from; bumping it is its own `build:` commit that runs the
  enum check.

---

## 13. Milestones, work packages and waves

Each WP has a brief in `docs/WORKPACKAGES/WP-<k>.md` that is complete on
its own. Branch `feat/WP-<k>-<slug>`. Commit suffix `[WP-<k> U-M<n>]`.
Done-when always includes: `pnpm check` (prettier, eslint with the kit's
own rules, `tsc`, build, publint, attw, api report) clean; `pnpm test`
and `pnpm test:browser` green with ≥ 90 % statement coverage of the owned
entry points; every browser test passes `axe`; every user-facing string in both
catalogues; the API report updated; a CHANGELOG line; the PR pastes the
outputs (E-04).

| WP | Slug | Owns (exclusively) | Depends on | Milestone |
|---|---|---|---|---|
| WP-0 | `scaffold` | `package.json`, tooling, `src/model/`, `src/eslint/`, `src/test/` (helpers), CI, the vitest browser config, `CLAUDE.md`, `SECURITY.md`, `CHANGELOG.md` | — | U-M0 |
| WP-1 | `theme-ui` | `src/theme/`, `src/ui/`, `styles/tokens.css` | WP-0 | U-M1 |
| WP-2 | `i18n-fonts` | `src/i18n/`, `src/fonts/`, `fonts/` | WP-0 | U-M1 |
| WP-3 | `map-core` | `src/map/`, `styles/map.css` | WP-0 (types), WP-1 (tokens) for the control styling only; starts on WP-0 | U-M1 |
| WP-4 | `api-adapter` | `src/api/`, `bin/uspace-ui-gen-api` | WP-0 | U-M1 |
| WP-5 | `bff-auth` | `src/auth/` | WP-0 | U-M1 |
| WP-6 | `zones` | `src/symbology/zone*`, `src/symbology/restriction*`, `src/layers/useLayer.ts` (the layer lifecycle helper every layer uses), `src/layers/ZoneLayer`, `src/layers/RestrictionLayer`, `src/legend/ZoneLegend` | WP-1, WP-2, WP-3 | U-M1 |
| WP-7 | `tracks` | `src/symbology/track*`, `src/symbology/ident*`, `src/symbology/age*`, `src/symbology/severity*`, `src/layers/TrackLayer`, `src/legend/{Track,Identification,Age,Severity}Legend` | WP-1, WP-2, WP-3, WP-6 (`useLayer`) | U-M2 |
| WP-8 | `live-status` | `src/live/`, `src/status/` | WP-2, WP-4 | U-M2 |
| WP-9 | `table` | `src/table/` | WP-1, WP-2 | U-M2 |
| WP-10 | `form` | `src/form/` | WP-1, WP-2, WP-4 | U-M2 |
| WP-11 | `alerts` | `src/alerts/`, `src/layers/AlertLayer` | WP-7, WP-8 | U-M3 |
| WP-12 | `traffic-layers` | `src/symbology/manned*`, `src/symbology/intent*`, `src/layers/{Manned,Intent,Receiver}Layer`, `src/status/TrackDetail` (the selected-track panel with the Remote ID block) | WP-6, WP-7, WP-8 | U-M3 |
| WP-13a | `rc-publish` | `.github/workflows/release.yml`, CI's `pack` job, the release configuration (`files`, `version`, the pre-release rule; `publishConfig` kept for a later npm switch), `CHANGELOG.md` `0.1.0-rc.N` sections, `docs/RELEASING.md` (D10: GitHub Release tarballs) | WP-0..WP-5 merged (the rc ships what is on `main`) | U-M1 (tags `v0.1.0-rc.N`; first publish) |
| WP-13 | `release-0.1` | `examples/next-app/`, `README.md` consumer section, `docs/CONSUMING.md`, the `0.1.0` changelog and tag | WP-1..WP-6, WP-13a | U-M1 (tag `v0.1.0`) |
| WP-14 | `v1-gate` | semver gate, `scripts/check-enums.sh`, lab schema fixtures, API report freeze, `v1.0.0` | WP-7..WP-13 | U-M4 (tag `v1.0.0`) |

Waves (what can run in parallel):

```
wave 0 (first, one agent):        WP-0
wave 1 (5 agents, after WP-0):    WP-1  WP-2  WP-3  WP-4  WP-5
wave 2 (after 1, 2, 3 / 2, 4):    WP-6 (needs 1, 2, 3)   WP-7 (needs 1, 2, 3)   WP-8 (needs 2, 4)   WP-9 (needs 1, 2)   WP-10 (needs 1, 2, 4)   WP-13a (needs 0..5 merged) -> tag v0.1.0-rc.1, then rc.2 after WP-6
wave 3 (after 6 and 13a):         WP-13 -> tag v0.1.0 = U-M1 (with cisp C-M1)
wave 3 (after 7, 8 / 6, 7, 8):    WP-11 (needs 7, 8)     WP-12 (needs 6, 7, 8)   -> tag v0.2.0 / v0.3.0
wave 4:                           WP-14 -> tag v1.0.0 = U-M4
```

Critical path: WP-0 → WP-3 → WP-6 → WP-13a (`0.1.0-rc.N`, which the
CISP's WP-9 `web/` scaffold starts on) → WP-13 (`v0.1.0`, which C-M1
waits for); then WP-7 → WP-11 → WP-14. The rc publish is the external
leg of demo 1 and nothing else gates it. WP-0 is small and reviewed
first. WP-3 starts the day WP-0's PR opens, against the frozen `model`
types; WP-6 and WP-7 start against WP-3's signatures of §3.6 the day its
PR opens and rebase when it merges.

Cross-WP conflicts are avoided by exclusive directory ownership. Shared
files: `CHANGELOG.md` (one line per WP under Unreleased, in the WP's last
commit), `docs/api/uspace-ui.api.md` (regenerated, so conflicts resolve
by re-running the tool), the two catalogues `src/i18n/ka.ts` and
`src/i18n/en.ts` (each WP adds a block under a comment with its WP id;
the parity test catches a lost key in a merge), and `browser/golden/`
(each WP adds its own entries and snapshots).

Milestones: U-M0 scaffold merged; `v0.1.0-rc.1` released (WP-13a);
**U-M1** = `v0.1.0` with C-M1 (`07`);
U-M2 = `v0.2.0` with A-M1/A-M2 and S-M1; U-M3 = `v0.3.0` with S-M2/S-M3
and N-M1; U-M4 = `v1.0.0`.

---

## 14. Spec gaps and open questions for the owner

The cross-plan reconciliation of 2026-10-02 decided every row that a
coordinator could decide (marked **decided**, with the mismatch id
`M-nn` it applies). Two rows need the owner (Q7, Q11; the owner decided Q1 on 2026-10-02): they stay
**open** and carry the default the plan applies until the owner answers;
the default is a proposal, not the answer.

| # | Gap | Resolution in this plan | Status |
|---|---|---|---|
| Q1 | Registry: "npm or GitHub Packages". GitHub Packages needs a token to *install* even a public package (every `web/` CI, every Docker build, every developer machine); npmjs needs the `@rootxkit` scope and supports OIDC trusted publishing with provenance, so no secret is stored anywhere. | D10 as changed by the owner on 2026-10-02: neither registry; GitHub Release tarballs pinned by URL and lockfile integrity, because the npm account and scope are not available. npmjs with trusted publishing stays a switched-off path (`docs/RELEASING.md`). | **Decided by the owner** (2026-10-02): GitHub Release tarballs. Reopens only if the owner sets up the `@rootxkit` npm scope and trusted publishing and asks for the switch. |
| Q2 | The spec fixes no error body for the national APIs. The form kit needs a field-addressed error and `uspace-core` already names the field and reason (`core.FieldError`, `ed269.Problems` with a JSON path). | `model.Problem`: RFC 9457 `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`, `errors: [{field, reason}]`, `truncated?`; `field` is the JSON path as core writes it; `type` = `https://schemas.uspace.ge/problems/<slug>`. The kit degrades to "request failed, status N" for anything else. | **Decided** (M28): adopted by all four systems; `problem/v1` lives in `uspace-lab/schemas/common/`. |
| Q3 | Zone applicability on a console: the kit must dim a zone that does not apply now (`limitedApplicability`), but evaluating applicability is a judgement (`ed269.Applies`, T-09) and must not run in TypeScript. `02 F3` offers `GET /v1/{dataset}?at=` which returns only the applicable features. | `ZoneView.applies` is `boolean | null` and the kit dims only on `false`. The CISP read API and the authority's `GET /v1/zones/export` add `?applies_at=<RFC 3339>`, which annotates every feature with `extendedProperties.cis_applicability` ∈ `applies` / `not_applicable` / `unknown` without filtering (the filtering `?at=` stays). The app maps it onto `applies`; no double fetch. | **Decided** (M17): additive on both APIs. |
| Q4 | Who builds and hosts the basemap bundle (PMTiles extract of Georgia, Protomaps glyphs *including Georgian ranges* for the fontstack, sprites), how big it is (the predecessor's was hundreds of MB) and how it is refreshed. The kit assumes the `/basemap/` layout of §6.3. | The lab builds it (lab WP-L3) from the predecessor's `infra/basemap/fetch_basemap.sh` as a release artefact with `SOURCE.json` and a size budget: a Georgia-wide extract with city-level zooms for Tbilisi, Kutaisi, Batumi and Poti and `z ≤ 12` elsewhere, under about 1 GB. The deployment repo (`uspace-deploy`) serves `/basemap/*` from one shared read-only volume on every host (Caddy `file_server`, range requests, long cache headers; one copy for five systems). The kit's `fonts.mapFontstack` names the glyph set. The browser tests use a tiny Tbilisi-only extract committed under `browser/public/basemap/` (a few MB) so they render offline. | **Decided** (M38). The droplet's disk is part of the sizing question the reconciliation leaves to the owner (its §2.1, "droplet sizing"). |
| Q5 | No browser-facing WS frame is specified; `02 §3` names the endpoints and `04 §2` the envelope. Four systems could invent four stream shapes. | §6.3's console frame (`console/status/v1`, `console/snapshot/v1`, `console/subscribe/v1`, plus the catalogued messages as bodies) on every browser-facing WebSocket of the four systems; the CISP's `resync` becomes a status frame with `resync_since`, the ANSP's `feed/status/v1` is retired for `console/status/v1`, the authority's `{viewport}` becomes `console/subscribe/v1`. Machine-facing streams carry the same envelope. The schemas are owned by `uspace-lab/schemas/common/`. | **Decided** (M29, M12, M14): adopted by all four systems. |
| Q6 | Display thresholds (`stale_after_s`, `live_max_age_s`) are policy rows per system (`04 §3.3`); the kit refuses to default them (INV-03) and must get them from the API. | The status frame of §6.3 carries them (`policy_version`, `stale_after_s`, `live_max_age_s`) on connect and every 2 s. Until a system sends them, its console cannot colour age, and the age chip shows the raw seconds without a bucket (visible, not wrong). | **Decided** (M29): thresholds come in `console/status/v1`. |
| Q7 | Visual regression without a hosted service (cost, secret) means no pixel diff of the map. | D9: component tests in a real browser, `axe`, DOM snapshots of a golden set as the reviewed reference; symbology tested as expressions. If the owner wants pixel diffs later, Playwright `toHaveScreenshot` on the golden set with committed PNGs can be added without a service, accepting Linux-only rendering. | **Open, owner-only** (spending money on pixel snapshots is the owner's). Default until answered: accept D9. |
| Q8 | Which font: Noto Sans Georgian alone has no Latin; a single family with both is Noto Sans (no Georgian) plus Noto Sans Georgian. Mtavruli (U+1C90) is required for upper-case Georgian since Unicode 11. | D7: both families bundled, `unicode-range` split, the glyph test covers all four Georgian blocks. Alternative families (BPG, Sylfaen) have licence or coverage problems for a public repo. | **Decided** (M38): Noto Sans + Noto Sans Georgian, OFL, bundled, loaded by every `web/` through `next/font/local`. |
| Q9 | The console session JWT's claim names for display gating are not fixed by the spec (`00 §6.2` fixes `iss`, `aud`, `sub`, `scope`, `exp`, `jti`, `kid`). | One session shape in every system (§6.3 contract): `scope = "session"`, `roles: [string]`, `realm` (`console` / `police` / `portal`), `aud` = the system's own host, `jti` = session id, `exp` ≤ 12 h. `sessionClaimsUnverified` reads `sub`, `exp`, `roles[]`, `realm`; `RequireRole` intersects `roles`. The kit gates display only. | **Decided** (M20, M21): the authority's role model is the largest, so `roles` is always an array. |
| Q10 | Branding config bundle shape (`06 §4` says it exists outside the repo; nothing names its keys). | §6.3's five `UI_BRAND_*` variables and a static `/brand/` directory for the logo; a missing name renders the role ("U-space authority"), never an organisation. | **Decided**: as proposed (branding is configuration, `06 §4`). |
| Q11 | Accessibility obligations for Georgian public interfaces (`08` Q15) are unanswered. | WCAG 2.2 AA is the target and `axe` gates CI; the public map and the registry check page are the first to be audited by hand (WP-13). | **Open, owner-only** (the ministry answers spec Q15). Default until answered: WCAG 2.2 AA, `axe` gates CI, hand audit in WP-13. The target is configuration marked "pending GCAA" (`examples/next-app/config/example.json`). WP-13 audited the example's public map, sign-in and role-gated pages on 2026-10-04 (`docs/ACCESSIBILITY.md`); the registry check page is a system's page and is audited by the system that ships it. |
| Q12 | Next.js and React majors at implementation time (this plan says `next >=15`, `react ^19` from the stack decisions); vitest browser mode versions move quickly. | WP-0 pins what is current on its day, records the versions in `CHANGELOG.md`, and the peers stay ranges. Nothing in this plan depends on a feature newer than Next.js App Router, React 19 and Tailwind v4. | **Decided**: WP-0 verifies, does not assume. |
| Q13 | Tailwind v4 `@source` scanning of a compiled package versus a prebuilt stylesheet. | D4: `@source` (one theme, tree-shaken utilities); the example app proves it. A prebuilt `uspace-ui.css` can be added as an additive export for a non-Tailwind consumer (the lab dashboard?) without changing anything else. | **Decided**: `@source`; a prebuilt stylesheet only if a non-Tailwind consumer appears. |
| Q14 | Should the kit ship the OpenAPI → TypeScript generation (`openapi-typescript`) as a CLI so all five `web/` generate identically, and check the output is committed and current? | WP-4 ships `uspace-ui-gen-api <openapi.yaml> <out.d.ts>` (a thin wrapper that pins the generator version and writes a header the `noHandWrittenApiTypes` rule recognises) and a CI snippet each `web/` copies. | **Decided**: every `web/` uses it. |
| Q15 | Acknowledgement persistence: `02 F5` records acknowledgements at the USSP (`POST /v1/alerts/{id}/ack`); the authority's violations have review, not acks; the predecessor's console ack was per console and not recorded (P6-07). | The kit's `acknowledged` flag is per console and the `onAcknowledge` callback is the app's to persist; `AlertToaster` silences the tone on the local flag so an operator is never left with a tone they cannot stop while the API is down (B-10 thinking). | **Decided**: as proposed. |
| Q16 | `uspace-lab/schemas/` and `uspace-lab/api/` (KT-2) do not exist at `uspace-lab@2b98ee8`, so the schema-example conformance hook cannot be wired now. | Synthetic fixtures until then; WP-14 wires the examples and pins the lab commit in `docs/LAB_VERSION`; the enumeration check against `uspace-core` source runs from WP-0. | **Decided** (M31, lab WP-L1 `contracts-aggregate` starts day 1 with `schemas/common/`): synthetic fixtures until it lands; the kit's `v1.0.0` waits for it. |
| Q17 | Public display of network identification (`09`, unverified items: F3411 public-display obfuscation rules) is unverified in the spec; if a public flight map is ever built on the kit, obfuscation is a server rule. | The kit renders what it is given; no public-map-specific component is planned. Recorded so that nobody adds client-side rounding as "privacy". | **Decided**: a server rule; no client-side obfuscation. |
| Q18 | `IdentBasis` gained `provider` (reconciliation Q-A8: a Display Provider flight is a peer's claim, neither authenticated nor broadcast). Core ships `BasisProvider` in v1.1.0; the authority sends `as_broadcast` until then. | `model.IdentBasis` carries `provider` from WP-0 so the symbology's exhaustive switches and the R-05 wording cover it before any API sends it; the `provider` caveat wording ("reported by a provider, unverified") is in both catalogues; the enum check against core passes once v1.1.0 is in `docs/CORE_VERSION` and is a visible skip before. | **Decided** (Q-A8): additive. |
| Q19 | Alert `detail` names differ between spec `04 §3.3` and uspace-core v1.3.0 (`d_cpa_h_m`/`d_alt_m` vs `d_cpa_horizontal_m`/`d_alt_at_cpa_m`; `zone_id` vs `identifier`, no `zone_type`), `lost_link` has no named field in the spec, `restriction_activated` names `authorisation_updated` / `withdrawn` without saying whether they are flags, and the spec names no field for a clear's own numbers (C-14). | WP-11 reads the spec's name first and core's when the spec's is absent; `lost_link` reads `silence_s` (the USSP's conformance monitor); `authorisation_updated` and `authorisation_withdrawn` (or `withdrawn`) as booleans; a clear reads only `clearing_<key>` (core `clearingDetail`, the USSP's `clearEvent`), so a clear never shows the raise's numbers, and a number nobody sent is a dash. | **Open**: `alert/v1` in `uspace-lab/schemas/` should fix the names; the summaries follow it. |
| Q20 | Three fields the traffic layers need are not in the frozen view models (§3.1): `MannedView` has no `trust` although `04 §2` puts a trust class on every track-like message and `02 F4` distinguishes `surveillance` (ANSP) from `broadcast` (own e-conspicuity receiver), and no `anomaly` (LESSONS I-04); `IntentView` has no way to say an intent is another USSP's seen through the DSS (`02 F6` peer flights as `provider`), and its `volumes` are typed `Polygon[]` while a derived volume can be a MultiPolygon. | WP-12 adds them as optional input fields without touching `model`: `MannedTrack = MannedView & { trust?, anomaly? }` (symbology), `IntentInput` with `volumes: (Polygon \| MultiPolygon)[]` and `peer?` (layers). A manned track with no trust class is drawn and labelled as broadcast and unverified, never as surveillance (never upgrade); an intent without `peer` is drawn as the USSP's own. | **Open**: `track/manned/v1` and `intent/state/v1` in `uspace-lab/schemas/` should name `trust`, `anomaly` and the peer flag; `model` adopts them at the next major. |

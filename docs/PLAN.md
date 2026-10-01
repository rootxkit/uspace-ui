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

Sections: 1 scope, role boundary and decisions; 2 package layout and
dependency graph; 3 public API per entry point; 4 third-party dependencies;
5 lessons and spec rules per package; 6 data, bus and the published
contract; 7 security; 8 performance budgets; 9 testing strategy; 10 CI;
11 consumption and deployment; 12 versioning and release; 13 milestones,
work packages and waves; 14 spec gaps and open questions.

---

## 1. Scope, role boundary and decisions

`uspace-ui` is an npm package, `@rootxkit/uspace-ui`, consumed at build
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
| D9 | Visual testing is Storybook 9 with stories run as tests in vitest browser mode (Playwright Chromium), `axe` on every story, DOM snapshots of a named golden set, and a static Storybook published to GitHub Pages from `main`. No hosted visual-diff service. | CI-cheap on a public repo: Pages and Actions are free; a paid snapshot service is a recurring cost and a secret. Map pixels are not snapshotted (WebGL in CI is noise); the style expressions the symbology produces are tested instead (§9). |
| D10 | Published to the public npm registry under the `@rootxkit` scope with provenance, from a tag workflow using OIDC trusted publishing (no long-lived token in secrets). GitHub Packages is the fallback (§14 Q1). | Consumers (`web/` CI, Docker builds, the owner's machines) install without a token; provenance ties each version to a commit and a workflow run (`06 §4` supply chain). |
| D11 | The kit ships its ESLint flat config (`/eslint`) with the rules the spec requires of every `web/`: no geometry or geodesy imports, no database or bus client imports, no business logic in route handlers, no hand-written API types in the generated directory. | `00 §6` ("a Next.js file importing geometry or geodesy libraries fails lint"), `07` KT-3 ("no-geometry-import and no-server-side-business-logic rules"). Writing the rule once here is how five apps get it the same. |
| D12 | The first tag `v0.1.0` is U-M1 (with C-M1); `v1.0.0` follows the first two consoles in production use of the track and alert components (the authority's A-M2 picture and the USSP's S-M2 console), when §3's API is declared stable. | Spec `07`. A kit's API is proven by its second consumer, not its first. |

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
│   ├── table/        accessible data table kit (WP-9)                      deps: ui, i18n
│   ├── form/         form kit with field errors and units (WP-10)          deps: ui, i18n, api
│   ├── eslint/       the flat config every web/ extends (WP-0)             deps: eslint (peer)
│   └── test/         render helpers, fixtures from the lab's schema examples (WP-0, WP-14)
├── bin/              uspace-ui-gen-api (WP-4)
├── fonts/            woff2 files (WP-2)
├── styles/           tokens.css, map.css (WP-1, WP-3)
├── stories/          Storybook stories per package (each WP)
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
the single root; `test` is imported by tests and stories only.

```
model <- theme <- ui, map, symbology
model <- i18n <- map, legend, status, alerts, table, form
model <- api <- live, form
map <- layers ;  symbology <- layers, legend, alerts
live <- status, alerts
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
`fonts` and `auth/*`, so Storybook and vitest run without Next.js.

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
export type IdentBasis = "authenticated" | "as_broadcast";
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
export interface Problem { type: string; title: string; status: number; detail: string | null; instance: string | null; errors: FieldError[] }   // §14 Q2
```

### 3.2 `theme` (WP-1)

```ts
export interface Brand { name: string; shortName: string; logoUrl: string | null; contact: string | null; accent: string | null }   // from configuration (06 §4); never a default naming an organisation
export function brandFromEnv(env: Record<string, string | undefined>, prefix?: string): Brand   // UI_BRAND_NAME, UI_BRAND_SHORT_NAME, UI_BRAND_LOGO_URL, UI_BRAND_CONTACT, UI_BRAND_ACCENT; missing name -> "U-space" (the role, not an organisation)
export type ColorScheme = "light" | "dark" | "system";
export function ThemeProvider(props: { brand: Brand; scheme?: ColorScheme; children }): JSX.Element   // sets data-theme and the brand CSS variables
export function useTheme(): { scheme: ColorScheme; resolved: "light" | "dark"; setScheme(s: ColorScheme): void; brand: Brand }
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
export interface Freshness { etag: string | null; version: string | null; updatedAt: string | null; ageS: number | null; stale: boolean }   // from ETag, metadata.updateDateTime, cis_version, cis_age_s and `stale` markers (02 F3, F5 geo-awareness) as headers or body fields the app points at
export function freshnessOf(res: Response, body: unknown, pick?: FreshnessPick): Freshness
export function fieldErrorsOf(err: unknown): FieldError[]   // [] when not a Problem
```

The kit never retries a non-idempotent request (utm "What not to do").
A `503` with `Retry-After` is surfaced as `retryAfterS` (B-10) and the
status components render it as "refused, retry in N s", not as an error
of the console.

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
export function MannedLayer(props: { tracks: Iterable<MannedView>; staleAfterS: number; nowMs: number; visible?: boolean }): null
export function AlertLayer(props: { alerts: Iterable<AlertView>; tracks: ReadonlyMap<string, TrackView>; visible?: boolean }): null   // proximity: a line between the two aircraft coloured by severity; zone_incursion / height: a ring on the aircraft; nothing for cleared
export function IntentLayer(props: { intents: IntentView[]; nowIso: string; selectedId?: string | null; visible?: boolean }): null   // footprints; current volume (time window contains now, as the app computed `active` or as timeStart/timeEnd compared on the browser clock for display only) emphasised
export function RestrictionLayer(props: { restrictions: ZoneView[]; visible?: boolean }): null   // ED-318 features with reason DAR, styled by restrictionState (02 F2)
export function ReceiverLayer(props: { receivers: { id: string; lat: number; lng: number; state: SourceState }[] }): null   // authority: receiver positions and state
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
export interface FeedOptions { url: string | (() => Promise<string>); protocols?: string[]; backoff?: { initialMs: number; maxMs: number; factor: number }; onFrame(frame: ConsoleFrame): void; now?: () => number }
export interface ConsoleFrame { schema: string; msgId: string; ts: string | null; rxTs: string; capturedAt: string | null; backlog: boolean; body: unknown }   // the common envelope of 04 §2 plus `body`; §6.3 names the frames
export function useFeed(opts: FeedOptions): FeedStatus   // reconnects forever (B-08); status frames update droppedFrames, degraded, policyVersion, staleAfterS; close code 4401 -> re-fetch url (a ticket) then reconnect; never gives up, never throws
export function createTrackStore(opts: { trailPoints: number; maxTracks: number }): TrackStore   // bounded (E-10): oldest evicted and counted; receivedAtMs stamped on insert
export interface TrackStore { upsert(t: Omit<TrackView, "receivedAtMs">): void; remove(id: string, reason: ClearReason | "source_disabled"): void; get(id): TrackView | undefined; snapshot(): ReadonlyMap<string, TrackView>; subscribe(fn): () => void; counters(): Readonly<Record<string, number>> }
export function createAlertStore(): AlertStore    // raised/updated replace by alertId; cleared keeps the alert for `clearedHoldMs` with its clear numbers and reason (C-14), then drops it; acknowledged flag per console (not recorded; recording is the app's POST)
export function createSourceStore(): SourceStore  // per (type, instance) SourceView from status frames; `disabled` beats every other state (B-11)
export function useStore<T>(store: { subscribe; snapshot }): T   // useSyncExternalStore
export function ageS(t: { receivedAtMs: number } | { times: Times }, nowMs: number, by?: "received" | "captured"): number | null   // display age; captured age needs the server's clock offset from the status frame, else null
```

### 3.12 `status` (WP-8)

```ts
export function FeedStatusBar(props: { status: FeedStatus; nowMs: number }): JSX.Element   // "live", "connecting…", "feed down — retrying, last frame N s ago"; dropped_frames and degraded[] visible (05 §5, §6); never says "lost" (C-12)
export function SourceStateBadge(props: { source: SourceView; nowMs: number }): JSX.Element   // disabled by <who> | healthy | stale since | lagging, behind N s, nothing lost | unreachable, data buffered at the source | never heard
export function SourcesPanel(props: { sources: SourceView[]; nowMs: number; onSwitch?(s: SourceView, enabled: boolean, reason: string): void; canSwitch: boolean }): JSX.Element   // the switch is a confirm dialog with a mandatory reason; the kit only calls back
export function DegradedBanner(props: { degraded: string[]; cisAgeS?: number | null; cisStaleBoundS?: number | null }): JSX.Element   // "manned traffic unavailable since", "DSS unavailable", "CIS data N s old" — from the API's words, labelled by key
export function AgeChip(props: { ageS: number | null; staleAfterS: number }): JSX.Element
export function FrozenOverlay(props: { status: FeedStatus; nowMs: number }): JSX.Element   // when the feed is down: the picture stays, dimmed, with "showing data as of" and the age (05 §6)
```

### 3.13 `alerts` (WP-11)

```ts
export function AlertList(props: { alerts: AlertView[]; tracks?: ReadonlyMap<string, TrackView>; nowMs: number; onAcknowledge?(a: AlertView): void; canAcknowledge: boolean; onSelect?(a: AlertView): void }): JSX.Element   // sorted critical first then raisedAt; a cleared alert shows its clear reason and numbers for the hold period
export function AlertSummary(props: { alert: AlertView; lang: Lang }): string    // the one-line text per kind from `detail`, with units and datums (E-13); never a loss claim (C-12); "as broadcast and unverified" when a party is broadcast
export function AlertToaster(props: { alerts: AlertView[]; critical?: { tone: boolean; repeatMs: number } }): JSX.Element   // a tone while an unacknowledged critical alert exists; the repeat period is a prop from policy (02 F5: every 10 s is the server's number)
export function useAlertTone(enabled: boolean): void   // Web Audio; starts only after a user gesture (browser rule); no audio file
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
export function bffHandlers(opts): { login: RouteHandler; logout: RouteHandler; proxy: RouteHandler; wsTicket: RouteHandler }   // the four routes every web/ mounts under /_bff/* (02 §3); login POSTs the credentials to the API's login endpoint over the server side and sets the cookie; the browser never sees the JWT
export function sessionClaimsUnverified(jwt: string): { sub: string | null; role: string | null; realm: string | null; exp: number | null } | null   // display only (which menu to show); authorisation is the API's; the name says so
```

Client:

```ts
export function SessionProvider(props: { session: { sub: string; role: string; realm: string | null; exp: number } | null; children }): JSX.Element   // the server component reads the cookie, decodes for display, passes it down
export function useSession(): { session: ...; signOut(): Promise<void> }
export function LoginForm(props: { action: string; mfa?: boolean; onSuccess(): void }): JSX.Element   // POSTs to /_bff/login; the password field is never logged, never put in the URL, autocomplete per spec
export function RequireRole(props: { anyOf: string[]; children; fallback?: ReactNode }): JSX.Element   // display gating only
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
`noBusinessLogicInRoutes`: under `app/api/**` and `app/_bff/**`, only
imports from `@rootxkit/uspace-ui/auth/server`, `next/*` and the app's
own `lib/bff/*` are allowed. `noHandWrittenApiTypes`: under
`src/api/generated/**` only generated files (header check) may exist;
`interface`/`type` declarations elsewhere named like a schema component
are reported.

### 3.18 `test` (WP-0, WP-14)

```ts
export function renderWithKit(ui: ReactNode, opts?: { lang?: Lang; scheme?; brand?; now?: number }): RenderResult   // providers wired; fake timers friendly
export function fixtures(): { tracks: TrackView[]; zones: ZoneView[]; alerts: AlertView[]; manned: MannedView[]; sources: SourceView[]; status: FeedStatus }   // deterministic, synthetic (GEO-TEST-* numbers, TEST* serials, 06 §4), covering every enumeration value at least once; WP-14 replaces the generator's inputs with the lab's schema examples
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
| `next` (peer `>=15`, optional) | `fonts`, `auth/*` | `next/font/local`, `NextRequest`/`NextResponse`. Optional peer so Storybook and vitest run without it. Verify the current major at WP-0 time, not from memory (§14 Q12). |
| `maplibre-gl` (peer `^5`) | `map`, `layers` | The map (`00 §6`). Peer, so the app controls one copy. |
| `pmtiles`, `@protomaps/basemaps` | `map` | D6: the self-hosted basemap protocol and the style layers the predecessor already used (P1-12). |
| `tailwindcss` (peer `^4`) | styles | D4. The app runs Tailwind; the kit ships tokens and source classes. |
| `radix-ui` (the unified package), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `cmdk` | `ui` | What the vendored shadcn/ui components import. Accepted as the cost of shadcn/ui (D5). |
| `openapi-fetch` | `api` | The typed fetch companion of `openapi-typescript` (`00 §6.2`): the generated `paths` type gives typed requests and responses with a 6 kB runtime. |
| `@tanstack/react-table` | `table` | Headless table with sorting, filtering, pagination and virtualisation hooks; the accessible markup is ours. |
| `@tanstack/react-virtual` | `table` | Row virtualisation above 200 rows (§8). |
| `react-hook-form`, `zod`, `@hookform/resolvers` | `form` | Form state and schema validation; `zod` schemas are the app's, the kit maps errors. |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` (peers of `/eslint`) | `eslint` | D11. |
| dev: `typescript`, `vitest`, `@vitest/browser`, `playwright`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `storybook`, `@storybook/react-vite`, `@storybook/addon-a11y`, `@storybook/addon-vitest`, `axe-core`, `prettier`, `publint`, `@arethetypeswrong/cli`, `@microsoft/api-extractor`, `fontkit`, `openapi-typescript` | tests, build, release | §9, §10, §12. `fontkit` reads the font `cmap` for D7. `api-extractor` writes the API report the semver gate diffs (§12). |

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
`/v1/traffic`, `/v1/stream`, `/v1/manned-traffic/stream`), over the BFF
ticket route.

### 6.3 Contracts this package publishes

| Contract | Where | Consumers |
|---|---|---|
| The package API of §3 and the `exports` map of §2 | `docs/api/uspace-ui.api.md` (api-extractor report, committed) | every `web/` |
| The view-model enumerations, mirroring `uspace-core/core` | `model/` | every `web/` adapter; the lab's schema examples test |
| The console frame | below | every system's WS process and the kit's `live` |
| The BFF route set `/_bff/login`, `/_bff/logout`, `/_bff/api/*`, `/_bff/ws-ticket`, cookie names `uspace_session` (HttpOnly, SameSite=Strict, Secure) and `uspace_csrf`, header `X-CSRF-Token` | `auth/server` | every `web/`; the Caddy config in each deploy |
| The basemap bundle layout `/basemap/basemap.pmtiles`, `/basemap/SOURCE.json` (`bounds`, `osm_data_as_of`), `/basemap/fonts/{fontstack}/{range}.pbf`, `/basemap/sprites/v4/{light,dark}.*` and the fontstack name | `map`, `fonts` | the lab's basemap build; each compose and Caddy |
| Branding variables `UI_BRAND_NAME`, `UI_BRAND_SHORT_NAME`, `UI_BRAND_LOGO_URL`, `UI_BRAND_CONTACT`, `UI_BRAND_ACCENT`; language cookie `uspace_lang` and `Accept-Language` negotiation | `theme`, `i18n` | each deploy's config bundle (`06 §4`) |
| The lint rules of §3.17 | `eslint` | every `web/` CI |

**The console frame** (proposed; §14 Q5 asks the four system planners
to adopt it so one `live` client serves every console). Every WebSocket
message from a system to a console is one JSON object carrying the
common envelope of `04 §2` (`schema`, `msg_id`, `producer`, `ts`,
`rx_ts`, `captured_at`, `time_source`, `backlog`) and a `body` whose
shape is named by `schema`. Frames the kit understands by `schema`:

| `schema` | Body | Kit behaviour |
|---|---|---|
| `console/status/v1` | `{connection_id, server_ts, policy_version, stale_after_s, live_max_age_s, dropped_frames, degraded[], sources[]}` sent on connect and every 2 s (`04 §3.6` `source/status/v1` cadence) | `FeedStatus`; thresholds for the age buckets; `SourceView`s; server clock offset for captured-age display |
| `console/snapshot/v1` | `{tracks[], alerts[], manned[]}` on connect and on re-subscribe (C-08 replay) | stores replaced, not merged; a track absent from the snapshot is dropped as `resolved` |
| `track/telemetry/v1`, `track/manned/v1` | per `04 §3.1` | app adapter to `TrackView` / `MannedView`; `backlog: true` goes to the trail, never to the live position |
| `alert/v1`, `violation/v1` | per `04 §3.3` | app adapter to `AlertView`; `state` drives raise/update/clear |
| `cis/change/v1` | per `04 §3.4` | the app refetches the dataset; the kit shows "zones updated to version V at T" |
| anything else | — | passed to `onFrame` untouched, counted as `frames_unhandled` |

Subscription control from the client is one frame
`{schema: "console/subscribe/v1", body: {bbox, layers[]}}` sent on open
and whenever `useBBoxSubscription` fires; the server answers with a
snapshot. A system that cannot adopt this shape wraps its stream in its
own adapter and still gets the stores and the status components; what it
loses is the shared status frame, which is why the question is asked.

### 6.4 Contracts this package depends on

| From | What | Status |
|---|---|---|
| each system repo | `api/openapi.yaml` (OpenAPI 3.1), from which the app generates `paths` with `openapi-typescript` and passes it to `createClient<Paths>` | the kit never reads a system's spec; it ships the generator wrapper so every app generates the same way (WP-4) |
| `uspace-lab/schemas/` (KT-2) | JSON Schemas and examples of `track/telemetry/v1`, `track/manned/v1`, `alert/v1`, `violation/v1`, `cis/change/v1`, `source/status/v1` | **does not exist yet** at `uspace-lab@2b98ee8`; WP-14 wires the examples into `test/fixtures` when it does; until then the fixtures are synthetic and the enumerations are pinned to spec text |
| `uspace-core` | the string values of `core` enumerations (`Trust`, `Severity`, `ZoneType`, `IdentStatus`, `IdentReason`, `IdentBasis`, `AltSource`, `VerticalRef`, `TimeSource`), `core.FieldError` shape, `ed318` field names | mirrored by hand in `model/` with a test; a divergence is a kit bug |
| the lab | the basemap bundle (D6) | predecessor `utm/infra/basemap/fetch_basemap.sh` is the reference; §14 Q4 |
| the authority | the session JWT the console login returns (claims `sub`, `role`, `realm`, `exp`) for display gating | `00 §6.2`; the kit decodes without verifying and says so in the function name |
| every API | an error body the form kit can map: `application/problem+json` with `errors: [{field, reason}]` | §14 Q2 |
| every WS process | the console frame of §6.3 | §14 Q5 |
| every API that serves a picture or a feed | the display thresholds (`stale_after_s`, `live_max_age_s`) in the status frame or a `GET /v1/policy` the app reads | §14 Q6 |

---

## 7. Security

| Rule | Mechanism |
|---|---|
| No credential in browser JavaScript (`06 §3`) | `LoginForm` posts to `/_bff/login`; the session JWT lives in an `HttpOnly` cookie; `auth/client` never sees it; `sessionClaimsUnverified` runs server side on the cookie and passes a display struct down. `gitleaks` in CI. |
| CSRF | double-submit token on every unsafe BFF call; `createClient` adds the header; `checkCsrf` refuses without it. |
| The BFF is a proxy with an allow-list | `forward()` refuses paths outside `allowPaths`, strips cookies, never follows redirects, bounds the timeout, passes `Retry-After` through. |
| No PII in URLs (safety rules of this project; `06 §5`) | `useTableUrlState` and every link helper refuse keys named like identity fields (`name`, `email`, `phone`, `address`, `registration_number` secret part) — a test pins the list. |
| No judgement in TypeScript (`06` T12) | the `/eslint` rules, applied to the kit itself in its own CI. |
| Supply chain (`06 §4`) | exact pins, `pnpm install --frozen-lockfile`, Dependabot, `pnpm audit` as a non-gating report, provenance on publish (D10), `SECURITY.md` with a 90-day policy. |
| Content Security Policy | the kit documents the CSP every `web/` sets (`connect-src 'self'` for API, WS and the basemap; `worker-src blob:` for MapLibre; `font-src 'self'`; no `unsafe-eval`) and `examples/next-app` ships it; a Storybook story loads under it. |
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
| Basemap first paint | ≤ 2 s on a 10 Mbit link for a city view (PMTiles range requests, tiles cached by the browser) | Storybook story with the lab's bundle, measured by hand at WP-3 and noted |
| Table | 10 000 rows virtualised scroll at 60 fps; sort of 10 000 rows ≤ 50 ms | benchmark |
| Fonts | ≤ 120 kB woff2 total for Latin + Georgian regular and bold subsets | CI test on file sizes |
| Reconnect | first retry at 1 s, factor 2, cap 30 s, jitter; forever (B-08) | test with fake timers |
| Accessibility | every story passes `axe` WCAG 2.2 AA; keyboard-only operation of map controls, table and alert list | CI |

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
| Browser | vitest browser mode (Playwright Chromium) via `@storybook/addon-vitest` | every story renders without error, `axe` passes, interaction tests in stories (`play`), DOM snapshots of the golden set (`stories/golden/*`): legends, status bar in each state, alert list, a table page, a form with field errors, the login form; MapLibre stories render with `--use-gl=angle --use-angle=swiftshader` for smoke only (no pixel snapshot, D9) |
| Benchmarks | vitest `bench` in browser mode | the §8 rows; reported, not gated |
| Fonts | vitest + `fontkit` | every Georgian block covered (D7); size budget |
| Package | `publint`, `@arethetypeswrong/cli`, `api-extractor` | `exports` resolve for `node16`/`bundler`, types ship, no `any` in the public API, the API report is up to date |
| Consumer | `examples/next-app` built with `next build` in CI (`output: standalone`), lint with `/eslint`, `openapi-typescript` run on a tiny fixture spec and `createClient<Paths>` type-checked | the integration a `web/` will do; also the CSP story |
| Conformance hooks (lab) | `test/fixtures` from `uspace-lab/schemas/` examples (WP-14); `model` enums against `uspace-core/core` by a script that reads the Go source at a pinned tag (`scripts/check-enums.sh`, online, best-effort on PRs, required on `main`, like core's vector check) | `04 §4`: schema examples pass everywhere; a kit that cannot render a value the bus can carry fails here |

"Integration with a real Postgres/NATS in CI" from the template does not
apply (§1.1); the integration surface is the consumer app and the WS
frame, both exercised above with a mock WS server (`live` tests run
against an in-process `ws` server that replays recorded frame sequences,
including a 4401 ticket expiry, a 60 s silence and a `backlog` burst).

Coverage: a work package is done at ≥ 90 % statement coverage of its
entry points, with every branch that produces a distinct wording or a
distinct visual state covered by a named test.

---

## 10. CI workflow

`.github/workflows/ci.yml` (written by WP-0; it does not exist on
`plan/initial` because there is nothing to run yet, and a workflow that
is green over nothing is the kind of success path this project has been
bitten by). Jobs on push to `main`, tags `v*` and pull requests;
`ubuntu-latest`; Node 22 from `.nvmrc`; pnpm from `packageManager`;
`concurrency: ci-${{ github.ref }}` with cancel-in-progress; every job
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
   (stories as tests, `axe`, golden DOM snapshots); `storybook build` to
   `storybook-static/` uploaded as an artifact on PRs.
4. `fonts`: the glyph coverage and size tests (fast; separate so a font
   change shows its own job).
5. `example`: `examples/next-app` with `next build`, its lint, and the
   generated-types check (`openapi-typescript` output committed and
   diffed).
6. `gitleaks` (`06 §4`).
7. `enums` (`main` only, required; best-effort on PRs): `scripts/check-enums.sh`
   against `uspace-core` at the tag in `docs/CORE_VERSION`.

`.github/workflows/pages.yml`: on push to `main`, path-filtered to
`src/**`, `stories/**`, `styles/**`, `fonts/**`: `storybook build` and
deploy to GitHub Pages (`actions/deploy-pages`). This is the living
visual reference (D9).

`.github/workflows/release.yml`: on tag `v*`: the `check`, `test`,
`browser` and `fonts` jobs again on the tag, then `pnpm publish
--provenance --access public` with `id-token: write` (D10), then a
GitHub release with the CHANGELOG section. The tag must equal
`package.json` `version` or the job fails before publishing.

Branch protection on `main` requires jobs 1–6.

Caches: pnpm store (`actions/setup-node` with `cache: pnpm`), Playwright
browsers, Next.js build cache for the example. No Docker in this repo.

---

## 11. Consumption and deployment

The kit is not deployed. Each system's `web/` consumes it:

```jsonc
// web/package.json
"dependencies": { "@rootxkit/uspace-ui": "0.3.1", "maplibre-gl": "5.x", "next": "...", "react": "19.x", "react-dom": "19.x" }
```

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

Upgrade policy for consumers: a `web/` pins an exact version and bumps
it in its own PR, running its own lint, build and the kit's example
stories against its adapters. Two majors of the kit are maintained for
six months (§12), so a system is never forced to upgrade in step with
another.

Images: each system's CI builds its `web/` with `next build` (`output:
standalone`) into that system's image; the droplet never builds Next.js
("Never build Next.js on the server"). The kit adds nothing to runtime
memory beyond its JS; the 3.8 GB droplet constraint is the systems'
concern and the kit's bundle budget (§8) is its contribution.

Storybook is served at `https://rootxkit.github.io/uspace-ui/` from
`main` (D9), the only hosted artefact of this repo.

---

## 12. Versioning and release

- `v0.1.0` = U-M1 (`07`): theme and tokens, `ui`, `i18n` with the font,
  `map` with the basemap, `ZoneLayer` and `ZoneLegend`, `auth/*`, `api`,
  `eslint`, the example app; the CISP public map and console build on it
  and nothing else. Tagged by the owner from `main`.
- `v0.2.0`: `live`, `status`, `TrackLayer`, `TrackLegend`,
  `IdentificationLegend`, `table`, `form` (the authority's A-M1/A-M2 and
  the USSP's S-M1 consoles).
- `v0.3.0`: `alerts`, `AlertLayer`, `MannedLayer`, `IntentLayer`,
  `RestrictionLayer`, `ReceiverLayer` (S-M2, S-M3, N-M1).
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
entry points; every story passes `axe`; every user-facing string in both
catalogues; the API report updated; a CHANGELOG line; the PR pastes the
outputs (E-04).

| WP | Slug | Owns (exclusively) | Depends on | Milestone |
|---|---|---|---|---|
| WP-0 | `scaffold` | `package.json`, tooling, `src/model/`, `src/eslint/`, `src/test/` (helpers), CI, Storybook config, `CLAUDE.md`, `SECURITY.md`, `CHANGELOG.md` | — | U-M0 |
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
| WP-13 | `release-0.1` | `examples/next-app/`, `README.md` consumer section, `release.yml`, `pages.yml`, first publish | WP-1..WP-6 | U-M1 (tag `v0.1.0`) |
| WP-14 | `v1-gate` | semver gate, `scripts/check-enums.sh`, lab schema fixtures, API report freeze, `v1.0.0` | WP-7..WP-13 | U-M4 (tag `v1.0.0`) |

Waves (what can run in parallel):

```
wave 0 (first, one agent):        WP-0
wave 1 (5 agents, after WP-0):    WP-1  WP-2  WP-3  WP-4  WP-5
wave 2 (after 1, 2, 3 / 2, 4):    WP-6 (needs 1, 2, 3)   WP-7 (needs 1, 2, 3)   WP-8 (needs 2, 4)   WP-9 (needs 1, 2)   WP-10 (needs 1, 2, 4)
wave 3 (after 6 and 5):           WP-13 -> tag v0.1.0 = U-M1 (with cisp C-M1)
wave 3 (after 7, 8 / 6, 7, 8):    WP-11 (needs 7, 8)     WP-12 (needs 6, 7, 8)   -> tag v0.2.0 / v0.3.0
wave 4:                           WP-14 -> tag v1.0.0 = U-M4
```

Critical path: WP-0 → WP-3 → WP-6 → WP-13 (v0.1.0, which C-M1 waits
for); then WP-7 → WP-11 → WP-14. WP-0 is small and reviewed first. WP-3
starts the day WP-0's PR opens, against the frozen `model` types; WP-6
and WP-7 start against WP-3's signatures of §3.6 the day its PR opens
and rebase when it merges.

Cross-WP conflicts are avoided by exclusive directory ownership. Shared
files: `CHANGELOG.md` (one line per WP under Unreleased, in the WP's last
commit), `docs/api/uspace-ui.api.md` (regenerated, so conflicts resolve
by re-running the tool), the two catalogues `src/i18n/ka.ts` and
`src/i18n/en.ts` (each WP adds a block under a comment with its WP id;
the parity test catches a lost key in a merge), and `stories/golden/`
(each WP adds its own files).

Milestones: U-M0 scaffold merged; **U-M1** = `v0.1.0` with C-M1 (`07`);
U-M2 = `v0.2.0` with A-M1/A-M2 and S-M1; U-M3 = `v0.3.0` with S-M2/S-M3
and N-M1; U-M4 = `v1.0.0`.

---

## 14. Spec gaps and open questions for the owner

| # | Gap | Resolution in this plan | Needs the owner? |
|---|---|---|---|
| Q1 | Registry: "npm or GitHub Packages". GitHub Packages needs a token to *install* even a public package (every `web/` CI, every Docker build, every developer machine); npmjs needs the `@rootxkit` scope and supports OIDC trusted publishing with provenance, so no secret is stored anywhere. | D10: npmjs with trusted publishing; `release.yml` is written for it. If the scope is not available or the owner prefers GitHub Packages, WP-13 switches the registry line and adds `NODE_AUTH_TOKEN` to every consumer's CI. | **Yes**: confirm the npm scope `@rootxkit` (or the name) and that the package is public. |
| Q2 | The spec fixes no error body for the national APIs. The form kit needs a field-addressed error and `uspace-core` already names the field and reason (`core.FieldError`, `ed269.Problems` with a JSON path). | `model.Problem`: RFC 9457 `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`, plus `errors: [{field, reason}]`; `field` is the JSON path as core writes it. Proposed to the four system planners; the kit degrades to "request failed, status N" for anything else. | **Yes**: adopt across the systems (one line in each plan's API section). |
| Q3 | Zone applicability on a console: the kit must dim a zone that does not apply now (`limitedApplicability`), but evaluating applicability is a judgement (`ed269.Applies`, T-09) and must not run in TypeScript. `02 F3` offers `GET /v1/{dataset}?at=` which returns only the applicable features. | `ZoneView.applies` is `boolean | null` and the kit dims only on `false`. The app either fetches twice (all, and `at=now`) and sets `applies` from the difference, or the CISP read API adds `applies_at` to each feature when `at=` is given. Proposed: the second, as an additive optional field in the CISP's OpenAPI; the authority's own zone API does the same. | **Yes**: the CISP and authority planners add the field, or the apps double-fetch. |
| Q4 | Who builds and hosts the basemap bundle (PMTiles extract of Georgia, Protomaps glyphs *including Georgian ranges* for the fontstack, sprites), how big it is (the predecessor's was hundreds of MB) and how it is refreshed. The kit assumes the `/basemap/` layout of §6.3. | The lab builds it from the predecessor's `infra/basemap/fetch_basemap.sh` as a release artefact with `SOURCE.json`; each system's compose mounts it read-only and Caddy serves it with range requests and long cache headers; the kit's `fonts.mapFontstack` names the glyph set. Storybook uses a tiny Tbilisi-only extract committed under `stories/basemap/` (a few MB) so stories render offline. | **Yes**: confirm the lab owns the bundle and the droplet has the disk (and whether a smaller extract is acceptable for the demo). |
| Q5 | No browser-facing WS frame is specified; `02 §3` names the endpoints and `04 §2` the envelope. Four systems could invent four stream shapes. | §6.3 proposes one console frame (`console/status/v1`, `console/snapshot/v1`, `console/subscribe/v1`, plus the catalogued messages as bodies). The `live` client is written to it; an adapter seam remains for a system that cannot comply. | **Yes**: the four system planners adopt the frame or name their deviation. |
| Q6 | Display thresholds (`stale_after_s`, `live_max_age_s`) are policy rows per system (`04 §3.3`); the kit refuses to default them (INV-03) and must get them from the API. | The status frame of §6.3 carries them; apps without the frame read a policy endpoint and pass them as props. Until a system provides them, its console cannot colour age, and the age chip shows the raw seconds without a bucket (visible, not wrong). | Covered by Q5. |
| Q7 | Visual regression without a hosted service (cost, secret) means no pixel diff of the map. | D9: stories as tests, `axe`, DOM snapshots of a golden set, Pages-hosted Storybook as the reviewed reference; symbology tested as expressions. If the owner wants pixel diffs later, Playwright `toHaveScreenshot` on the golden set with committed PNGs can be added without a service, accepting Linux-only rendering. | Decide: accept, or fund pixel snapshots. |
| Q8 | Which font: Noto Sans Georgian alone has no Latin; a single family with both is Noto Sans (no Georgian) plus Noto Sans Georgian. Mtavruli (U+1C90) is required for upper-case Georgian since Unicode 11. | D7: both families bundled, `unicode-range` split, the glyph test covers all four Georgian blocks. Alternative families (BPG, Sylfaen) have licence or coverage problems for a public repo. | Confirm Noto; otherwise name the family and its licence. |
| Q9 | The console session JWT's claim names for display gating (`role`, `realm`) are not fixed by the spec (`00 §6.2` fixes `iss`, `aud`, `sub`, `scope`, `exp`, `jti`, `kid`). | `sessionClaimsUnverified` reads `sub`, `exp` and, if present, `role`, `realm`, `scope`; the authority's and USSP's planners name the claim that carries the `01` role. The kit gates display only. | **Yes**: authority and USSP planners name the role claim. |
| Q10 | Branding config bundle shape (`06 §4` says it exists outside the repo; nothing names its keys). | §6.3 proposes five `UI_BRAND_*` variables and a static `/brand/` directory for the logo; a missing name renders the role ("U-space authority"), never an organisation. | Confirm or rename. |
| Q11 | Accessibility obligations for Georgian public interfaces (`08` Q15) are unanswered. | WCAG 2.2 AA is the target and `axe` gates CI; the public map and the registry check page are the first to be audited by hand (WP-13). | Confirm the target with the ministry. |
| Q12 | Next.js and React majors at implementation time (this plan says `next >=15`, `react ^19` from the stack decisions); Storybook and vitest browser mode versions move quickly. | WP-0 pins what is current on its day, records the versions in `CHANGELOG.md`, and the peers stay ranges. Nothing in this plan depends on a feature newer than Next.js App Router, React 19 and Tailwind v4. | None; a note for WP-0 to verify, not assume. |
| Q13 | Tailwind v4 `@source` scanning of a compiled package versus a prebuilt stylesheet. | D4: `@source` (one theme, tree-shaken utilities); the example app proves it. A prebuilt `uspace-ui.css` can be added as an additive export for a non-Tailwind consumer (the lab dashboard?) without changing anything else. | None. |
| Q14 | Should the kit ship the OpenAPI → TypeScript generation (`openapi-typescript`) as a CLI so all five `web/` generate identically, and check the output is committed and current? | WP-4 ships `uspace-ui-gen-api <openapi.yaml> <out.d.ts>` (a thin wrapper that pins the generator version and writes a header the `noHandWrittenApiTypes` rule recognises) and a CI snippet each `web/` copies. | None; the system planners may ignore it. |
| Q15 | Acknowledgement persistence: `02 F5` records acknowledgements at the USSP (`POST /v1/alerts/{id}/ack`); the authority's violations have review, not acks; the predecessor's console ack was per console and not recorded (P6-07). | The kit's `acknowledged` flag is per console and the `onAcknowledge` callback is the app's to persist; `AlertToaster` silences the tone on the local flag so an operator is never left with a tone they cannot stop while the API is down (B-10 thinking). | None. |
| Q16 | `uspace-lab/schemas/` and `uspace-lab/api/` (KT-2) do not exist at `uspace-lab@2b98ee8`, so the schema-example conformance hook cannot be wired now. | Synthetic fixtures until then; WP-14 wires the examples and pins the lab commit in `docs/LAB_VERSION`; the enumeration check against `uspace-core` source runs from WP-0. | **Yes**: KT-2 is on the lab's plate; the UI's `v1.0.0` waits for it. |
| Q17 | Public display of network identification (`09`, unverified items: F3411 public-display obfuscation rules) is unverified in the spec; if a public flight map is ever built on the kit, obfuscation is a server rule. | The kit renders what it is given; no public-map-specific component is planned. Recorded so that nobody adds client-side rounding as "privacy". | None. |

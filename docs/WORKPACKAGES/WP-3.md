# WP-3: `map` (MapView, self-hosted basemap, viewport and bbox hooks)

Branch `feat/WP-3-map-core`. Milestone U-M1. Owns `src/map/`,
`styles/map.css`, `stories/basemap/` exclusively. Depends on WP-0; uses
WP-1 tokens for control styling (start on WP-0, rebase when WP-1
merges). Consumers: WP-6, WP-7, WP-11, WP-12 layers; every console and
the CISP public map. On the critical path.

## Read first

1. `docs/PLAN.md` §1.2 D6, §3.6, §6.3 (basemap bundle contract), §8
   (frame budgets), §14 Q4.
2. Spec `05 §5` ("consoles subscribe only to the `cell5`s intersecting
   their viewport plus a margin"; server-side throttle), `05 §6`
   (consoles freeze with age shown), `06 §4` (no third-party request),
   `02 §1` geometry (`[lng, lat]`, WGS84).
3. LESSONS P1-12 via predecessor `utm/web-pilot/src/map/basemap.ts`
   (PMTiles, Protomaps flavours, `name:ka` fallback, OSM date in the
   attribution) and `MapView.tsx` (source/layer lifecycle, dark scheme
   switch, `EMPTY` sources before data), E-02.
4. MapLibre GL JS 5 documentation: `StyleSpecification`, GeoJSON source
   `setData` and `updateData`, `addProtocol` for `pmtiles`, controls,
   `transformRequest`.
5. `pmtiles` and `@protomaps/basemaps` READMEs (versions pinned at WP-0).

## What to build

- `basemapStyle(cfg, info, lang, scheme)`: Protomaps layers for the
  flavour, glyphs and sprites from `cfg` paths, `pmtiles://` source,
  attribution with the OSM extract date; `ka` label fallback as the
  predecessor did; with `info === null` a plain background and the
  attribution text "no base map" (the notice is rendered by `MapView`,
  not hidden in the style).
- `MapView`: creates one `maplibregl.Map`, registers the `pmtiles`
  protocol once per page, fetches `SOURCE.json` (with a timeout; absence
  is the `null` path, counted and shown), applies the style, re-applies
  it on `lang` or `scheme` change *keeping every kit layer* (layers
  re-add themselves via context on `style.load`), exposes the map via
  context, calls `onViewport` on `moveend` with the bbox, handles
  WebGL-unavailable with a visible notice and the bbox as text.
  Children render inside a provider; `useMap()` returns the instance
  after load.
- `useViewport`, `useBBoxSubscription` (pad by `marginFraction`,
  quantise to `quantizeDeg`, debounce, fire only on change; first fire
  on load), `MapControls` (zoom, compass, scale, scheme toggle, layer
  toggles as a sheet via `LayerPanel`), `styles/map.css`.
- A tiny committed PMTiles extract for stories (`stories/basemap/`,
  Tbilisi centre, a few MB at most; its `SOURCE.json` with the date and
  bounds; the build command recorded in `stories/basemap/README.md`),
  plus the glyph PBFs for the fontstack's Latin and Georgian ranges
  needed by the story labels only.

## Tests

- jsdom with a MapLibre mock (`src/map/test/maplibre-mock.ts`, shared
  with the layer WPs): `MapView` registers the protocol once for two
  instances; `onViewport` receives a bbox in `[lng, lat]` order with
  `minLng < maxLng`; a style re-apply on `lang` change calls the
  registered layer re-adders (presence) and a stable `lang` does not
  (absence); `SOURCE.json` 404 → notice rendered and `basemap_missing`
  counted; WebGL unsupported → notice with the bbox text.
- `useBBoxSubscription` with fake timers: debounce; quantisation (a pan
  smaller than the quantum fires nothing; one larger fires once);
  margin applied; timers restored (E-11).
- `basemapStyle`: `ka` turns every `name` text-field into a `coalesce`
  with `name:ka`; `en` leaves them; road `ref` untouched; dark flavour
  selected by scheme; attribution contains the date when known and the
  no-basemap text when not.
- Browser (stories, smoke only): `MapView` with the committed extract
  renders a canvas and fires `onLoad`; the `ka` story shows a Georgian
  label (assert via the map's `queryRenderedFeatures` on a known label
  layer, not pixels); `axe` on the controls.
- Benchmark: 400 `setData` calls per second on a GeoJSON source with 200
  features, time per call reported.

## Done when

- [ ] PLAN §3.6 implemented; API report updated.
- [ ] The Pages Storybook shows the Tbilisi extract with Georgian labels
  in `ka` and Latin in `en`, light and dark; say you looked (E-04).
- [ ] No request leaves the page except to the configured basemap paths
  (a browser test records `performance.getEntriesByType("resource")`
  and asserts every URL starts with the story's origin).
- [ ] The no-basemap and no-WebGL notices exist and are tested (E-02).
- [ ] `pnpm check`, `pnpm test`, `pnpm test:browser` outputs in the PR.

## Safety notes

A map that silently shows nothing is the failure mode this project keeps
meeting (LESSONS E-02 examples). Every empty state here has a visible
notice and a counter. The map never computes a position: it displays
coordinates the API sent, in the order the spec fixes. No geolocation
control: a console is a desk, and a browser prompt for location would be
a surprise on a state workstation.

## Commits

`feat(map): add the self-hosted PMTiles basemap style with ka labels and the OSM date [WP-3 U-M1]`,
`feat(map): add MapView with layer context, scheme and language re-apply and visible empty states [WP-3 U-M1]`,
`feat(map): add viewport, bbox subscription and map controls [WP-3 U-M1]`,
`test(map): cover basemap paths, bbox quantisation and the no-basemap and no-WebGL notices [WP-3 U-M1]`.

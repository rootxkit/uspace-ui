# Changelog

All notable changes to `@rootxkit/uspace-ui`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning
follows docs/PLAN.md §12. One line per work package under Unreleased.

## Unreleased

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

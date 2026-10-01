# uspace-ui

Shared npm UI kit of the U-space systems (`uspace-cisp`,
`uspace-authority`, `uspace-ussp`, `uspace-ansp`, `uspace-lab`):
shadcn/ui theme and design tokens, MapLibre map components and layers
(zones by type and restriction state, tracks by trust class,
identification status and age, alerts, intents, manned traffic, Remote
ID receivers) with their legends, `ka`/`en` i18n with Noto Sans
Georgian, a live-feed client with source and degraded-state components,
accessible table and form kits, a typed adapter for each system's
OpenAPI-generated client, and the BFF session helpers (cookie, CSRF,
forwarding) for Next.js.

A library, not a service: no process, no port, no database, no NATS, no
image. It renders what each system's API says and judges nothing;
every safety judgement lives once in Go, in
[`uspace-core`](https://github.com/rootxkit/uspace-core). Each system's
`web/` pins an exact version and maps its generated API types onto the
kit's view models in an adapter it owns.

## Status

Planning. `docs/PLAN.md` and the work package briefs are on `main`;
WP-0 (scaffold, frozen view models, lint rules, CI) is the first code.
The first release `v0.1.0` (U-M1 of the roadmap, with the CISP's C-M1)
ships the theme, `ui`, `i18n` and fonts, the map with the zone layer
and legend, the API adapter, the BFF helpers and the ESLint config.
Tracks, live feed, status, table and form follow in `0.2`; alerts and
the traffic layers in `0.3`; `v1.0.0` when two consoles use them.

## Links

- Plan and architecture: [`docs/PLAN.md`](docs/PLAN.md) (scope and
  role boundary, entry points and their API, dependencies, security,
  performance budgets, testing, CI, consumption, versioning, work
  packages and waves, open questions)
- Work packages: [`docs/WORKPACKAGES/`](docs/WORKPACKAGES/) (WP-0 to
  WP-14)
- Rules for contributors and agents: [`CLAUDE.md`](CLAUDE.md)
- Spec: `uspace-lab/docs/spec/` (`00 §6.3` names this package; `07`
  U-M1 is its first milestone)
- Storybook: published to GitHub Pages from `main` once WP-13 lands

## Consuming (from `v0.1.0`)

```
pnpm add @rootxkit/uspace-ui@<exact version> maplibre-gl
```

```css
/* web/app/globals.css */
@import "tailwindcss";
@import "@rootxkit/uspace-ui/styles/tokens.css";
@import "@rootxkit/uspace-ui/styles/map.css";
@source "../node_modules/@rootxkit/uspace-ui/dist";
```

Entry points: `@rootxkit/uspace-ui/{model,theme,ui,i18n,fonts,map,api,
auth/server,auth/client,symbology,layers,legend,live,status,alerts,
table,form,eslint,test}`. The full step list for a `web/` app is in
`docs/CONSUMING.md` (WP-13).

## Developing

```
pnpm install --frozen-lockfile   # Node 22, pnpm via corepack
pnpm check                       # prettier, eslint, tsc, build, publint, attw, api report
pnpm test && pnpm test:browser   # vitest; stories as tests with axe
pnpm storybook
```

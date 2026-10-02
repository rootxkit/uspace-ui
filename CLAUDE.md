# uspace-ui: rules for every contributor and agent

`uspace-ui` is the shared npm package of the U-space system-of-systems
(`@rootxkit/uspace-ui`): the shadcn/ui theme and design tokens, the
MapLibre map components and layers, the track and zone symbology and
legends, `ka`/`en` i18n with a Georgian-capable font, the live-feed
client and status components, the table and form kits, the typed API
adapter, and the BFF session helpers. A library, not a service: no
process, no port, no database, no NATS, no image. Every `web/` Next.js
app of `uspace-cisp`, `uspace-authority`, `uspace-ussp`, `uspace-ansp`
and the lab consumes it at build time, pinned by an exact version. Read
`docs/PLAN.md` before changing anything; a work package brief is in
`docs/WORKPACKAGES/`.

## Hard rules

1. **Nothing here commands an aircraft, and nothing here offers to.**
   No component, prop, route or string sends anything towards a vehicle
   or an operator's control link: no "send", "upload", "arm", "land",
   "geofence this aircraft", no resolution advice ("descend", "hold").
   Alerts and information go to people (LESSONS INV-01, C-11; spec
   `01` MUST NOT rows). A task that seems to need one is out of scope;
   stop and ask.
2. **The kit renders; it never judges.** No identification resolution,
   zone containment or applicability, CPA, conformance, altitude or
   datum conversion, time placement or distance exists in TypeScript
   (spec `00 §6` hard rule, `06` T12). The server sends `applies`,
   `stale`, `age_s`, `within_band`, `vertical_known`, `t_cpa_s`; the kit
   shows them. `@rootxkit/uspace-ui/eslint` forbids geometry and
   geodesy imports and applies to this repo too. A `Date`, `Math.cos`
   or `contains(` near a zone or a track is a review finding.
3. **Thresholds are data.** No default for `stale_after_s`,
   `live_max_age_s`, an alert repeat period, a height limit or a zone
   severity; they are required props or arrive in the status frame
   (INV-03; `docs/PLAN.md §6.3`). Display-only constants (debounce,
   trail length, legend order, hold time of a cleared alert) are named
   as such in a comment.
4. **Units and datums in every name and every label** (E-13, D-01):
   `altAmslM`, `heightM` with `heightRef`, `speedMs`, `ageS`; a label
   says "m AMSL", "m AGL", "above take-off", "pressure altitude";
   AMSL and AGL never share a string without both being named. Times
   are shown as UTC and say so (S-16); a local time names its zone.
5. **Wording is a safety surface.** Every broadcast track and every
   alert involving one says "broadcast and unverified"; a `registered`
   status on an `as_broadcast` basis says "as broadcast and unverified"
   (R-05). `unreachable` and `lagging` never say "lost" (C-12, B-04).
   `disabled by <who>` never looks like `silent since <t>` (B-11). A
   clear shows its own numbers and reason (C-14). Both catalogues carry
   every key; the parity test fails otherwise.
6. **Never hide, never upgrade.** A stale or unavailable source is
   shown as such with its age, never removed by the client (`01 §3` S4
   MUST NOT; `02 §1` failure rule). A `mismatch` is never shown as
   registered (G-02). An unknown (`null`) is a dash and an undimmed
   feature, never a zero, never "off" (`docs/PLAN.md §3`).
7. **No credential, hostname, organisation name, logo or real data in
   the repo** (spec `06 §4`). Branding is configuration (`UI_BRAND_*`).
   Fixtures use `GEO-TEST-*` and `TEST*`. The session JWT lives in an
   `HttpOnly` cookie set by `auth/server`; browser code never sees it;
   the BFF never verifies it (`00 §6.2`). No PII in a URL or in
   `localStorage`. The session and cookie contract is shared with all
   four systems (`docs/PLAN.md §6.3`): cookies `uspace_session` /
   `uspace_csrf`, header `X-CSRF-Token`, three BFF routes, session
   claims `roles: [string]` and `realm`, the WebSocket opened
   same-origin on the cookie. No ticket route, no token in a URL or a
   subprotocol; changing any of it is a plan change in five repos.
8. **Never hand-write an API type.** Each `web/` generates `paths` from
   its system's `api/openapi.yaml` with `uspace-ui-gen-api`; the kit's
   own types are view models in `src/model/`, whose enumerations mirror
   `uspace-core/core` string by string and are checked against the Go
   source at `docs/CORE_VERSION`. A mismatch is fixed by reading the Go
   source, never by editing the test.
9. **Bounded and counted.** Every store, ring and queue has a bound, a
   test past it, and a counter; every dropped, malformed or ignored
   frame is counted and the counters are visible in the status
   components (E-09, E-10).
10. **English only** in code, comments, commits, docs and keys; `ka`
    and `en` in catalogues.
11. **Dependencies**: React and the platform first. A new package needs
    a one-line reason in the commit body and a row in `docs/PLAN.md §4`.
    Nothing that computes geometry; nothing that phones home; nothing
    with a native binary.
12. **One console frame, one error body.** Every browser-facing
    WebSocket frame is the `04 §2` envelope plus a `body` named by
    `schema`, with `console/status/v1`, `console/snapshot/v1` and
    `console/subscribe/v1` as `docs/PLAN.md §6.3` defines them; the
    schemas are owned by `uspace-lab/schemas/common/`, not here. Every
    API error is `application/problem+json` with `errors: [{field,
    reason}]` and `truncated?`. The kit is written to these and to
    nothing else; a system that deviates is a reconciliation finding,
    not an adapter in this repo.
13. **GitHub Release tarballs, pnpm only.** The package is released as
    a GitHub Release asset (the `pnpm pack` tarball and `SHA256SUMS`)
    by `release.yml` on a `v*` tag; a pre-release version is a GitHub
    pre-release. Consumers depend on the exact asset URL and their
    lockfile pins its integrity (PLAN D10, as changed by the owner on
    2026-10-02; `docs/RELEASING.md`). No `github:` dependency, no
    branch, no GitHub Packages, no `NPM_TOKEN`; publishing to npmjs is
    a documented, switched-off path. This repo and every consumer use
    pnpm with `packageManager` pinned and `--frozen-lockfile`.

## Testing rules (from LESSONS E-01 to E-04, E-10, E-11)

- **E-01 Test presence, not only absence.** Every "renders nothing",
  "does not call back", "not in the URL" has a twin that renders, calls
  back, or lands in the URL. Every refusal has its acceptance.
- **E-02 Run the branch that says nothing is wrong.** A feed that stays
  `live` for ten minutes with no frames shows ages climbing; a basemap
  that loads shows the OSM date; a form that succeeds clears its
  errors; a muted tone is a visible state. Take the dependency away
  (no basemap, no WebGL, no status frame) and check the exact notice
  and counter.
- **E-03 Never write a wire format or an enumeration from memory.**
  Enumerations come from `uspace-core/core`; message fields from spec
  `04`; the standard fields from `uspace-core/f3411`, `f3548`, `ed318`.
  Read, cite, pin.
- **E-04 Never report an inference as an observation.** "Browser tests
  pass" means `pnpm test:browser` ran and you read the summary; "looks
  right" means you watched it render in a headed run. A skipped test is
  reported as skipped.
  A tool error is not evidence about the thing being checked.
- **E-10** every bounded structure has a test that exceeds its bound.
- **E-11** tests restore timers, `matchMedia`, cookies, the DOM and the
  map mock; the suite passes with `--sequence.shuffle`.
- Every user-facing component has a browser test under `browser/` in
  both languages and both schemes (light in English, dark in Georgian at
  least), rendered with `renderKit` (`browser/kit.tsx`), which mounts it
  in the kit's providers; `browser/setup.ts` runs `axe` (WCAG 2.2 AA)
  after every test and fails a test that showed a missing key. The
  golden set (`browser/golden/golden.test.tsx`) has DOM snapshots under
  `browser/golden/__snapshots__/` that change only with a reviewed
  reason. There is no Storybook (PLAN D9).
- Coverage: a work package is done at >= 90 % statement coverage of its
  entry points, with every branch that produces a distinct wording or
  visual state covered by a named test.

## Git conventions

- Branch per work package: `feat/WP-<k>-<slug>` (the slug is in the
  brief). Plan and docs branches: `plan/<slug>`, `docs/<slug>`.
- Conventional Commits, one logical change per commit, imperative
  subject under 72 characters, the work package and milestone in
  brackets at the end: `feat(layers): add ZoneLayer with hover cards
  [WP-6 U-M1]`, `test(live): replay a 4401 session expiry [WP-8 U-M2]`.
  Types: `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `build`,
  `ci`, `chore`. Scope is the entry point (`model`, `theme`, `ui`,
  `i18n`, `fonts`, `map`, `api`, `auth`, `symbology`, `layers`,
  `legend`, `live`, `status`, `alerts`, `table`, `form`, `eslint`,
  `test`, `example`).
- A commit that adds a dependency says why in the body.
- **No AI attribution of any kind**: no `Co-Authored-By`, no "generated
  by", no tool names in commits, PRs or code.
- Never force-push a shared branch; never commit to `main` directly.
- Do not push unless asked. The owner merges and tags.
- A PR that removes or changes a line of `docs/api/uspace-ui.api.md`
  carries the label `breaking` and a new major heading in
  `CHANGELOG.md`; one that changes a semantic token or a symbology
  mapping carries `legend-change` and cites the lesson or spec row
  (`docs/PLAN.md §12`; enforced by CI from WP-14).

## Commands

The scripts are defined in `package.json` (WP-0).

```
pnpm install --frozen-lockfile   # Node 22 (.nvmrc), pnpm via corepack (packageManager)
pnpm check          # prettier, build, eslint (the kit's own rules, from dist/), tsc, publint, attw, api report, size, hostname grep
pnpm test           # vitest: node and jsdom projects, with coverage
pnpm test:browser   # vitest browser mode: components in Chromium, axe, golden snapshots (needs `pnpm exec playwright install chromium` once)
pnpm exec vitest --project browser --browser.headless=false <file>   # watch a browser test render
pnpm build          # tsc to dist/
pnpm api-report     # regenerate docs/api/uspace-ui.api.md (commit the result)
scripts/check-enums.sh   # compare src/model enumerations with uspace-core at docs/CORE_VERSION (online)
```

## Before you say a work package is done

Run, in this order, and paste the last lines of each into the PR:

```
pnpm check
pnpm test
pnpm test:browser
pnpm api-report && git diff --stat docs/api
```

Then check the brief's done-when list item by item. Run every browser
test you added headed (the command above) and look at it in both
languages; say that you did. If a component cannot be built without a
field, a threshold or a frame the API does not provide, stop and write
it down in the PR as a spec gap (`docs/PLAN.md §14`); do not invent a
default and do not compute it client-side.

# WP-0: scaffold, frozen view models, lint rules, CI

Branch `feat/WP-0-scaffold`. Milestone U-M0 (the first merge after the
plan). Owns `package.json`, `pnpm-lock.yaml`, `tsconfig*.json`,
`.nvmrc`, `.npmrc`, `.prettierrc`, `eslint.config.js`, `vitest.config.ts`,
`.storybook/`, `src/model/`, `src/eslint/`, `src/test/` (helpers only),
`scripts/`, `.github/workflows/ci.yml`, `SECURITY.md`, `CHANGELOG.md`,
`.gitattributes`, `.gitignore`. Depends on nothing. Every other WP
depends on it, so it is small and reviewed first.

## Read first

1. `docs/PLAN.md` §1 (what the kit is not), §2 (layout and the `exports`
   map), §3.1 (`model`, to be written here exactly), §3.17 (`eslint`),
   §3.18 (`test`), §4 (dependencies), §9, §10, §12.
2. `uspace-core/core/*.go` at the tag in `docs/CORE_VERSION` (write that
   file: `v0.2.0` today): every string constant of `VerticalRef`,
   `AltSource`, `TimeSource`, `Trust`, `Severity`, `ZoneType`,
   `IdentStatus`, `IdentReason`, `IdentBasis`, and `FieldError`. The
   kit mirrors them; read them, do not type them from memory (E-03 in
   spirit: a name is a wire format).
3. Spec `04 §2` (envelope, trust), `04 §3.2` (identification), `04 §3.3`
   (alert kinds, states, clear reasons; violation kinds), `02 F2`
   (restriction states), `00 §5` (ED-318 zone types), `00 §6` (the lint
   rule), `07` KT-3.
4. LESSONS B-03, B-04, B-11 (the `SourceState` words), E-01, E-02, E-10,
   E-11, E-13.
5. `uspace-core/docs/WORKPACKAGES/WP-0.md` for the shape of a scaffold
   brief and what "verified on the branch" must contain.
6. Predecessor `utm/web-pilot/package.json`, `eslint.config.js`,
   `tsconfig.json`: the baseline this replaces.

## What to build

**Tooling.** Node 22 (`.nvmrc`), pnpm via `packageManager` (corepack),
TypeScript strict with `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `module: NodeNext`
for the build and `bundler` resolution checked by `attw`. `tsc` build
to `dist/` preserving the file tree and `"use client"` banners (D3).
`package.json` with the full `exports` map of PLAN §2 (every entry
present now, pointing at a stub `index.ts` that exports nothing but a
`const ENTRY = "map"` style marker so `publint`/`attw` validate the map
from day one), `sideEffects: ["*.css"]`, `files`, `engines`, exact
dependency pins, peers as ranges, `publishConfig: { access: "public",
provenance: true }`. Prettier. Vitest with three projects: `node`
(pure), `jsdom` (components), `browser` (Playwright Chromium, stories).
Storybook 9 with `react-vite`, `addon-a11y`, `addon-vitest`; one story
(`stories/Welcome.mdx`) so the browser job has something to run.
Scripts: `check` (prettier, eslint, tsc, build, publint, attw,
api-extractor, size, the `chikox.net` grep), `test`, `test:browser`,
`storybook`, `build-storybook`, `api-report`.

**`src/model/`.** The types and enumerations of PLAN §3.1, verbatim.
`enums.ts` exports each enumeration as a `readonly` array *and* the
union type derived from it (`export const TRUSTS = [...] as const; export
type Trust = (typeof TRUSTS)[number]`) so the symbology's exhaustive
switches and the legends' iteration use one source. `index.ts` re-exports.
No function in `model` except `isTrust(x): x is Trust` style guards,
generated from the arrays.

**`src/eslint/`.** The flat config of PLAN §3.17 as `index.ts` (compiled
to `dist/eslint/index.js`, exported as `./eslint`), with the four custom
rules in `rules/` as plain ESLint rule modules. Apply the config to this
repo itself in `eslint.config.js`.

**`src/test/`.** `renderWithKit` (providers are stubs until WP-1/WP-2
land; the signature is final), `fixtures()` returning synthetic data
that covers every enumeration value at least once (generated from the
`model` arrays so a new value cannot be missed), `axeCheck`.

**`scripts/`.** `check-enums.sh`: fetches `uspace-core` at
`docs/CORE_VERSION` (sparse checkout of `core/`), extracts the string
constants with a small Go-free parser (`grep`/`awk` on the `const (`
blocks is acceptable here because the test that follows is the real
check), and runs `vitest run src/model/enums.core.test.ts` which compares
them with the arrays. Online, best-effort on PRs, required on `main`
(PLAN §10 job 7). `size-check.mjs` reading budgets from `package.json`.

**CI.** `.github/workflows/ci.yml` exactly as PLAN §10 jobs 1–7
(release and pages workflows are WP-13). `concurrency` with
cancel-in-progress, `timeout-minutes`, path filters, caches for pnpm and
Playwright. Branch protection is the owner's.

**Docs.** `SECURITY.md` (contact, 90 days), `CHANGELOG.md` with
`Unreleased`, `docs/CORE_VERSION`, `docs/api/uspace-ui.api.md` generated
(empty surface except `model`).

## Tests

- `model/enums.test.ts`: every array matches the list in PLAN §3.1 (a
  copy in the test, so a silent edit of either side fails); no
  duplicates; every union member is in its array (type-level test with
  `satisfies`).
- `model/enums.core.test.ts`: against the extracted core constants (skips
  with a visible message when the extraction file is absent, never passes
  silently: the skip count is printed in CI).
- `eslint/rules/*.test.ts` with `RuleTester`: for each rule, inputs that
  are reported and inputs that pass (E-01); `noGeometryImports` reports
  `import area from "@turf/area"` and passes `import maplibregl from
  "maplibre-gl"`; `noServerClientsInWeb` reports `nats` and passes
  `openapi-fetch`; `noBusinessLogicInRoutes` reports an import of
  `../../lib/zones` inside `app/api/x/route.ts` and passes
  `@rootxkit/uspace-ui/auth/server`; `noHandWrittenApiTypes` reports an
  `interface Track` in `src/api/generated/extra.ts` without the generated
  header and passes the generated file.
- `test/fixtures.test.ts`: every enumeration value appears at least once
  across the fixtures (presence); fixture numbers use `GEO-TEST-*` and
  `TEST*` (a regex over the JSON).
- The browser project runs the one story and `axe` on it.

## Done when

- [ ] `pnpm install --frozen-lockfile` from a clean clone; `pnpm check`
  prints no issue; `pnpm test` and `pnpm test:browser` green; outputs
  pasted into the PR (E-04), including the enum check's result or its
  skip line.
- [ ] `publint` and `attw` pass for every `exports` key.
- [ ] CI green on the PR with every job of PLAN §10 present (the `enums`
  job may be best-effort on the PR; say what it printed).
- [ ] `docs/PLAN.md §3.1` and `src/model/` agree line by line; a
  reviewer diffs them.
- [ ] `CLAUDE.md` commands section matches the scripts that exist.

## Safety notes

Nothing in this WP renders. The one safety-relevant artefact is
`src/model/`: a wrong enumeration value here makes a status invisible on
every console (a track the kit cannot name is a track it cannot show).
Read the Go source; pin it; never "fix" a mismatch by editing the test.

## Commits

`build: scaffold the package with pnpm, tsc build and the exports map [WP-0 U-M0]`,
`feat(model): freeze the view-model types and enumerations mirrored from uspace-core [WP-0 U-M0]`,
`feat(eslint): add the no-geometry, no-server-client, no-route-logic and no-hand-written-type rules [WP-0 U-M0]`,
`test: add the render helper, synthetic fixtures and the enumeration check against uspace-core [WP-0 U-M0]`,
`ci: add check, test, browser, fonts, example, gitleaks and enums jobs [WP-0 U-M0]`.

# WP-1: `theme` and `ui` (tokens, branding, shadcn/ui)

Branch `feat/WP-1-theme-ui`. Milestone U-M1. Owns `src/theme/`,
`src/ui/`, `styles/tokens.css` exclusively. Depends on WP-0. Consumers:
every other entry point; every `web/`.

## Read first

1. `docs/PLAN.md` §1.2 D4, D5, §3.2, §3.3, §4 (the `ui` dependency row),
   §7 (branding, CSP), §12 (what a token change means for semver).
2. Spec `00 §6.3` (one visual language, branding by configuration),
   `06 §4` ("Branding is configuration"; no organisation name or logo
   in the repo), `08` Q15 (accessibility and official branding are open).
3. Spec `04 §2` (the six trust classes), `04 §3.2` (four statuses),
   `04 §3.3` (three severities), `00 §5` (five zone types): the four
   semantic palettes this WP defines colours for. The *meaning* of each
   colour is fixed by WP-6/WP-7; this WP guarantees they are
   distinguishable and accessible.
4. shadcn/ui documentation for the CLI, Tailwind v4 setup and the
   component list; the `radix-ui` unified package.
5. Predecessor `utm/web-pilot/src/styles.css` (`.pill.id-*`, severity
   colours, dark scheme via `prefers-color-scheme`) for what operators
   already recognise.

## What to build

**`styles/tokens.css`.** `@import "tailwindcss"` is the app's; this file
is pure CSS: `:root` and `[data-theme="dark"]` blocks defining `--us-*`
custom properties (surface, text, border, focus ring, the shadcn
semantic set `--background`, `--foreground`, `--primary`, ... mapped onto
`--us-*`), and the four semantic palettes: `--us-severity-info|warning|
critical`, `--us-trust-authenticated|provider|surveillance|broadcast|
sensor|simulated`, `--us-ident-registered|suspended|unknown_operator|
unidentified|none`, `--us-zone-PROHIBITED|REQ_AUTHORIZATION|CONDITIONAL|
NO_RESTRICTION|USPACE`, `--us-age-live|aging|stale|unknown`, and
`--us-brand-accent` (overridden by `ThemeProvider` from `Brand.accent`).
A Tailwind `@theme inline` block maps them so `bg-severity-critical`
style utilities exist for consumers. Light and dark values chosen with
the test below.

**`src/theme/`.** `Brand`, `brandFromEnv`, `ThemeProvider` (sets
`data-theme` on `<html>` from `scheme` or `prefers-color-scheme` for
`system`; writes `--us-brand-accent`; exposes `brand`), `useTheme`,
`tokens` (variable names only). Scheme persistence: cookie
`uspace_scheme` written by the app's server action, read here; the kit
never touches `localStorage` (PLAN §6.1). No organisation name anywhere:
the fallback brand name is the role word the app passes, never a
default of ours beyond `"U-space"`.

**`src/ui/`.** Run the shadcn CLI once with the Tailwind v4 preset into
`src/ui/`, for the list in PLAN §3.3; commit the output unchanged except
for import paths; `src/ui/UPGRADING.md` records the CLI version, the
command, and the procedure (re-run into a temp dir, diff, apply). Export
from `src/ui/index.ts`. `cn()` in `src/ui/cn.ts`. Every component keeps
`"use client"` where upstream has it. Additions (`Kbd`, `Stat`,
`EmptyState`, `InlineCode`) are separate files under `src/ui/extra/`.

## Tests

- `tokens.test.ts` (node): parse `styles/tokens.css`; for both schemes,
  every semantic colour against its surface meets WCAG 2.2 AA contrast
  (4.5:1 text, 3:1 graphics) using a small APCA/WCAG contrast function
  written in the test (no dependency); within each palette, every pair
  of colours is distinguishable under simulated deuteranopia and
  protanopia (a documented transform in the test, with the matrix cited)
  by a ΔE threshold named as a constant. Presence twin: a test that
  feeds a deliberately bad pair and sees the assertion fail.
- `theme.test.tsx` (jsdom): `system` follows `matchMedia` and switches
  live when it changes; `setScheme("dark")` sets `data-theme`;
  `brandFromEnv` with no variables yields the role fallback and no
  organisation string (a regex over the output for names is not
  possible, so the test asserts the exact fallback); `matchMedia` and
  `document.documentElement` restored after each test (E-11).
- Browser tests (`browser/ui/`): every `ui` component in both schemes;
  `axe` on each; a `Palettes` page showing the four semantic sets with their variable
  names (the golden set gets `palettes.light`/`palettes.dark` DOM
  snapshots).
- A browser test under the CSP of PLAN §7 (`browser/csp/*`): a
  component using inline styles must still render (no `style-src`
  violation in the console; the test asserts the console is clean).

## Done when

- [ ] PLAN §3.2 signatures implemented; API report updated.
- [ ] Contrast and colour-vision tests pass for both schemes; the
  thresholds and the transform are cited in the test file.
- [ ] Every shadcn component listed renders in a browser test in both schemes
  with `axe` clean; `UPGRADING.md` written.
- [ ] No string naming an organisation, a hostname or a logo path in
  `src/theme/` or `styles/` (the `chikox.net` grep plus a reviewer read).
- [ ] `pnpm check`, `pnpm test`, `pnpm test:browser` outputs in the PR.

## Safety notes

Colour carries meaning on a safety console. This WP does not decide the
meaning (WP-6, WP-7 do) but it decides whether an operator can tell
`critical` from `warning` and `broadcast` from `authenticated` at a
glance, under any colour vision. The test is the proof; "looks fine on
my screen" is not (E-04). A palette change after `v1` that keeps meaning
is a minor; one that changes meaning is a major (PLAN §12).

## Commits

`feat(theme): add the design tokens for light and dark with the four semantic palettes [WP-1 U-M1]`,
`feat(theme): add ThemeProvider, useTheme and branding from configuration [WP-1 U-M1]`,
`feat(ui): vendor the shadcn/ui component set and the upgrade procedure [WP-1 U-M1]`,
`test(theme): check contrast and colour-vision separation of every palette [WP-1 U-M1]`.

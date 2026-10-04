# Accessibility audit (WP-13, PLAN §14 Q11)

## Target: WCAG 2.2 AA, pending GCAA

Spec `08` Q15 (the accessibility obligations of Georgian public
interfaces) is unanswered, and GCAA has not answered its policy
questions. The target is therefore the plan's default, WCAG 2.2 AA
(PLAN §14 Q11), kept as configuration in
`examples/next-app/config/example.json` (`policy.accessibility_target`,
`"status": "pending GCAA"`) and shown in the example's footer. If the
answer changes the target, the configuration and this page change; the
checks below are written against the configured level.

## What was audited, how, and when

On 2026-10-04, against `examples/next-app` built from this branch
(`next build`, standalone server, the browser tests' Tbilisi basemap):

- the public map (`/`), the sign-in page (`/login`) and the
  role-gated page (`/protected`), in English and Georgian, light and
  dark;
- by hand in a Chromium window: keyboard only (Tab order, focus
  indicator on every stop, the skip link), the accessibility tree
  (landmarks, headings, names, `lang`), reflow at 320 CSS px, the
  sign-in refusal;
- by `axe` 4.13 with the WCAG 2.0, 2.1 and 2.2 A and AA rules on every
  page, English light and Georgian dark (the smoke test, below).

Not audited here:

- **The registry check page.** PLAN §14 Q11 names it with the public
  map as the first to audit by hand. It is a system's page (it is not in
  this repository and the example has none); the kit components it will
  be built from (`table`, `form`) pass `axe` in their browser tests. Its
  hand audit belongs to the system that ships it.
- **A screen reader pass** (NVDA, VoiceOver, TalkBack). The names,
  roles and states were read from the accessibility tree, which is what
  a screen reader reads, but no screen reader was run. That is a gap in
  this audit, not a pass.
- Pixel contrast of the map's own drawing (zone fills over the
  basemap). The legend's swatches and the palettes are checked for WCAG
  contrast and colour-blind separation in WP-1's tests; the canvas is
  not readable by `axe`.

## Findings

| # | Where | WCAG | Finding | State |
|---|---|---|---|---|
| A1 | example, every page | 2.4.2 Page Titled | No page had a `<title>`. | **Fixed**: each page's title is its heading and the brand, in the request's language (`src/i18n/server.ts`). |
| A2 | kit, `MapView` | 3.1.2 Language of Parts; 1.3.1 | MapLibre names its focusable canvas `region` "Map", in English on a Georgian page, inside the kit's own region also named "Map": two nested regions of one name, one in the wrong language. | **Fixed**: the canvas is named by the new key `map.canvas` ("Map view: the arrow keys pan, plus and minus zoom" / Georgian), at creation through MapLibre's `locale` and again on a language change. |
| A3 | example, skip link | 2.4.1 Bypass Blocks | The skip link was first in the Tab order and moved the view, but not the focus: `<main>` was not focusable. | **Fixed**: `<main tabIndex={-1}>`; Enter on the skip link puts focus on the content. |
| A4 | kit, `LoginForm` | 2.4.3 Focus Order | After a refused sign-in the focus falls to `<body>` (the submit button is disabled while the request runs). The refusal itself is announced (`role="alert"`) and the fields keep their values. | **Open**: the form should return focus to the first field or the message; a kit change with its own browser test. |
| A5 | kit, `ThemeProvider` | (none; noted) | The scheme is applied after hydration, so a dark-preference page first paints light and transitions. `axe` measured a button mid-transition as low contrast; once the scheme is set, every page passes. Not a WCAG failure, and a flash for the user. | **Open**: the tokens could follow `prefers-color-scheme` before `data-theme` is set. |
| A6 | MapLibre | 2.4.3 | Tab reaches the map's attribution links before the zoom and layer buttons drawn above them (MapLibre's DOM order). The order is consistent and every stop is visible. | Noted; not changed. |

Passed by hand: one `h1` per page and a heading for the legend;
`header`, `nav` (named), `main`, `footer` landmarks; every control
reachable by Tab with a visible focus indicator (the kit's 2–3 px
outlines; the browser's ring on links and the canvas); the language
buttons carry their own `lang`; `<html lang>` follows the switch; the
sign-in fields are labelled, `required`, and carry `autocomplete`
`username` and `current-password` (1.3.5); no horizontal scrolling at
320 CSS px on any page (1.4.10).

## What keeps it checked

- `examples/next-app/scripts/smoke.mjs` (CI's `example` job): every
  page has a title in its language and passes `axe` at WCAG 2.2 AA in
  English light and Georgian dark; the map canvas is named in the
  page's language and apart from the region around it, also after a
  switch; the skip link is the first Tab stop and moves focus to
  `main`; nothing scrolls sideways at 320 CSS px.
- `browser/map/MapView.test.tsx`: the canvas name in English and in
  Georgian.
- `browser/setup.ts` runs `axe` after every component browser test, as
  before.

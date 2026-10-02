# WP-6: zones (zone symbology, `ZoneLayer`, `RestrictionLayer`, `ZoneLegend`)

Branch `feat/WP-6-zones`. Milestone U-M1 (the CISP public map, C-M1,
is built on this). Owns `src/symbology/zone.ts`,
`src/symbology/restriction.ts`, `src/layers/ZoneLayer.tsx`,
`src/layers/RestrictionLayer.tsx`, `src/legend/ZoneLegend.tsx` and the
layer context helper `src/layers/useLayer.ts` (shared with WP-7, written
here first, frozen by its signature in the brief). Depends on WP-1
(tokens), WP-2 (labels), WP-3 (`MapView`, mock). On the critical path
to `v0.1.0`.

## Read first

1. `docs/PLAN.md` §1.1 (the kit never evaluates applicability or
   containment), §3.8 (zone functions), §3.9 (`ZoneLayer`,
   `RestrictionLayer`), §3.10, §8 (one `setData` per frame), §12 (a
   legend-meaning change is a major), §14 Q3.
2. Spec `00 §5` (geo-zone types as ED-318 spells them; U-space airspace
   is type `USPACE`), `02 F1` (the ED-318 feature fields: `type`,
   `variant`, `reason[]`, `message`, `limitedApplicability`, vertical
   limits with reference), `02 F2` (restriction states `planned`,
   `active`, `ended`, `cancelled`; reason `DAR`, identifier `DAR` +
   4 base-36, no hyphen: reconciliation M10), `02 F3` (`?at=` returns
   applicable features; `?applies_at=` annotates every feature with
   `extendedProperties.cis_applicability` ∈ `applies` /
   `not_applicable` / `unknown` without filtering, reconciliation M17,
   which is what an app maps onto `ZoneView.applies`; `version`,
   `cis_updated_at` and core's `metadata.issued` / `metadata.provider`,
   M15), `04 §3.4`.
3. LESSONS Z-10 (severity per restriction is policy; the *colour per
   type* here must not contradict it: PROHIBITED reads as the gravest),
   Z-09 (a zone whose limit could not be judged is the *alert's*
   business; the zone itself draws normally), T-09 (applicability is
   judged at the aircraft's placed time, by the server), Z-11 (a circle
   is its centre and radius: the API sends the geometry it wants drawn;
   the kit draws GeoJSON as given, no circle construction), R-12, E-13
   (limits shown with reference and unit).
4. `uspace-core/ed318` types (field names for the view-model adapter
   example in the browser tests), `uspace-core/core` `ZoneType`.
5. Predecessor `utm/web-pilot/src/map/MapView.tsx` zone layers
   (`zones-fill`, `zones-line`, `zones-line-inactive`, labels) and
   `ZonesPanel.tsx`; its `zones.ts` *must not* be ported: it evaluated
   applicability client-side, which is now a judgement in core.

## What to build

- `symbology/zone.ts`: `zoneToken`, `zonePattern`, `zoneOpacity`,
  `zoneStyle()` returning the fill, line and pattern expressions keyed
  on `properties.type`, `properties.applies`, `properties.selected`;
  total over `ZoneType` (`satisfies never`). Hatching via a generated
  pattern image added to the map once (`useLayer` helper) so
  REQ_AUTHORIZATION is distinguishable without colour.
- `symbology/restriction.ts`: `restrictionStateToken`, dash arrays per
  state (`planned` dashed, `active` solid thick, `ended`/`cancelled`
  dimmed thin).
- `layers/useLayer.ts`: registers a source and layers on the map,
  re-adds them on `style.load` (WP-3 context), coalesces `setData` into
  one call per animation frame, removes on unmount; the signature
  `useLayer({ id, build(map), update(map, data), data })` is used by
  every layer WP.
- `ZoneLayer`: features from `ZoneView[]` with `properties` limited to
  what the style needs plus `identifier`, `name` (for labels, using
  `fonts.mapFontstack`), `lowerLimitM`/`lowerRef`/`upperLimitM`/`upperRef`
  for the hover card; click → `onSelect(identifier)`; hover card shows
  name, type (i18n), limits with reference and unit, `message`, the
  applicability as the API said it (`applies`: "applies now" / "not
  applying now" / nothing when `null`; the app sets it from
  `cis_applicability` of a `?applies_at=` response, PLAN §6.4, and the
  kit never asks why), `version` and `updatedAt` (Art. 9(2): time of
  update and version are shown wherever a zone is).
- `RestrictionLayer`: ED-318 features with reason `DAR`, same hover
  card plus the state and `starts_at`/`ends_at` as the API spelled them
  (fields taken from `ZoneView` plus `restrictionState`).
- `ZoneLegend`: the five types with pattern swatches and i18n names,
  optional counts, the "dimmed = not applying now" note, keyboard
  reachable, `aria` labelled.

## Tests

- `symbology/zone.test.ts`: every `ZoneType` has a token, a pattern and
  an opacity rule; `zoneOpacity({applies: false})` < `({applies: true})`
  and `({applies: null})` equals `true`'s (unknown is not off, E-01
  pair); `restrictionState: "ended"` dims; snapshot of the expressions
  (data, reviewed on change with the `legend-change` label).
- `ZoneLayer` with the WP-3 mock: two renders in one frame produce one
  `setData` (coalescing); features carry only the listed properties
  (no `extendedProperties` leak onto the map: presence of `identifier`,
  absence of `extendedProperties`); a `Polygon` and a `MultiPolygon` are
  passed through untouched (deep-equal geometry in and out: the kit
  does not reconstruct geometry); a feature with `applies: false` gets
  the dimmed paint state; `onSelect` fires with the identifier on click
  and not on a click outside (pair); labels use `mapFontstack`.
- `RestrictionLayer`: each state's dash array present; a cancelled one
  still drawn (never removed silently; `02 §1` failure rule).
- `ZoneLegend` (jsdom): five entries in the fixed order, counts when
  given, `axe` clean; both languages.
- Browser tests: all five types over the Tbilisi extract; hover card in both
  languages; a `planned`/`active`/`ended` restriction trio; golden DOM
  snapshot of the legend and the hover card.

## Done when

- [ ] PLAN §3.8 (zone part), §3.9 (`ZoneLayer`, `RestrictionLayer`),
  §3.10 (`ZoneLegend`) implemented; API report updated.
- [ ] No function in this WP takes a time or a position and returns a
  boolean about a zone (a reviewer greps for `Date`, `now`, `contains`,
  `inside`, `applies(` in `src/symbology/zone.ts` and `src/layers/Zone*`;
  the only `applies` is the field read).
- [ ] The zone tests in both languages, in a headed run
  (`pnpm exec vitest --project browser --browser.headless=false <file>`);
  say you looked.
- [ ] `pnpm check`, `pnpm test`, `pnpm test:browser` outputs in the PR.

## Safety notes

The temptation in this WP is to compute "does this zone apply now" from
`limitedApplicability` because the data is right there. Do not: that is
`ed269.Applies` (T-09, Z-07) and it lives once, in Go. Draw what the API
says, show `version` and `updatedAt` so a stale picture is visibly
stale, and leave `applies: null` undimmed. A zone drawn dimmed by a
wrong client-side rule is a zone a pilot flies into.

## Commits

`feat(symbology): map zone types and restriction states to tokens, patterns and expressions [WP-6 U-M1]`,
`feat(layers): add the layer lifecycle helper with per-frame coalescing [WP-6 U-M1]`,
`feat(layers): add ZoneLayer and RestrictionLayer with hover cards showing limits, version and applicability as served [WP-6 U-M1]`,
`feat(legend): add ZoneLegend [WP-6 U-M1]`,
`test(layers): cover coalescing, geometry pass-through, dimming and selection [WP-6 U-M1]`.

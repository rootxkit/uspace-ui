# WP-7: tracks (trust, identification and age symbology, `TrackLayer`, track legends)

Branch `feat/WP-7-tracks`. Milestone U-M2 (the authority's A-M2 picture
and the USSP's S-M2 console). Owns `src/symbology/track.ts`,
`src/symbology/ident.ts`, `src/symbology/age.ts`,
`src/symbology/severity.ts`, `src/layers/TrackLayer.tsx`,
`src/legend/{TrackLegend,IdentificationLegend,AgeLegend,SeverityLegend}.tsx`.
Depends on WP-1, WP-2, WP-3 and WP-6's `useLayer` (start when WP-6's PR
is open; rebase). Consumers: WP-11, WP-12, the authority and USSP
consoles, the USSP operator portal.

## Read first

1. `docs/PLAN.md` §3.1 (`TrackView`, `Identification`, `Times`), §3.8
   (track, ident, age, severity functions), §3.9 (`TrackLayer`), §3.10,
   §5 (the lessons listed for `symbology`, `legend`, `layers`), §8.
2. Spec `04 §2` (trust classes and what each means; `source`,
   `source_instance`; "a disabled source's tracks age out as
   `source_disabled`"), `04 §3.1` (track fields, F3411 operational
   status values, special values decode to null), `04 §3.2`
   (identification: `status`, `reason`, `mismatch`, `basis`), `00 §6.3`
   ("symbology (trust class, identification status, age, zone type,
   restriction state)"), `05 §5` (≤ 2 Hz per track above 200 in view).
3. LESSONS R-05 (every broadcast track says "broadcast and unverified";
   a `registered` status with basis `as_broadcast` says "as broadcast
   and unverified"), G-01 (four statuses, stable), G-02 (a mismatch is
   never shown as registered: the badge is the mismatch), G-03 (which
   statuses need attention; the legend orders by it, the server judges
   it), R-09 (pressure altitude is a vertical position of unknown
   datum: the detail says "pressure altitude", never AMSL), R-12 (height
   over take-off is labelled so), R-10 (track is course over ground;
   `null` means no arrow), T-13 (a track only moves forward: an older
   `capturedAt` for the same id is ignored and counted), T-04 (backlog
   frames are history), C-05 (the server alerts only on flying aircraft;
   the kit shows `status` as given), I-02 (an unidentified track is a
   track with its own id; it is drawn, labelled unidentified).
4. `uspace-core/core` (`Trust`, `IdentStatus`, `IdentReason`,
   `IdentBasis`, `AltSource`) and predecessor
   `utm/web-pilot/src/identification.ts`, `IdentificationLegend.tsx`,
   `DronePanel.tsx` (what the detail shows; the "as broadcast" fix of
   utm PR #21).

## What to build

- `symbology/track.ts`: `trustShape`, `trustToken`, the SDF icon set
  (one generated SVG per shape, hollow variant for `broadcast`, dashed
  for `simulated`, added to the map once), `trackStyle()` expressions:
  icon by trust, colour by identification status (`none` grey),
  opacity by age bucket, `icon-rotate` by `trackDeg` with a
  non-rotating variant when null, a halo ring when `emergency`, a
  distinct selected state, label with the registration public part or
  the serial or "unidentified" (i18n), sized by zoom.
- `symbology/ident.ts`: `identToken`, `identOrder`, `needsAttention`
  (the list from G-03, used for ordering and the legend note only),
  `identHintKey(status, reason, basis)` for the detail text, including
  the `as_broadcast` caveat and the `mismatch` line.
- `symbology/age.ts`: `ageBucket(ageS, staleAfterS)` with the thirds
  rule of PLAN §3.8; no default `staleAfterS`.
- `symbology/severity.ts`: `severityToken`, `severityOrder`.
- `TrackLayer`: features from an `Iterable<TrackView>` with a per-id
  guard that drops an update whose `times.capturedAt` is older than the
  held one (counted `track_out_of_order`); optional trails (bounded ring
  per track; `backlog: true` samples go to the trail only); `nowMs`
  prop drives the age bucket (the app re-renders on a 1 s tick; the
  layer does not own a timer); labels toggle; `onSelect`; one `setData`
  per frame via `useLayer`.
- Legends: `TrackLegend` (six trust shapes with the hollow/dashed
  cues and one-line meanings from `04 §2`), `IdentificationLegend`
  (four statuses plus `none`, hint per status, the broadcast caveat),
  `AgeLegend(staleAfterS)`, `SeverityLegend`.
- `TrackDetail` is WP-12's; this WP exports the `identHintKey` and the
  formatters it will use.

## Tests

- Symbology: total over every enumeration (a test iterates the `model`
  arrays and calls each function; a `satisfies never` guards the
  switch); `trustShape("broadcast")` is the hollow variant and no other
  trust is hollow (pair); `ageBucket` boundaries with a chosen
  `staleAfterS` (live/aging/stale/unknown, each hit); `identHintKey`
  for `registered`+`as_broadcast` yields the caveat key and
  `registered`+`authenticated` does not (pair); `mismatch: true` yields
  the mismatch line whatever the status.
- `TrackLayer` with the WP-3 mock: out-of-order update ignored and
  counted, in-order applied (pair); a `backlog` sample extends the trail
  and leaves the position (pair with a live sample); trail bounded past
  its length (E-10); `trackDeg: null` selects the non-rotating icon;
  `emergency: true` adds the halo; `nowMs` advancing moves a track from
  live to stale with no new frame (the branch where nothing arrives,
  E-02); one `setData` for 400 upserts within one frame; selection.
- Legends (jsdom): order of statuses as `identOrder()`; counts; `axe`;
  both languages; the broadcast caveat text present in
  `IdentificationLegend` and absent from `SeverityLegend` (pair).
- Benchmark: 400 upserts/s with 200 tracks in view, time to next frame
  (PLAN §8); reported.
- Stories: a fixture sky over the Tbilisi extract with every trust and
  status combination at least once, ages spread across buckets, one
  emergency, one unidentified, one mismatch; both schemes and languages;
  golden DOM snapshots of the three legends.

## Done when

- [ ] PLAN §3.8 (track, ident, age, severity), §3.9 (`TrackLayer`),
  §3.10 (three legends) implemented; API report updated.
- [ ] Every enumeration value renders somewhere in the stories (a
  browser test walks the fixture and the rendered legend DOM).
- [ ] No position arithmetic in this WP (grep for `Math.`, `cos`,
  `sin`, `atan` in `src/layers/TrackLayer.tsx` and `src/symbology/`:
  only the icon generator may use them, for drawing shapes).
- [ ] Stories on Pages; say you looked at a broadcast track and read
  its caveat.
- [ ] `pnpm check`, `pnpm test`, `pnpm test:browser` outputs in the PR.

## Safety notes

R-05 is the rule this WP exists to render: anyone with a phone can
broadcast a position, so a `broadcast` track must look different from an
`authenticated` one without reading a label, and its detail must say
"unverified". The kit does not decide trust or status (the server did);
it must never upgrade one visually (no "registered" colour on a
mismatch, G-02). The out-of-order guard is display hygiene (T-13), not a
judgement: it counts, it never reorders.

## Commits

`feat(symbology): map trust, identification status, age and severity to shapes, tokens and expressions [WP-7 U-M2]`,
`feat(layers): add TrackLayer with per-frame coalescing, trails, forward-only updates and the emergency halo [WP-7 U-M2]`,
`feat(legend): add the track, identification, age and severity legends [WP-7 U-M2]`,
`test(layers): cover out-of-order, backlog, staleness without frames and the broadcast cue [WP-7 U-M2]`.

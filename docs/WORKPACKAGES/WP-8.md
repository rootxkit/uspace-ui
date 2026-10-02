# WP-8: `live` and `status` (reconnecting feed, stores, source and degraded state)

Branch `feat/WP-8-live-status`. Milestone U-M2. Owns `src/live/`,
`src/status/` (except `TrackDetail`, WP-12) exclusively. Depends on
WP-2 (wording), WP-4 (`ApiError`). Consumers: WP-11, WP-12, every
console.

## Read first

1. `docs/PLAN.md` §1.2 D8, §3.1 (`FeedStatus`, `SourceView`,
   `ClearReason`), §3.11, §3.12, §6.3 (the console frame, adopted by all
   four systems: this WP implements the client side of it; the session
   contract: the WebSocket is authenticated by the cookie on a
   same-origin upgrade, `4401` = re-login), §7 (WebSocket
   authentication), §8 (400 frames/s, bounded stores), §14 Q5, Q6
   (decided).
   The JSON Schemas and examples of `envelope/v1`, `console/status/v1`,
   `console/snapshot/v1` and `console/subscribe/v1` live in
   `uspace-lab/schemas/common/` (lab WP-L1); if they exist when this WP
   starts, the mock server's fixtures are those examples, pinned by
   commit; if not, the fixtures are written to PLAN §6.3 and WP-14
   replaces them.
2. Spec `04 §2` (envelope: `schema`, `msg_id`, `ts`, `rx_ts`,
   `captured_at`, `time_source`, `backlog`; "a disabled source's tracks
   age out as `source_disabled`, not silently"), `04 §3.6`
   (`source/status/v1` every 2 s: instances known, enabled, last seen,
   accepted, refused), `05 §5` (`dropped_frames` visible), `05 §6` (a
   process down is shown; consoles freeze with age shown; "nothing hides
   an aircraft"), `02 §1` failure rule, `02 F5` (`degraded: [manned,
   dss]`; `age_s` on stale sources), `02 F4` ("never shows an empty sky
   as clear").
3. LESSONS B-08 (reconnect forever; start degraded; the predecessor's
   console hung on an initial connect that retried sixty times), C-08
   (replay to a console that connects later), C-12, B-03 (`lagging` with
   `lag_s`), B-04 (`unreachable` is not `lost`), B-11 (disabled is not
   silent; `disabled by <who>` differs from silent), E-09, E-10, T-04,
   E-02 (the branch that says nothing is wrong: a feed that is live and
   quiet).
4. Predecessor `utm/web-pilot/src/feed.ts` (reducer shape, history
   ring; its ticket renewal on close 4401 is *not* carried over: the
   reconciled contract has no ticket), `sources.ts` (state precedence:
   disabled wins; age on the adapter's clock plus the browser's leg,
   never comparing the two clocks), `SourcesPanel.tsx`, `TopBar.tsx`
   (connection badge).

## What to build

- `useFeed(opts)`: a WebSocket with exponential backoff and jitter,
  forever (B-08); the socket is opened same-origin so the browser sends
  the `uspace_session` cookie on the upgrade (M22; the kit never puts a
  token in the URL or a subprotocol); `url` may be a function returning
  a promise (a generic seam for an app that computes its path, not a
  ticket); close code 4401 = the session is gone → `onUnauthorized()`
  once per outage (the app re-logins), `connection` goes `down`, the
  backoff continues so a renewed cookie resumes the feed without a
  reload; parses each message as a `ConsoleFrame` (envelope fields
  validated for presence and type; a frame failing that is counted
  `frames_malformed` and dropped, never thrown); dispatches
  `console/status/v1` into `FeedStatus` (`droppedFrames`, `degraded`,
  `policyVersion`, `staleAfterS`, `liveMaxAgeS`, `serverTs` and the
  derived clock offset; the optional extras `datasets{}`,
  `cis_version`, `cis_age_s`, `projection_age_s`, `dp_state`, `nats`,
  `resync_since` kept on the status object for the components and the
  app), `console/snapshot/v1` to the stores given in `opts`, everything
  else to `onFrame`; `connection` state machine
  `connecting → live → down → connecting`, `sinceMs` on each change; a
  `send(frame)` for `console/subscribe/v1`, re-sent on every reconnect.
- `createTrackStore` (bounded, `maxTracks` eviction counted; `upsert`
  stamps `receivedAtMs`; `remove(id, reason)` records the reason in a
  short "recently removed" ring the status panel can show),
  `createAlertStore` (raise/update replace, cleared held with its clear
  numbers for `clearedHoldMs` then dropped; `acknowledged` per console),
  `createSourceStore` (from status frames; `disabled` beats every state;
  `lagging` when the server says so with `lag_s`; `unreachable`;
  `never_heard`; `stale` when `lastSeenAt` on the server's clock is
  older than `staleAfterS` *as the server computed it*, else the kit
  shows "last seen T" without a bucket), `useStore`, `ageS`.
- `status/`: `FeedStatusBar`, `SourceStateBadge`, `SourcesPanel` (the
  switch opens WP-10's `ConfirmDialog` with a mandatory reason; until
  WP-10 lands, a minimal inline dialog in `ui`), `DegradedBanner`,
  `AgeChip`, `FrozenOverlay`.

## Tests

- `useFeed` against an in-process mock WS server (`src/live/test/
  mock-server.ts`, replaying recorded frame sequences from fixtures):
  connect → status frame → `live` (the success path, read what it says,
  E-02); server closes → `down` → reconnect with backoff 1, 2, 4 … capped
  (fake timers; jitter seeded); a 4401 close calls `onUnauthorized`
  exactly once and keeps retrying (a normal close does not call it:
  pair); a reconnect after a 4401 that then receives a status frame
  goes `live` again without a page reload; the socket URL never
  contains a token (assert over every `WebSocket` constructor call);
  100 reconnects
  never give up (loop with fake timers); a malformed frame is counted
  and the next good one is applied (pair); `subscribe` resent on
  reconnect; a `snapshot` replaces the stores (a track absent from the
  snapshot is removed as `resolved`, one present is kept: pair); ten
  minutes live with no frames: `connection` stays `live` and every
  age climbs (the quiet-but-healthy branch); timers restored (E-11).
- Stores: bound exceeded evicts oldest and counts (E-10); cleared alert
  held then dropped at `clearedHoldMs`; `disabled` beats `healthy` and
  `stale` (B-11); `unreachable` and `lagging` are distinct states with
  the right words in both languages (C-12, B-03, B-04); `never_heard`
  for an instance in a status frame with `last_seen: null`.
- `status` components (jsdom, both languages): every `SourceState`
  renders (presence loop) and the text for `disabled` contains the
  `who`; `FeedStatusBar` shows `droppedFrames` when > 0 and shows "0
  dropped" (not nothing) when 0; `DegradedBanner` lists each entry;
  `FrozenOverlay` appears when `down` and shows the age, absent when
  `live` (pair); `DegradedBanner` shows `cis_age_s` and each `datasets{}`
  age when the status frame carries them and nothing about them when it
  does not (pair); `axe` clean.
- Frame conformance: every recorded status, snapshot and subscribe
  fixture validates against the lab's `schemas/common/` JSON Schema when
  `docs/LAB_VERSION` exists (visible skip otherwise, counted in CI).
- Benchmark: 400 frames/s dispatched for 10 s, CPU time reported
  (PLAN §8).
- Browser tests: the status bar in each connection state; the sources panel
  with every state; the degraded banner; the frozen overlay over a map;
  golden DOM snapshots.

## Done when

- [ ] PLAN §3.11, §3.12 implemented; API report updated.
- [ ] The mock-server fixtures include the recorded sequences named in
  PLAN §9 (4401, 60 s silence, backlog burst) and `README.md` in
  `src/live/test/` says how to record a new one from a real system.
- [ ] No default for `staleAfterS` or `liveMaxAgeS` anywhere in `src/live`
  or `src/status` (grep; the props are required or come from the frame).
- [ ] `pnpm check`, `pnpm test`, `pnpm test:browser` outputs in the PR.

## Safety notes

Three lessons were learned the hard way and all three are display rules:
a feed that gives up (B-08) hides the sky; a console that connects after
an alert was raised must get the replay (C-08) and this client must show
it, not de-duplicate it away; and words matter (C-12): `down` is "feed
down, retrying" with the age of the last frame, never "data lost". A
disabled source is shown as disabled by a person (B-11); a silent one as
silent since; the two never look alike.

## Commits

`feat(live): add the reconnect-forever feed client for the console frame [WP-8 U-M2]`,
`feat(live): add bounded track, alert and source stores with counted eviction [WP-8 U-M2]`,
`feat(status): add the feed status bar, source states, degraded banner, age chip and frozen overlay [WP-8 U-M2]`,
`test(live): replay recorded frame sequences including session expiry, silence and backlog [WP-8 U-M2]`.

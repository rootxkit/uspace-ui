# `live` test fixtures

`mock-server.ts` replaces the global `WebSocket` with an in-process mock
whose sockets a test drives as a system's console WebSocket would:
accept, send frames, close with a code, refuse. The client under test is
the code that runs in the browser; only the transport is replaced, so
backoff runs on fake timers to the millisecond.

## `fixtures/lab/`

The examples of `uspace-lab/schemas/common/` (`console/status/v1`,
`console/snapshot/v1`, `console/subscribe/v1`, `envelope/v1`,
`track/telemetry/v1`), copied unchanged at the commit in
`fixtures/lab/LAB_COMMIT`. Prettier ignores them so they stay byte for
byte the lab's. To re-pin: copy the `examples/` directories again from the
lab at the new commit, write the commit to `LAB_COMMIT`, and run
`pnpm test`. The commit is the one in `docs/LAB_VERSION` (WP-14), which
`src/live/frame.test.ts` checks; move both together (`docs/LAB_VERSION`
is written by `scripts/sync-fixtures.sh`).

## `fixtures/sequences/`

Recorded frame sequences that `MockWsServer.replay` plays back. PLAN §9
names three, and they are here:

| File | What it exercises |
|---|---|
| `session-expiry-4401.json` | close 4401, a second 4401 on the next upgrade, then a successful upgrade (re-login without a reload) |
| `silence-60s.json` | an open, healthy socket that sends nothing for 60 s |
| `backlog-burst.json` | a relay draining its queue: live, then backlog samples captured earlier, then live |

No system served the console frame when WP-8 was written, so these three
are **synthetic**: built from the lab examples at `LAB_COMMIT` and marked
so in `recorded_from`. Replace each with a recording once a system serves
`console/status/v1`.

### Format

```json
{
  "name": "silence-60s",
  "recorded_from": "<system>/<process> at <commit or version>, <date>",
  "description": "what happens, in one or two sentences",
  "steps": [
    { "op": "open" },
    { "op": "frame", "lab": "console/status/v1/examples/authority-picture.json" },
    { "op": "frame", "frame": { "schema": "...", "...": "..." } },
    { "op": "text", "text": "not json" },
    { "op": "wait", "ms": 60000 },
    { "op": "close", "code": 4401, "reason": "session expired" },
    { "op": "refuse", "code": 1006 }
  ]
}
```

`open` accepts the next socket the client makes (the replay advances the
fake clock until there is one); `refuse` fails it before it opens; `wait`
is time with no frame; `frame` is one message, either a lab example (with
an optional top-level `patch`) or inline; `text` is a raw message.

### Recording one from a real system

The WebSocket is authenticated by the session cookie on a same-origin
upgrade (PLAN §6.3, M22), so record from the console's own page, signed
in, in a lab or test deployment (never production: spec 06 §4).

1. Open the console in the browser and sign in.
2. In the developer tools console of that page, paste:

   ```js
   const steps = [];
   let last = performance.now();
   const mark = () => {
     const now = performance.now();
     if (now - last >= 50) steps.push({ op: "wait", ms: Math.round(now - last) });
     last = now;
   };
   const ws = new WebSocket(new URL("/v1/picture/ws", location.href).href.replace(/^http/, "ws"));
   ws.onopen = () => { mark(); steps.push({ op: "open" }); };
   ws.onmessage = (e) => { mark(); try { steps.push({ op: "frame", frame: JSON.parse(e.data) }); } catch { steps.push({ op: "text", text: String(e.data) }); } };
   ws.onclose = (e) => { mark(); steps.push({ op: "close", code: e.code, reason: e.reason }); };
   ```

   with the system's own WS path in place of `/v1/picture/ws`.
3. Make the event happen (let the session expire, stop the producer for a
   minute, restart a relay with a queue), then run
   `copy(JSON.stringify({ name: "...", recorded_from: "...", description: "...", steps }, null, 2))`
   and paste into a new file here.
4. Scrub it before committing (CLAUDE.md rule 7): registrations become
   `GEO-TEST-*`, serials and callsigns `TEST*`, people's names in
   `disabled_by_who` become role ids such as `admin:test-1`, positions
   move to the Tbilisi test extract. No token, cookie or hostname may
   remain: the browser does not expose the cookie to the page, and the
   URL is not part of the file.
5. Add a test that replays it and checks what the console must show.

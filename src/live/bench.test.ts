// Benchmark (PLAN §8: 200 tracks x 2 Hz = 400 frames/s into one console,
// parsed and dispatched at < 10 % of one core): 400 track frames a second
// for 10 s of fake time through the real client, the app's adapter and
// the track store, with a status frame every 2 s. The CPU time is
// reported, not gated (PLAN §9: benchmarks are reported); the test only
// checks that every frame arrived.
import { appendFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FeedClient } from "./client.js";
import { resetLiveCountersForTests } from "./counters.js";
import { createTrackStore } from "./trackStore.js";
import { adaptTrack } from "./test/adapters.js";
import { labExample, MockWsServer } from "./test/mock-server.js";

const RATE_HZ = 400;
const SECONDS = 10;
const TRACKS = 200;

beforeEach(() => {
  // The feed's clock is faked; the CPU and wall clocks the report reads
  // are not.
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  vi.setSystemTime(Date.UTC(2026, 9, 2, 9, 15, 6));
  vi.stubGlobal("location", { href: "https://console.example.test/" });
  resetLiveCountersForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

it(`dispatches ${RATE_HZ} frames/s for ${SECONDS} s and reports the CPU time`, () => {
  const server = new MockWsServer().install();
  const store = createTrackStore({ trailPoints: 60, maxTracks: 1000 });
  const client = new FeedClient({
    url: "/ws",
    onFrame: (f) => {
      const t = adaptTrack(f);
      if (t !== null) store.upsert(t);
    },
  });
  client.start();
  server.accept();
  const status = labExample(
    "console/status/v1/examples/authority-picture.json",
  );
  const template = labExample(
    "track/telemetry/v1/examples/authenticated-operator-session.json",
  );
  const body = template["body"] as Record<string, unknown>;
  // Pre-serialised, as they arrive off the wire.
  const total = RATE_HZ * SECONDS;
  const messages: string[] = [];
  for (let i = 0; i < total; i++) {
    const at = new Date(
      Date.UTC(2026, 9, 2, 9, 15, 6) + (i * 1000) / RATE_HZ,
    ).toISOString();
    messages.push(
      JSON.stringify({
        ...template,
        msg_id: `01K6M9S346Q3D25VT4F5V3${String(i).padStart(4, "0")}`,
        rx_ts: at,
        captured_at: at,
        body: {
          ...body,
          track_id: `TEST-TRK-${i % TRACKS}`,
          position: { lat: 41.7 + (i % TRACKS) * 1e-4, lng: 44.8 },
        },
      }),
    );
  }
  const statusText = JSON.stringify(status);
  const socket = server.current;
  const cpu0 = process.cpuUsage();
  const wall0 = performance.now();
  for (let i = 0; i < total; i++) {
    if (i % (RATE_HZ * 2) === 0)
      socket.onmessage?.({ data: statusText } as MessageEvent);
    socket.onmessage?.({ data: messages[i] } as MessageEvent);
    vi.advanceTimersByTime(1000 / RATE_HZ);
  }
  const cpu = process.cpuUsage(cpu0);
  const wallMs = performance.now() - wall0;
  const cpuMs = (cpu.user + cpu.system) / 1000;
  const coreShare = cpuMs / (SECONDS * 1000);
  const line =
    `live bench: ${total} frames in ${SECONDS} s of feed time: CPU ${cpuMs.toFixed(1)} ms ` +
    `(${(coreShare * 100).toFixed(2)} % of one core; budget 10 %), wall ${wallMs.toFixed(1)} ms`;
  // Reported in the run's output and, on CI, in the job summary.
  process.stdout.write(`${line}
`);
  const summary = process.env["GITHUB_STEP_SUMMARY"];
  if (summary !== undefined && summary !== "")
    appendFileSync(
      summary,
      `${line}
`,
    );
  expect(store.snapshot().size).toBe(TRACKS);
  expect(client.getStatus().connection).toBe("live");
  expect(Number.isFinite(coreShare)).toBe(true);
  client.stop();
});

// The console frame parsers against the lab's examples (WP-8; PLAN §6.3,
// CLAUDE.md rule 12), each refusal with its acceptance (E-01); the
// display ages and the backoff arithmetic; and the conformance hook: the
// fixtures validated against the lab's JSON Schemas once docs/LAB_VERSION
// exists (WP-14), a visible skip before.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_BACKOFF, reconnectDelayMs } from "./backoff.js";
import {
  parseFrame,
  parseFrameText,
  parseSnapshotBody,
  parseStatusBody,
  subscribeFrame,
  thresholdUnit,
} from "./frame.js";
import { ageS, utcMs } from "./time.js";
import { FIXTURES, labCommit, labExample } from "./test/mock-server.js";
import { omit } from "./test/omit.js";

const examples = (dir: string, invalid = false): string[] =>
  readdirSync(
    join(FIXTURES, "lab", dir, "examples", ...(invalid ? ["invalid"] : [])),
  )
    .filter((f) => f.endsWith(".json"))
    .map((f) => `${dir}/examples/${invalid ? "invalid/" : ""}${f}`);

describe("parseFrame: the envelope (04 §2, envelope/v1)", () => {
  it.each(examples("envelope/v1"))("accepts %s", (path) => {
    const raw = labExample(path);
    const f = parseFrame(raw);
    expect(f).not.toBeNull();
    expect(f?.schema).toBe(raw["schema"]);
    expect(f?.msgId).toBe(raw["msg_id"]);
    expect(f?.rxTs).toBe(raw["rx_ts"]);
    expect(f?.backlog).toBe(raw["backlog"]);
    expect(f?.body).toEqual(raw["body"]);
  });

  it("keeps a null ts as null and an absent one as null (T-12)", () => {
    const raw = labExample(
      "envelope/v1/examples/manned-frame-without-source-clock.json",
    );
    expect(parseFrame(raw)?.ts).toBeNull();
    const noTs = omit(raw, "ts");
    expect(parseFrame(noTs)?.ts).toBeNull();
  });

  // The envelope checks are presence and type: these lab refusals are of
  // that kind. Pattern refusals (ULID, producer, UTC) are the schema's,
  // checked by WP-14's validator, not here.
  it.each([
    "missing-msg-id",
    "backlog-as-string",
    "body-not-object",
    "unknown-time-source",
  ])("refuses invalid/%s", (name) => {
    expect(
      parseFrame(labExample(`envelope/v1/examples/invalid/${name}.json`)),
    ).toBeNull();
  });

  it("refuses each envelope field of the wrong type, one at a time", () => {
    const good = labExample("envelope/v1/examples/cis-change-frame.json");
    expect(parseFrame(good)).not.toBeNull();
    for (const [k, bad] of [
      ["schema", 1],
      ["schema", ""],
      ["producer", null],
      ["ts", 5],
      ["rx_ts", null],
      ["captured_at", 7],
      ["time_source", "gps"],
      ["backlog", 0],
      ["body", []],
    ] as const) {
      expect(parseFrame({ ...good, [k]: bad }), k).toBeNull();
    }
    expect(parseFrame(null)).toBeNull();
    expect(parseFrame([good])).toBeNull();
  });

  it("parseFrameText: JSON text only", () => {
    const text = JSON.stringify(
      labExample("envelope/v1/examples/cis-change-frame.json"),
    );
    expect(parseFrameText(text)?.schema).toBe("cis/change/v1");
    expect(parseFrameText("{")).toBeNull();
    expect(parseFrameText(new Uint8Array([123]))).toBeNull();
  });
});

describe("parseStatusBody (console/status/v1)", () => {
  it.each(examples("console/status/v1"))("accepts %s", (path) => {
    const raw = labExample(path);
    const body = parseStatusBody(raw["body"]);
    expect(body).not.toBeNull();
    const rb = raw["body"] as Record<string, unknown>;
    expect(body?.staleAfterS).toBe(rb["stale_after_s"]);
    expect(body?.liveMaxAgeS).toBe(rb["live_max_age_s"]);
    expect(body?.sources).toHaveLength((rb["sources"] as unknown[]).length);
  });

  it.each([
    "missing-stale-after-s",
    "zero-live-max-age-s",
    "negative-dropped-frames",
    "source-without-state",
    "dataset-without-age",
  ])("refuses invalid/%s", (name) => {
    const raw = labExample(`console/status/v1/examples/invalid/${name}.json`);
    expect(parseStatusBody(raw["body"])).toBeNull();
  });

  it("reads a source's disabled_by, who, counters and an optional lag_s", () => {
    const raw = labExample(
      "console/status/v1/examples/ansp-feed-disabled-source.json",
    );
    const s = parseStatusBody(raw["body"])?.sources[0];
    expect(s).toEqual({
      source: "ansp_feed",
      sourceInstance: "adsb-tbs",
      state: "disabled",
      since: "2026-10-02T09:00:00.000Z",
      ageS: 906,
      disabledBy: "type",
      disabledByWho: "supervisor:g.kapanadze",
      counters: { accepted: 99812, refused: 0 },
      lagS: null,
    });
    const body = raw["body"] as Record<string, unknown>;
    const src0 = (body["sources"] as Record<string, unknown>[])[0] ?? {};
    const lagging = {
      ...body,
      sources: [{ ...src0, state: "live", disabled_by: null, lag_s: 12.5 }],
    };
    expect(parseStatusBody(lagging)?.sources[0]?.lagS).toBe(12.5);
  });

  it("refuses a disabled_by that does not match the state, either way", () => {
    const raw = labExample("console/status/v1/examples/authority-picture.json");
    const body = raw["body"] as Record<string, unknown>;
    const [live, disabled] = body["sources"] as Record<string, unknown>[];
    expect(
      parseStatusBody({ ...body, sources: [{ ...live, disabled_by: "type" }] }),
    ).toBeNull();
    expect(
      parseStatusBody({
        ...body,
        sources: [{ ...disabled, disabled_by: null }],
      }),
    ).toBeNull();
    expect(
      parseStatusBody({ ...body, sources: [live, disabled] }),
    ).not.toBeNull();
  });

  it("an optional extra of the wrong type refuses the frame; absent is null", () => {
    const body = labExample(
      "console/status/v1/examples/authority-picture.json",
    )["body"] as Record<string, unknown>;
    expect(parseStatusBody({ ...body, cis_age_s: "14" })).toBeNull();
    expect(parseStatusBody({ ...body, nats: "Connected!" })).toBeNull();
    expect(parseStatusBody({ ...body, datasets: [] })).toBeNull();
    const bare = omit(body, "cis_age_s", "nats");
    const p = parseStatusBody(bare);
    expect(p?.cisAgeS).toBeNull();
    expect(p?.nats).toBeNull();
    expect(p?.datasets).toBeNull();
  });
});

describe("parseStatusBody: the thresholds in force (1.0.0, PLAN §14 Q21)", () => {
  const base = (): Record<string, unknown> =>
    labExample("console/status/v1/examples/authority-picture.json")[
      "body"
    ] as Record<string, unknown>;
  // The USSP's traffic stream as uspace-ussp internal/app/trafficws sends
  // it: ThresholdsBody and evaluation_period_s.
  const USSP = {
    cpa_tcpa_max_s: 60,
    cpa_horizontal_min_m: 60,
    cpa_vertical_min_m: 20,
    cpa_neighbour_radius_m: 800,
    cpa_clear_after_s: 10,
    traffic_radius_m: 5000,
  };

  it("reads every threshold and the evaluation period as sent", () => {
    const p = parseStatusBody({
      ...base(),
      thresholds: USSP,
      evaluation_period_s: 0.4,
    });
    expect(p?.thresholds).toEqual(USSP);
    expect(p?.evaluationPeriodS).toBe(0.4);
    expect(p?.ignored).toEqual([]);
  });

  it("has none when the frame sends none (the twin): null, never a default", () => {
    const p = parseStatusBody(base());
    expect(p).not.toBeNull();
    expect(p?.thresholds).toBeNull();
    expect(p?.evaluationPeriodS).toBeNull();
    expect(p?.ignored).toEqual([]);
  });

  it("leaves out a malformed member and names it, and still applies the frame", () => {
    const p = parseStatusBody({
      ...base(),
      thresholds: {
        ...USSP,
        cpa_horizontal_min_m: -1,
        cpa_window: 60,
        cpa_vertical_min_m: "20",
      },
      evaluation_period_s: "fast",
    });
    expect(p).not.toBeNull();
    expect(p?.thresholds).toEqual({
      cpa_tcpa_max_s: 60,
      cpa_neighbour_radius_m: 800,
      cpa_clear_after_s: 10,
      traffic_radius_m: 5000,
    });
    expect(p?.evaluationPeriodS).toBeNull();
    expect(p?.ignored).toEqual([
      "thresholds.cpa_horizontal_min_m",
      "thresholds.cpa_vertical_min_m",
      "thresholds.cpa_window",
      "evaluation_period_s",
    ]);
  });

  it("ignores a thresholds member that is not an object", () => {
    const p = parseStatusBody({ ...base(), thresholds: [60, 60] });
    expect(p?.thresholds).toBeNull();
    expect(p?.ignored).toEqual(["thresholds"]);
  });

  it("thresholdUnit reads the unit off the name, or refuses a name without one", () => {
    expect(thresholdUnit("cpa_tcpa_max_s")).toBe("s");
    expect(thresholdUnit("traffic_radius_m")).toBe("m");
    expect(thresholdUnit("cpa_window")).toBeNull();
    expect(thresholdUnit("Cpa_m")).toBeNull();
  });
});

describe("parseSnapshotBody (console/snapshot/v1)", () => {
  it.each(examples("console/snapshot/v1"))("accepts %s", (path) => {
    const raw = labExample(path);
    const p = parseSnapshotBody(raw["body"]);
    expect(p).not.toBeNull();
    expect(p?.malformedItems).toBe(0);
  });

  it("refuses a missing zones_version; skips an item without an envelope", () => {
    expect(
      parseSnapshotBody(
        labExample(
          "console/snapshot/v1/examples/invalid/missing-zones-version.json",
        )["body"],
      ),
    ).toBeNull();
    const p = parseSnapshotBody(
      labExample(
        "console/snapshot/v1/examples/invalid/track-without-envelope.json",
      )["body"],
    );
    expect(p?.malformedItems).toBe(1);
    expect(
      parseSnapshotBody({
        tracks: [],
        alerts: [],
        manned: [],
        zones_version: 3,
      }),
    ).toBeNull();
    expect(
      parseSnapshotBody({ tracks: [], alerts: [], zones_version: null }),
    ).toBeNull();
  });
});

describe("subscribeFrame (console/subscribe/v1)", () => {
  it.each(examples("console/subscribe/v1"))("rebuilds %s", (path) => {
    const raw = labExample(path) as {
      body: {
        bbox: [number, number, number, number];
        layers: ("tracks" | "manned" | "alerts" | "zones")[];
      };
    };
    const f = subscribeFrame(raw.body.bbox, raw.body.layers);
    expect({ schema: f.schema, body: f.body }).toEqual({
      schema: "console/subscribe/v1",
      body: raw.body,
    });
  });
});

describe("ageS and utcMs", () => {
  const times = {
    ts: null,
    rxTs: "2026-01-01T12:00:00.000Z",
    capturedAt: "2026-01-01T12:00:00.000Z",
    timeSource: "system" as const,
    backlog: false,
  };
  const T = Date.UTC(2026, 0, 1, 12, 0, 0);

  it("received: two readings of the browser clock", () => {
    expect(ageS({ receivedAtMs: T }, T + 4500)).toBe(4.5);
    expect(ageS({ times }, T, "received")).toBeNull();
    expect(ageS({ receivedAtMs: Number.NaN }, T)).toBeNull();
  });

  it("captured: needs the server's offset, else null", () => {
    expect(ageS({ times }, T + 10_000, "captured")).toBeNull();
    expect(ageS({ times }, T + 10_000, "captured", 0)).toBe(10);
    // The server's clock is 2 s ahead of the browser's.
    expect(ageS({ times }, T + 10_000, "captured", 2000)).toBe(12);
    expect(ageS({ receivedAtMs: T }, T, "captured", 0)).toBeNull();
    expect(
      ageS({ times: { ...times, capturedAt: "12:00" } }, T, "captured", 0),
    ).toBeNull();
    expect(ageS({ times }, T, "captured", Number.NaN)).toBeNull();
  });

  it("utcMs reads RFC 3339 UTC with Z only", () => {
    expect(utcMs("2026-01-01T12:00:00.250Z")).toBe(T + 250);
    expect(utcMs("2026-01-01T12:00:00Z")).toBe(T);
    expect(utcMs("2026-01-01T16:00:00+04:00")).toBeNull();
    expect(utcMs(null)).toBeNull();
  });
});

describe("reconnectDelayMs (PLAN §8)", () => {
  it("1, 2, 4 ... capped at 30 s, with equal jitter", () => {
    const top = [0, 1, 2, 3, 4, 5, 6, 60].map((a) =>
      reconnectDelayMs(a, DEFAULT_BACKOFF, 1),
    );
    expect(top).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
    expect(reconnectDelayMs(0, DEFAULT_BACKOFF, 0)).toBe(500);
    expect(reconnectDelayMs(5, DEFAULT_BACKOFF, 0)).toBe(15000);
  });

  it("never NaN, never below 1 ms, whatever it is given", () => {
    expect(reconnectDelayMs(1e9, DEFAULT_BACKOFF, Number.NaN)).toBe(15000);
    expect(reconnectDelayMs(-3, DEFAULT_BACKOFF, 2)).toBe(1000);
    expect(
      reconnectDelayMs(3, { initialMs: 0, maxMs: 0, factor: 2 }, 0.5),
    ).toBe(1);
    expect(
      reconnectDelayMs(2000, { initialMs: 1000, maxMs: 5000, factor: 10 }, 1),
    ).toBe(5000);
  });
});

// --- conformance (WP-14 wires the validator) -------------------------------

const LAB_VERSION = "docs/LAB_VERSION";
const hasLabVersion = existsSync(LAB_VERSION);

describe("frame conformance against uspace-lab/schemas/common", () => {
  it("the fixtures are pinned to a lab commit", () => {
    expect(labCommit()).toMatch(/^[0-9a-f]{40}$/);
  });

  // WP-14 pinned the lab in docs/LAB_VERSION (its first line); these
  // examples are the same commit's (re-pin both with
  // scripts/sync-fixtures.sh and src/live/test/README.md).
  it.skipIf(!hasLabVersion)(
    "the fixtures are the examples of the pinned lab commit (needs docs/LAB_VERSION)",
    () => {
      const pinned = readFileSync(LAB_VERSION, "utf8")
        .split("\n")
        .find((l) => l.trim() !== "" && !l.startsWith("#"));
      expect(pinned).toBe(labCommit());
    },
  );
  it.todo(
    "every recorded status, snapshot and subscribe frame validates against the lab's JSON Schema (WP-14)",
  );
});

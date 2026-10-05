// The conformance hook of spec 04 §4 for the kit (WP-14): every lab
// example decodes through the reference adapters without an unknown
// enumeration value (a value the kit cannot name fails here), and every
// value of a `model` enumeration appears in at least one example, or is
// listed below as a visible skip naming what the lab should add (the lab
// owns coverage; the kit reports it). A message whose body leaves out a
// member its schema requires is listed the same way, as a lab issue.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseFrame } from "../live/frame.js";
import * as model from "../model/index.js";
import type {
  AlertView,
  MannedView,
  SourceView,
  TrackView,
  ZoneView,
} from "../model/index.js";
import { adaptTelemetry } from "./adapters/track.js";
import { fixtures } from "./fixtures.js";
import { LAB_EXAMPLES } from "./labExamples.generated.js";
import {
  LAB_COMMIT,
  labDecodings,
  labUnhandled,
  type LabDecoding,
} from "./labFixtures.js";

const decodings = labDecodings();

// The examples that leave out a member their schema requires, as PLAN
// §14 Q22 (2) records them: the only refusals that are a visible skip.
// Any other refusal fails, a missing member included, and an example
// listed here that decodes, or refuses another field, fails too.
const KNOWN_LAB_ISSUES: readonly {
  example: string;
  schema: string;
  field: string;
}[] = [
  {
    example: "lab/console/snapshot/v1/authority-picture.json#alerts[0]",
    schema: "violation/v1",
    field: "severity",
  },
  {
    example: "lab/console/snapshot/v1/authority-picture.json#manned[0]",
    schema: "track/manned/v1",
    field: "position",
  },
  {
    example: "lab/envelope/v1/manned-frame-without-source-clock.json",
    schema: "track/manned/v1",
    field: "position",
  },
];

/** A refusal PLAN §14 Q22 lists: a member left out, on the list above. */
const knownLabIssue = (d: LabDecoding): boolean =>
  !d.result.ok &&
  d.result.value === undefined &&
  KNOWN_LAB_ISSUES.some(
    (k) =>
      k.example === d.example &&
      k.schema === d.schema &&
      !d.result.ok &&
      k.field === d.result.field,
  );

describe("the lab fixtures are pinned", () => {
  it("to the lab commit in docs/LAB_VERSION and in the fixtures' VERSION", () => {
    const pinned = readFileSync("docs/LAB_VERSION", "utf8")
      .split(/\r?\n/)
      .find((l) => l.trim() !== "" && !l.startsWith("#"));
    expect(pinned).toBe(LAB_COMMIT);
    expect(readFileSync("src/test/fixtures/VERSION", "utf8")).toContain(
      `uspace_lab_commit = ${LAB_COMMIT}`,
    );
  });

  it("and the generated module is what the files generate", () => {
    const out = execFileSync(
      process.execPath,
      ["scripts/gen-lab-fixtures.mjs", "--check"],
      { encoding: "utf8" },
    );
    expect(out).toMatch(/is current/);
  });
});

describe("every lab example decodes through the reference adapters", () => {
  it("decodes something from every source", () => {
    const schemas = new Set(decodings.map((d) => d.schema));
    for (const s of [
      "track/telemetry/v1",
      "track/manned/v1",
      "alert/v1",
      "source/status/v1",
      "console/status/v1",
      "zone/applicable/v1",
      "cis/change/v1",
      "ed318",
    ])
      expect(schemas, s).toContain(s);
  });

  it("counts, and does not report as decoded, a schema no adapter catalogues", () => {
    // coordination/annex_v/v1 (envelope/v1 `lab-backlog-frame`)
    // has no view model; the live feed passes it to onFrame and counts it.
    expect(labUnhandled()).toEqual({ "coordination/annex_v/v1": 1 });
    expect(decodings.map((d) => d.schema)).not.toContain(
      "coordination/annex_v/v1",
    );
  });

  it("still refuses each example PLAN §14 Q22 lists, on the field it names", () => {
    for (const k of KNOWN_LAB_ISSUES) {
      const d = decodings.filter(
        (x) => x.example === k.example && x.schema === k.schema,
      );
      expect(d, k.example).toHaveLength(1);
      expect(d[0]?.result, k.example).toEqual({
        ok: false,
        field: k.field,
        value: undefined,
        reason: expect.any(String) as unknown,
      });
    }
  });

  it("skips only the listed examples: another missing member is a failure", () => {
    const listed = KNOWN_LAB_ISSUES[0];
    const refused = (example: string, field: string): LabDecoding => ({
      example,
      schema: "violation/v1",
      result: { ok: false, field, value: undefined, reason: "missing" },
    });
    expect(knownLabIssue(refused(listed?.example ?? "", "severity"))).toBe(
      true,
    );
    expect(
      knownLabIssue(refused("lab/violation/v1/new.json", "severity")),
    ).toBe(false);
    expect(knownLabIssue(refused(listed?.example ?? "", "kind"))).toBe(false);
  });

  for (const d of decodings) {
    if (knownLabIssue(d) && !d.result.ok) {
      it.skip(`LAB ISSUE: ${d.example} (${d.schema}) has no ${d.result.field}, which its schema requires; ask the lab to complete the example`, () => {});
      continue;
    }
    it(`${d.example} (${d.schema})`, () => {
      expect(
        d.result.ok
          ? null
          : `${d.result.field}: ${d.result.reason} (${JSON.stringify(d.result.value)})`,
      ).toBeNull();
    });
  }
});

describe("a value the kit cannot name is refused, naming the field (the twin)", () => {
  it("a telemetry example with an unknown trust class", () => {
    const raw = LAB_EXAMPLES[
      "lab/track/telemetry/v1/authenticated-operator-session.json"
    ] as { body: Record<string, unknown> };
    const doctored = parseFrame({
      ...raw,
      body: { ...raw.body, trust: "satellite" },
    });
    expect(doctored).not.toBeNull();
    const a = adaptTelemetry(doctored as NonNullable<typeof doctored>);
    expect(a).toMatchObject({ ok: false, field: "trust", value: "satellite" });
    const plain = parseFrame(raw);
    expect(adaptTelemetry(plain as NonNullable<typeof plain>).ok).toBe(true);
  });
});

// --- enumeration coverage ------------------------------------------------------

const lab = fixtures({ source: "lab" });
const seen = (values: Iterable<unknown>): Set<string> =>
  new Set([...values].filter((v): v is string => typeof v === "string"));
// Coverage is counted over every decoded message, before fixtures() keeps
// one view per id (an alert's raise, update and clear share an id).
const decoded = <T>(schemas: readonly string[]): T[] =>
  decodings.flatMap((d) =>
    schemas.includes(d.schema) && d.result.ok ? [d.result.value as T] : [],
  );
const tracks = decoded<Omit<TrackView, "receivedAtMs">>(["track/telemetry/v1"]);
const manned = decoded<Omit<MannedView, "receivedAtMs"> & { trust?: string }>([
  "track/manned/v1",
]);
const alerts = decoded<Omit<AlertView, "receivedAtMs" | "acknowledged">>([
  "alert/v1",
  "violation/v1",
]);
const zones = decoded<ZoneView[]>(["ed318"]).flat();
const sources = [
  ...decoded<SourceView>(["source/status/v1"]),
  ...decoded<{ sources: SourceView[] }>(["console/status/v1"]).flatMap(
    (s) => s.sources,
  ),
];

const COVERAGE: Record<string, { all: readonly string[]; seen: Set<string> }> =
  {
    Trust: {
      all: model.TRUSTS,
      seen: seen([
        ...tracks.map((t) => t.trust),
        ...manned.map((m) => m.trust),
      ]),
    },
    AltSource: {
      all: model.ALT_SOURCES,
      seen: seen(tracks.map((t) => t.altSource)),
    },
    TimeSource: {
      all: model.TIME_SOURCES,
      seen: seen([...tracks, ...manned].map((t) => t.times.timeSource)),
    },
    IdentStatus: {
      all: model.IDENT_STATUSES,
      seen: seen(tracks.map((t) => t.identification?.status)),
    },
    IdentReason: {
      all: model.IDENT_REASONS,
      seen: seen(tracks.map((t) => t.identification?.reason)),
    },
    IdentBasis: {
      all: model.IDENT_BASES,
      seen: seen(tracks.map((t) => t.identification?.basis)),
    },
    Severity: {
      all: model.SEVERITIES,
      seen: seen(alerts.map((a) => a.severity)),
    },
    AlertKind: {
      all: model.ALERT_KINDS,
      seen: seen(alerts.map((a) => a.kind)),
    },
    ViolationKind: {
      all: model.VIOLATION_KINDS,
      seen: seen(alerts.map((a) => a.kind)),
    },
    AlertState: {
      all: model.ALERT_STATES,
      seen: seen(alerts.map((a) => a.state)),
    },
    ClearReason: {
      all: model.CLEAR_REASONS,
      seen: seen(alerts.map((a) => a.clearReason)),
    },
    ZoneType: { all: model.ZONE_TYPES, seen: seen(zones.map((z) => z.type)) },
    VerticalRef: {
      all: model.VERTICAL_REFS,
      seen: seen(zones.flatMap((z) => [z.lowerRef, z.upperRef])),
    },
    SourceState: {
      all: model.SOURCE_STATES,
      seen: seen(sources.map((s) => s.state)),
    },
    DisabledBy: {
      all: model.DISABLED_BYS,
      seen: seen(sources.map((s) => s.disabledBy)),
    },
  };

describe("every model enumeration value appears in a lab example", () => {
  const missing: string[] = [];
  for (const [name, c] of Object.entries(COVERAGE)) {
    for (const v of c.all) {
      if (c.seen.has(v)) continue;
      missing.push(`${name} "${v}"`);
      it.skip(`NOT IN THE LAB'S EXAMPLES: ${name} "${v}" (the lab owns coverage: an example carrying it belongs in uspace-lab/schemas)`, () => {});
    }
  }
  it("reports what it found and what is missing", () => {
    if (missing.length > 0)
      console.warn(
        `fixtures.lab: ${String(missing.length)} enumeration values appear in no lab example: ${missing.join(", ")}`,
      );
    // Something of every enumeration is covered: an empty set means the
    // adapters read the wrong field, not a gap in the lab.
    for (const [name, c] of Object.entries(COVERAGE))
      if (name !== "ViolationKind" && name !== "RestrictionState")
        expect(c.seen.size, name).toBeGreaterThan(0);
  });
});

describe('fixtures({ source: "lab" })', () => {
  it("has every kind of view and is deterministic", () => {
    expect(lab.tracks.length).toBeGreaterThan(0);
    expect(lab.manned.length).toBeGreaterThan(0);
    expect(lab.alerts.length).toBeGreaterThan(0);
    expect(lab.sources.length).toBeGreaterThan(0);
    expect(lab.zones.length).toBe(5);
    expect(lab.status.staleAfterS).toBeGreaterThan(0);
    expect(fixtures({ source: "lab" })).toEqual(lab);
  });

  it("is not the synthetic set (the twin)", () => {
    const synthetic = fixtures();
    expect(synthetic.tracks.every((t) => t.trackId.startsWith("TEST-"))).toBe(
      true,
    );
    expect(lab.tracks.some((t) => t.trackId.startsWith("TEST-"))).toBe(false);
  });

  it("keeps an unknown as null: no limit in feet is converted", () => {
    const d = lab.zones.find((z) => z.identifier === "TSD001");
    expect(d?.upperRef).toBe("AMSL");
    expect(d?.upperLimitM).toBeNull();
    const u = lab.zones.find((z) => z.identifier === "TSU001");
    expect(u?.upperLimitM).toBe(300);
    expect(u?.upperRef).toBe("WGS84");
  });
});

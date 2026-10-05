// The lab-derived fixtures (WP-14; PLAN §3.18, §9 conformance hooks): the
// schema examples of uspace-lab (and, until the lab mirrors them, of the
// owning systems) at the commits pinned in src/test/fixtures/VERSION,
// decoded through the reference adapters a `web/` would write. Every
// example is decoded; `labDecodings()` reports each one, and
// `labFixtures()` builds the Fixtures shape from those that decoded, so a
// component test renders what the bus actually carries.
import { parseFrame, type ConsoleFrame } from "../live/frame.js";
import { utcMs } from "../live/time.js";
import type {
  AlertView,
  MannedView,
  SourceView,
  TrackView,
  ZoneView,
} from "../model/types.js";
import { adaptAlert } from "./adapters/alert.js";
import type { Adapted } from "./adapters/result.js";
import { adaptSourceFrame, adaptStatus } from "./adapters/status.js";
import { adaptManned, adaptTelemetry } from "./adapters/track.js";
import {
  adaptApplicability,
  adaptCisChange,
  adaptEd318Collection,
} from "./adapters/zone.js";
import type { Fixtures } from "./fixtures.js";
import {
  ED318_ACCEPTED,
  LAB_COMMIT,
  LAB_EXAMPLES,
} from "./labExamples.generated.js";

export { LAB_COMMIT };

/**
 * What one example (or one item of a snapshot) decoded to.
 *
 * @public
 */
export interface LabDecoding {
  /** The example's path under src/test/fixtures/, with `#tracks[0]` for a snapshot item. */
  example: string;
  schema: string;
  result: Adapted<unknown>;
}

const rxMs = (f: ConsoleFrame): number => utcMs(f.rxTs) ?? 0;

function decode(example: string, raw: unknown): LabDecoding[] {
  const f = parseFrame(raw);
  if (f === null)
    return [
      {
        example,
        schema: "envelope/v1",
        result: {
          ok: false,
          field: "envelope",
          value: raw,
          reason: "not an envelope/v1 frame",
        },
      },
    ];
  const one = (result: Adapted<unknown>): LabDecoding[] => [
    { example, schema: f.schema, result },
  ];
  switch (f.schema) {
    case "track/telemetry/v1":
      return one(adaptTelemetry(f));
    case "track/manned/v1":
      return one(adaptManned(f));
    case "alert/v1":
    case "violation/v1":
      return one(adaptAlert(f));
    case "source/status/v1":
      return one(adaptSourceFrame(f));
    case "console/status/v1":
      return one(adaptStatus(f, rxMs(f)));
    case "zone/applicable/v1":
      return one(adaptApplicability(f));
    case "cis/change/v1":
      return one(adaptCisChange(f));
    case "console/snapshot/v1": {
      const body = f.body as Record<string, unknown>;
      const out: LabDecoding[] = [];
      for (const key of ["tracks", "alerts", "manned"] as const) {
        const items = Array.isArray(body[key]) ? (body[key] as unknown[]) : [];
        items.forEach((item, i) => {
          out.push(...decode(`${example}#${key}[${String(i)}]`, item));
        });
      }
      return out;
    }
    default:
      // A schema the reference adapters do not catalogue: the live feed
      // passes it to onFrame untouched (PLAN §6.3), so it decodes as is.
      return one({ ok: true, value: f });
  }
}

/**
 * Every vendored example, decoded; the ED-318 documents last.
 *
 * @public
 */
export function labDecodings(): LabDecoding[] {
  const out: LabDecoding[] = [];
  for (const [path, raw] of Object.entries(LAB_EXAMPLES))
    out.push(...decode(path, raw));
  for (const doc of ED318_ACCEPTED)
    out.push({
      example: `lab/vectors/ed318_roundtrip.json#${doc.name}`,
      schema: "ed318",
      result: adaptEd318Collection(doc.document),
    });
  return out;
}

function frames(prefix: string): ConsoleFrame[] {
  const out: ConsoleFrame[] = [];
  for (const [path, raw] of Object.entries(LAB_EXAMPLES)) {
    if (!path.startsWith(prefix)) continue;
    const f = parseFrame(raw);
    if (f !== null) out.push(f);
  }
  return out;
}

const okValues = <T>(xs: readonly Adapted<T>[]): T[] =>
  xs.flatMap((x) => (x.ok ? [x.value] : []));

function byId<T>(xs: readonly T[], id: (x: T) => string): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = id(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * The Fixtures shape built from the lab's examples (deterministic).
 *
 * @public
 */
export function labFixtures(): Fixtures {
  const snapshotItems = (key: "tracks" | "alerts" | "manned") =>
    frames("lab/console/snapshot/").flatMap((s) => {
      const items = (s.body as Record<string, unknown>)[key];
      return (Array.isArray(items) ? items : []).flatMap((i) => {
        const f = parseFrame(i);
        return f === null ? [] : [f];
      });
    });
  const tracks: TrackView[] = byId(
    [...frames("lab/track/telemetry/"), ...snapshotItems("tracks")].flatMap(
      (f) => {
        const a = adaptTelemetry(f);
        return a.ok ? [{ ...a.value, receivedAtMs: rxMs(f) }] : [];
      },
    ),
    (t) => t.trackId,
  );
  const manned: MannedView[] = byId(
    [...frames("ansp/track/manned/"), ...snapshotItems("manned")].flatMap(
      (f) => {
        const a = adaptManned(f);
        return a.ok ? [{ ...a.value, receivedAtMs: rxMs(f) }] : [];
      },
    ),
    (m) => m.trackId,
  );
  const alerts: AlertView[] = byId(
    [...frames("ussp/alert/"), ...snapshotItems("alerts")].flatMap((f) => {
      const a = adaptAlert(f);
      return a.ok
        ? [{ ...a.value, acknowledged: false, receivedAtMs: rxMs(f) }]
        : [];
    }),
    (a) => a.alertId,
  );
  const statusFrame = frames("lab/console/status/v1/authority-picture").at(0);
  const status =
    statusFrame === undefined
      ? null
      : adaptStatus(statusFrame, rxMs(statusFrame));
  if (status === null || !status.ok)
    throw new Error(
      "labFixtures: the lab's authority-picture status does not decode",
    );
  const sources: SourceView[] = [
    ...okValues(frames("lab/source/status/").map(adaptSourceFrame)),
    ...status.value.sources,
  ];
  const zones: ZoneView[] = ED318_ACCEPTED.flatMap((d) => {
    const z = adaptEd318Collection(d.document);
    return z.ok ? z.value : [];
  });
  return {
    tracks,
    zones,
    alerts,
    manned,
    sources,
    status: status.value.status,
  };
}

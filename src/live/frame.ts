// The console frame (docs/PLAN.md §6.3, D8; decision record M29, Appendix
// C): the common envelope of spec 04 §2 plus a `body` named by `schema`.
// The schemas are owned by `uspace-lab/schemas/common/` (`envelope/v1`,
// `console/status/v1`, `console/snapshot/v1`, `console/subscribe/v1`);
// this file reads them as written there and nothing else (CLAUDE.md rule
// 12). A frame that breaks them is refused here and counted by the caller,
// never thrown and never repaired.
import {
  isDisabledBy,
  isTimeSource,
  type DisabledBy,
  type TimeSource,
} from "../model/index.js";

/**
 * The frame schemas the kit itself understands (PLAN §6.3).
 *
 * @beta
 */
export const STATUS_SCHEMA = "console/status/v1";
/** @beta */
export const SNAPSHOT_SCHEMA = "console/snapshot/v1";
/** @public */
export const SUBSCRIBE_SCHEMA = "console/subscribe/v1";

/**
 * One frame from a system's WebSocket: the 04 §2 envelope in camel case
 * plus the untouched `body` (`envelope/v1`). `ts` is null when the record
 * carried no source clock (T-12).
 *
 * @public
 */
export interface ConsoleFrame {
  schema: string;
  msgId: string;
  producer: string;
  ts: string | null;
  rxTs: string;
  capturedAt: string | null;
  timeSource: TimeSource;
  backlog: boolean;
  body: unknown;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNonEmpty = (v: unknown): v is string => isStr(v) && v.length > 0;
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isPositive = (v: unknown): v is number => isNum(v) && v > 0;
const isNonNegative = (v: unknown): v is number => isNum(v) && v >= 0;
const isCount = (v: unknown): v is number =>
  isNonNegative(v) && Number.isInteger(v);

/**
 * The envelope of `raw`, checked for presence and type field by field
 * (`envelope/v1` required members): `schema`, `msg_id`, `producer`,
 * `rx_ts` strings; `ts` a string, null or absent; `captured_at` a string
 * or null; `time_source` one of `core.TimeSource`; `backlog` a boolean;
 * `body` an object. Null when any of them fails: the frame is malformed.
 *
 * @public
 */
export function parseFrame(raw: unknown): ConsoleFrame | null {
  if (!isObj(raw)) return null;
  const {
    schema,
    msg_id,
    producer,
    ts,
    rx_ts,
    captured_at,
    time_source,
    backlog,
    body,
  } = raw;
  if (!isNonEmpty(schema) || !isNonEmpty(msg_id) || !isNonEmpty(producer))
    return null;
  if (ts !== undefined && ts !== null && !isStr(ts)) return null;
  if (!isStr(rx_ts)) return null;
  if (captured_at !== null && !isStr(captured_at)) return null;
  if (!isTimeSource(time_source)) return null;
  if (typeof backlog !== "boolean") return null;
  if (!isObj(body)) return null;
  return {
    schema,
    msgId: msg_id,
    producer,
    ts: ts ?? null,
    rxTs: rx_ts,
    capturedAt: captured_at,
    timeSource: time_source,
    backlog,
    body,
  };
}

/**
 * A WebSocket message's data as a frame: text holding JSON, then parseFrame.
 *
 * @public
 */
export function parseFrameText(data: unknown): ConsoleFrame | null {
  if (typeof data !== "string") return null;
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  return parseFrame(raw);
}

// --- console/status/v1 -----------------------------------------------------

/**
 * `source/status/v1` `state` (lab schema): the wire's words, not the kit's.
 *
 * @public
 */
export type WireSourceState =
  "live" | "stale" | "disabled" | "down" | "unknown";

const WIRE_SOURCE_STATES: ReadonlySet<string> = new Set([
  "live",
  "stale",
  "disabled",
  "down",
  "unknown",
]);

/**
 * One item of `sources[]`: a `source/status/v1` body (04 §3.6).
 *
 * @public
 */
export interface StatusSource {
  source: string;
  /** Null for the status of the adapter type as a whole. */
  sourceInstance: string | null;
  state: WireSourceState;
  /** When the source entered `state`, on the server's clock. */
  since: string;
  /** Seconds since its newest record, on the server's clock; null: never heard. */
  ageS: number | null;
  disabledBy: DisabledBy | null;
  disabledByWho: string | null;
  /** At least `accepted` and `refused`; further non-negative counters. */
  counters: Readonly<Record<string, number>>;
  /**
   * How far behind the source is, when the server says so. Not in
   * `source/status/v1` yet (spec gap, PR of WP-8): read when present,
   * otherwise null, and never derived.
   */
  lagS: number | null;
}

/**
 * A CISP dataset's version and age (`datasets{}`).
 *
 * @public
 */
export interface DatasetAge {
  version: string;
  ageS: number;
}

/**
 * The optional per-system extras of a status frame (PLAN §6.3, M29).
 *
 * `thresholds` and `evaluationPeriodS` (1.0.0): the thresholds a system's
 * monitor judges with, as the status frame carries them (the USSP's
 * traffic stream: `thresholds{cpa_tcpa_max_s, cpa_horizontal_min_m, ...}`
 * and `evaluation_period_s`; uspace-ussp `internal/app/trafficws`). Not
 * named in the lab's `console/status/v1` yet (PLAN §14 Q21), so the kit
 * reads them leniently: a member whose name does not end in its unit
 * (`_s`, `_m`) or whose value is not a finite number >= 0 is left out
 * and named in `ignored`, and the rest of the frame still applies. The
 * kit shows them (`status/ThresholdsPanel`); it never defaults one and
 * never judges with one (INV-03).
 *
 * @public
 */
export interface StatusExtras {
  datasets: Readonly<Record<string, DatasetAge>> | null;
  cisVersion: string | null;
  cisAgeS: number | null;
  projectionAgeS: number | null;
  dpState: string | null;
  nats: string | null;
  resyncSince: string | null;
  /** Threshold name (wire spelling, unit suffix) to value; null: none sent. */
  thresholds: Readonly<Record<string, number>> | null;
  /** The CPA evaluation period the system reports; null: not sent. */
  evaluationPeriodS: number | null;
}

/** @beta */
export const NO_EXTRAS: StatusExtras = Object.freeze({
  datasets: null,
  cisVersion: null,
  cisAgeS: null,
  projectionAgeS: null,
  dpState: null,
  nats: null,
  resyncSince: null,
  thresholds: null,
  evaluationPeriodS: null,
});

/** A threshold's name: a snake_case slug that ends in its unit. */
const THRESHOLD_NAME = /^[a-z][a-z0-9_]*_(s|m)$/;

/**
 * The unit a threshold's name ends in (`_s` seconds, `_m` metres).
 *
 * @beta
 */
export function thresholdUnit(name: string): "s" | "m" | null {
  const m = THRESHOLD_NAME.exec(name);
  return m === null ? null : (m[1] as "s" | "m");
}

/**
 * A `console/status/v1` body (lab schema), every required member checked.
 *
 * @public
 */
export interface StatusBody extends StatusExtras {
  connectionId: string;
  serverTs: string;
  policyVersion: string;
  staleAfterS: number;
  liveMaxAgeS: number;
  droppedFrames: number;
  degraded: string[];
  sources: StatusSource[];
  /**
   * Extras left out because they were malformed (`thresholds`,
   * `thresholds.<name>`, `evaluation_period_s`); the client counts them.
   */
  ignored: readonly string[];
}

/**
 * One `source/status/v1` body (04 §3.6), on its own or as an item of a
 * status frame's `sources[]`; null when it breaks the lab schema.
 *
 * @beta
 */
export function parseStatusSource(raw: unknown): StatusSource | null {
  if (!isObj(raw)) return null;
  const { source, source_instance, state, since, age_s, counters } = raw;
  if (!isNonEmpty(source)) return null;
  if (source_instance !== null && !isNonEmpty(source_instance)) return null;
  if (!isStr(state) || !WIRE_SOURCE_STATES.has(state)) return null;
  if (!isStr(since)) return null;
  if (age_s !== null && !isNonNegative(age_s)) return null;
  // `disabled_by` is non-null exactly when the state is `disabled`.
  const by = raw["disabled_by"];
  if (state === "disabled" ? !isDisabledBy(by) : by !== null) return null;
  const who = raw["disabled_by_who"];
  if (who !== undefined && who !== null && !isStr(who)) return null;
  if (!isObj(counters)) return null;
  if (!isCount(counters["accepted"]) || !isCount(counters["refused"]))
    return null;
  const counted: Record<string, number> = {};
  for (const [k, v] of Object.entries(counters)) {
    if (!isCount(v)) return null;
    counted[k] = v;
  }
  const lag = raw["lag_s"];
  return {
    source,
    sourceInstance: source_instance,
    state: state as WireSourceState,
    since,
    ageS: age_s,
    disabledBy: isDisabledBy(by) ? by : null,
    disabledByWho: isStr(who) ? who : null,
    counters: counted,
    lagS: isNonNegative(lag) ? lag : null,
  };
}

function optional<T>(
  raw: Obj,
  key: string,
  check: (v: unknown) => v is T,
): T | null | undefined {
  // undefined: present and wrong; null: absent.
  if (!Object.hasOwn(raw, key)) return null;
  const v = raw[key];
  return check(v) ? v : undefined;
}

const isSlug = (v: unknown): v is string =>
  isStr(v) && /^[a-z][a-z0-9_]*$/.test(v);

/**
 * A `console/status/v1` body, or null when it breaks the lab schema: a
 * required member missing or of the wrong type, a threshold that is not
 * positive (LESSONS E-15: zero is refused), a negative count, a source
 * without a state, a dataset without an age. A refused status frame is
 * not applied at all: the kit never fills in a threshold.
 *
 * @public
 */
export function parseStatusBody(raw: unknown): StatusBody | null {
  if (!isObj(raw)) return null;
  const {
    connection_id,
    server_ts,
    policy_version,
    stale_after_s,
    live_max_age_s,
    dropped_frames,
    degraded,
    sources,
  } = raw;
  if (!isNonEmpty(connection_id) || !isStr(server_ts)) return null;
  if (!isNonEmpty(policy_version)) return null;
  if (!isPositive(stale_after_s) || !isPositive(live_max_age_s)) return null;
  if (!isCount(dropped_frames)) return null;
  if (!Array.isArray(degraded) || !degraded.every(isSlug)) return null;
  if (!Array.isArray(sources)) return null;
  const parsed: StatusSource[] = [];
  for (const s of sources) {
    const p = parseStatusSource(s);
    if (p === null) return null;
    parsed.push(p);
  }
  let datasets: Record<string, DatasetAge> | null = null;
  if (Object.hasOwn(raw, "datasets")) {
    const d = raw["datasets"];
    if (!isObj(d)) return null;
    datasets = {};
    for (const [name, v] of Object.entries(d)) {
      if (!isObj(v) || !isNonEmpty(v["version"]) || !isNonNegative(v["age_s"]))
        return null;
      datasets[name] = { version: v["version"], ageS: v["age_s"] };
    }
  }
  const cisVersion = optional(raw, "cis_version", isNonEmpty);
  const cisAgeS = optional(raw, "cis_age_s", isNonNegative);
  const projectionAgeS = optional(raw, "projection_age_s", isNonNegative);
  const dpState = optional(raw, "dp_state", isSlug);
  const nats = optional(raw, "nats", isSlug);
  const resyncSince = optional(raw, "resync_since", isStr);
  if (
    cisVersion === undefined ||
    cisAgeS === undefined ||
    projectionAgeS === undefined ||
    dpState === undefined ||
    nats === undefined ||
    resyncSince === undefined
  )
    return null;
  const ignored: string[] = [];
  let thresholds: Record<string, number> | null = null;
  if (Object.hasOwn(raw, "thresholds")) {
    const th = raw["thresholds"];
    if (!isObj(th)) {
      ignored.push("thresholds");
    } else {
      thresholds = {};
      for (const [name, v] of Object.entries(th)) {
        if (thresholdUnit(name) !== null && isNonNegative(v))
          thresholds[name] = v;
        else ignored.push(`thresholds.${name}`);
      }
    }
  }
  let evaluationPeriodS = optional(raw, "evaluation_period_s", isNonNegative);
  if (evaluationPeriodS === undefined) {
    ignored.push("evaluation_period_s");
    evaluationPeriodS = null;
  }
  return {
    connectionId: connection_id,
    serverTs: server_ts,
    policyVersion: policy_version,
    staleAfterS: stale_after_s,
    liveMaxAgeS: live_max_age_s,
    droppedFrames: dropped_frames,
    degraded: [...(degraded as string[])],
    sources: parsed,
    datasets,
    cisVersion,
    cisAgeS,
    projectionAgeS,
    dpState,
    nats,
    resyncSince,
    thresholds,
    evaluationPeriodS,
    ignored,
  };
}

// --- console/snapshot/v1 ---------------------------------------------------

/**
 * A `console/snapshot/v1` body: each item a complete frame with its own
 * envelope (the lab schema), so each track keeps its own times.
 *
 * @beta
 */
export interface SnapshotBody {
  tracks: ConsoleFrame[];
  alerts: ConsoleFrame[];
  manned: ConsoleFrame[];
  zonesVersion: string | null;
}

/**
 * A snapshot body, or null when a collection is missing or `zones_version`
 * is neither a string nor null. An item that is not a frame is skipped and
 * counted in `malformedItems`; the rest of the snapshot still applies.
 *
 * @beta
 */
export function parseSnapshotBody(
  raw: unknown,
): { body: SnapshotBody; malformedItems: number } | null {
  if (!isObj(raw)) return null;
  const { tracks, alerts, manned, zones_version } = raw;
  if (
    !Array.isArray(tracks) ||
    !Array.isArray(alerts) ||
    !Array.isArray(manned)
  )
    return null;
  if (!Object.hasOwn(raw, "zones_version")) return null;
  if (zones_version !== null && !isNonEmpty(zones_version)) return null;
  let malformedItems = 0;
  const frames = (items: unknown[]): ConsoleFrame[] => {
    const out: ConsoleFrame[] = [];
    for (const item of items) {
      const f = parseFrame(item);
      if (f === null) malformedItems += 1;
      else out.push(f);
    }
    return out;
  };
  return {
    body: {
      tracks: frames(tracks),
      alerts: frames(alerts),
      manned: frames(manned),
      zonesVersion: zones_version,
    },
    malformedItems,
  };
}

// --- console/subscribe/v1 --------------------------------------------------

/**
 * The snapshot collections a console subscribes to (lab schema).
 *
 * @public
 */
export type SubscribeLayer = "tracks" | "manned" | "alerts" | "zones";

/**
 * `[west, south, east, north]`, WGS84 degrees; `west > east` crosses 180°.
 *
 * @public
 */
export type BBox = readonly [number, number, number, number];

/**
 * The one client-to-server frame (`console/subscribe/v1`).
 *
 * @public
 */
export interface SubscribeFrame {
  schema: typeof SUBSCRIBE_SCHEMA;
  body: { bbox: BBox; layers: readonly SubscribeLayer[] };
}

/**
 * A subscribe frame for `bbox` (as the map gave it) and `layers`.
 *
 * @public
 */
export function subscribeFrame(
  bbox: BBox,
  layers: readonly SubscribeLayer[],
): SubscribeFrame {
  return {
    schema: SUBSCRIBE_SCHEMA,
    body: { bbox: [bbox[0], bbox[1], bbox[2], bbox[3]], layers: [...layers] },
  };
}

// Reference adapters for the status side (WP-14): a `source/status/v1`
// body (lab schemas/common, 04 §3.6) to a SourceView, and a
// `console/status/v1` frame to the FeedStatus a status bar renders. The
// kit's own parsers do the reading (`live`); the adapter only maps.
import {
  parseStatusBody,
  parseStatusSource,
  type ConsoleFrame,
} from "../../live/frame.js";
import { sourceStateOf } from "../../live/sourceStore.js";
import { utcMs } from "../../live/time.js";
import type { FeedStatus, SourceView } from "../../model/index.js";
import { adapted, refused, type Adapted } from "./result.js";

/**
 * A source as SourceView, its last record placed on the server's clock
 * (`at`, the frame's server time, minus the source's age), never on the
 * browser's.
 */
export function adaptSource(raw: unknown, at: string): Adapted<SourceView> {
  const s = parseStatusSource(raw);
  if (s === null) return refused("source", raw, "not a source/status/v1 body");
  const atMs = utcMs(at);
  return adapted({
    sourceType: s.source,
    instanceId: s.sourceInstance,
    state: sourceStateOf(s),
    disabledBy: s.disabledBy,
    disabledByWho: s.disabledByWho,
    lastSeenAt:
      s.ageS === null || atMs === null
        ? null
        : new Date(atMs - s.ageS * 1000).toISOString(),
    lagS: s.lagS,
    accepted: s.counters["accepted"] ?? 0,
    refused: s.counters["refused"] ?? 0,
  });
}

/** A `source/status/v1` frame to a SourceView. */
export function adaptSourceFrame(f: ConsoleFrame): Adapted<SourceView> {
  if (f.schema !== "source/status/v1")
    return refused("schema", f.schema, "not source/status/v1");
  return adaptSource(f.body, f.ts ?? f.rxTs);
}

/**
 * A `console/status/v1` frame to the FeedStatus a live feed would hold
 * after it (`connection` live, since the browser clock `receivedAtMs`).
 */
export function adaptStatus(
  f: ConsoleFrame,
  receivedAtMs: number,
): Adapted<{ status: FeedStatus; sources: SourceView[] }> {
  if (f.schema !== "console/status/v1")
    return refused("schema", f.schema, "not console/status/v1");
  const b = parseStatusBody(f.body);
  if (b === null)
    return refused("body", f.body, "not a console/status/v1 body");
  const sources: SourceView[] = [];
  const raw = (f.body as { sources: unknown[] }).sources;
  for (const item of raw) {
    const s = adaptSource(item, b.serverTs);
    if (!s.ok) return s;
    sources.push(s.value);
  }
  return adapted({
    status: {
      connection: "live",
      sinceMs: receivedAtMs,
      droppedFrames: b.droppedFrames,
      degraded: b.degraded,
      policyVersion: b.policyVersion,
      staleAfterS: b.staleAfterS,
      liveMaxAgeS: b.liveMaxAgeS,
      serverTs: b.serverTs,
    },
    sources,
  });
}

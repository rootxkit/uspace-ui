// The source store (docs/PLAN.md §3.11, WP-8): one `SourceView` per
// (type, instance), replaced by every status frame's `sources[]` (spec 04
// §3.6, every 2 s). The state is the server's, translated into the kit's
// words, never judged here:
//
// - `disabled` beats every other state (LESSONS B-11), and keeps who and
//   how;
// - `never_heard` when the server has never heard it (`age_s: null`);
// - `lagging` only when the server says how far behind (`lag_s`, B-03);
// - `unreachable` for the server's `down` (B-04: never "lost");
// - `stale` when the server says `stale`, the bucket it computed against
//   its own `stale_after_s`; the kit never buckets a source itself;
// - `healthy` for `live`.
//
// The wire's `unknown` (a follower that has not read its control state,
// LESSONS B-09) has no word in `SourceState`; it is shown as `stale`,
// never as `healthy` (CLAUDE.md rule 6: never upgrade), and counted.
import type { SourceState, SourceView } from "../model/index.js";
import { Emitter } from "./emitter.js";
import type { StatusSource } from "./frame.js";
import { utcMs } from "./time.js";

/**
 * A `SourceView` with the age the server gave and when this console
 * received it, so the age keeps climbing between status frames without
 * comparing the two clocks (predecessor sources.ts).
 *
 * @public
 */
export interface LiveSourceView extends SourceView {
  /** Seconds since the newest record, on the server's clock, as sent. */
  ageS: number | null;
  /** Browser clock at which the status frame carrying `ageS` arrived. */
  ageAtMs: number;
  /** When the source entered its state, on the server's clock. */
  since: string | null;
  counters: Readonly<Record<string, number>>;
}

// A display bound: sources listed in one panel. Past it, counted.
/** @beta */
export const SOURCE_STORE_LIMIT = 1000;

/** @public */
export type SourceStoreCounter =
  /** A source past `SOURCE_STORE_LIMIT` in one status frame (E-10). */
  | "source_dropped_over_limit"
  /** A source in the previous status frame and not in this one. */
  | "source_left_status"
  /** A source in the wire state `unknown` (B-09), shown as stale. */
  | "source_state_unknown";

const ZERO: Readonly<Record<SourceStoreCounter, number>> = {
  source_dropped_over_limit: 0,
  source_left_status: 0,
  source_state_unknown: 0,
};

/**
 * The kit's state for one wire source (the precedence above).
 *
 * @beta
 */
export function sourceStateOf(s: StatusSource): SourceState {
  if (s.state === "disabled" || s.disabledBy !== null) return "disabled";
  if (s.ageS === null) return "never_heard";
  switch (s.state) {
    case "down":
      return "unreachable";
    case "stale":
    case "unknown":
      return "stale";
    case "live":
      return s.lagS !== null && s.lagS > 0 ? "lagging" : "healthy";
    default:
      return s.state satisfies never;
  }
}

/**
 * The display age of a source at `nowMs`: the server's age when the frame
 * was sent plus the time this console has held it, each on its own clock.
 * Null when the source has never been heard.
 *
 * @beta
 */
export function sourceAgeS(
  s: Pick<LiveSourceView, "ageS" | "ageAtMs">,
  nowMs: number,
): number | null {
  if (s.ageS === null) return null;
  const age = s.ageS + Math.max(0, nowMs - s.ageAtMs) / 1000;
  return Number.isFinite(age) ? age : null;
}

/** @public */
export interface SourceStore {
  /**
   * Replaces the sources with a status frame's `sources[]`, received at
   * `receivedAtMs` on the browser clock; `serverTs` is the frame's
   * `server_ts`, from which `lastSeenAt` is read on the server's clock.
   */
  applyStatus(
    sources: readonly StatusSource[],
    serverTs: string,
    receivedAtMs: number,
  ): void;
  /** Types first, then instances, each sorted; stable between changes. */
  snapshot(): readonly LiveSourceView[];
  subscribe(fn: () => void): () => void;
  counters(): Readonly<Record<SourceStoreCounter, number>>;
}

const keyOf = (s: { sourceType: string; instanceId: string | null }): string =>
  `${s.sourceType}\u0000${s.instanceId ?? ""}`;

/** @public */
export function createSourceStore(
  opts: { maxSources?: number } = {},
): SourceStore {
  const limit = opts.maxSources ?? SOURCE_STORE_LIMIT;
  const counts: Record<SourceStoreCounter, number> = { ...ZERO };
  const emitter = new Emitter();
  let views: readonly LiveSourceView[] = [];

  return {
    applyStatus(sources, serverTs, receivedAtMs) {
      const serverMs = utcMs(serverTs);
      const next: LiveSourceView[] = [];
      for (const s of sources) {
        if (next.length >= limit) {
          counts.source_dropped_over_limit += 1;
          continue;
        }
        if (s.state === "unknown") counts.source_state_unknown += 1;
        // Server clock only: its `server_ts` minus its own age.
        const lastSeenAt =
          s.ageS === null || serverMs === null
            ? null
            : new Date(serverMs - s.ageS * 1000).toISOString();
        next.push({
          sourceType: s.source,
          instanceId: s.sourceInstance,
          state: sourceStateOf(s),
          disabledBy: s.disabledBy,
          disabledByWho: s.disabledByWho,
          lastSeenAt,
          lagS: s.lagS,
          accepted: s.counters["accepted"] ?? 0,
          refused: s.counters["refused"] ?? 0,
          ageS: s.ageS,
          ageAtMs: receivedAtMs,
          since: s.since,
          counters: s.counters,
        });
      }
      next.sort(
        (a, b) =>
          a.sourceType.localeCompare(b.sourceType) ||
          Number(a.instanceId !== null) - Number(b.instanceId !== null) ||
          (a.instanceId ?? "").localeCompare(b.instanceId ?? ""),
      );
      const present = new Set(next.map(keyOf));
      for (const v of views) {
        if (!present.has(keyOf(v))) counts.source_left_status += 1;
      }
      views = next;
      emitter.emit();
    },
    snapshot: () => views,
    subscribe: emitter.subscribe,
    counters: () => ({ ...counts }),
  };
}

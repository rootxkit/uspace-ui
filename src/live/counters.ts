// What the feed client met and could not use is counted as well as handled
// (CLAUDE.md rule 9, LESSONS E-09): every dropped, malformed or ignored
// frame. The counts are page-wide, like the other entry points' counters;
// the status components show them (`FeedStatusBar`, `LiveStatus`). The
// stores count their own bounds (`TrackStore.counters()` and the rest).

/** @beta */
export type LiveCounter =
  /** A message that arrived on a feed socket, whatever it held. */
  | "frames_received"
  /**
   * A message that was not a console frame: not text, not JSON, or an
   * envelope field missing or of the wrong type (04 §2). Dropped.
   */
  | "frames_malformed"
  /** A well-formed frame the kit has no store for: passed to `onFrame`. */
  | "frames_unhandled"
  /** A `console/status/v1` whose body broke the schema: not applied. */
  | "status_malformed"
  /**
   * A malformed extra of an applied status frame that the lab schema does
   * not name (`thresholds`, `evaluation_period_s`): left out, one count
   * per member.
   */
  | "status_extra_ignored"
  /** A `console/snapshot/v1` whose body broke the schema: not applied. */
  | "snapshot_malformed"
  /** One item of a snapshot that was not a frame: skipped. */
  | "snapshot_item_malformed"
  /** One item of a snapshot the app's adapter returned null for. */
  | "snapshot_item_unadapted"
  /** A snapshot collection with no store given in the options. */
  | "snapshot_collection_unstored"
  /** A socket the client tried to open. */
  | "connect_attempts"
  /**
   * A connect that could not start: the `url` function rejected or the
   * `WebSocket` constructor threw. Retried like a close.
   */
  | "connect_failed"
  /**
   * A feed URL refused before connecting: it carried credentials, a
   * token-like query parameter, or another origin (M22: the cookie on a
   * same-origin upgrade is the only credential). Retried like a close.
   */
  | "url_refused"
  /** A socket that closed while the client was running. */
  | "closed"
  /** A close with code 4401: the session is gone (PLAN §6.3, M22). */
  | "unauthorized"
  /** A subscribe frame replaced by a newer one before it could be sent. */
  | "subscribe_superseded";

const ZERO: Readonly<Record<LiveCounter, number>> = {
  frames_received: 0,
  frames_malformed: 0,
  frames_unhandled: 0,
  status_malformed: 0,
  status_extra_ignored: 0,
  snapshot_malformed: 0,
  snapshot_item_malformed: 0,
  snapshot_item_unadapted: 0,
  snapshot_collection_unstored: 0,
  connect_attempts: 0,
  connect_failed: 0,
  url_refused: 0,
  closed: 0,
  unauthorized: 0,
  subscribe_superseded: 0,
};

const counts: Record<LiveCounter, number> = { ...ZERO };

/** @beta */
export function countLive(counter: LiveCounter, by = 1): void {
  counts[counter] += by;
}

/**
 * A snapshot of the feed counters since the page loaded.
 *
 * @beta
 */
export function liveCounters(): Readonly<Record<LiveCounter, number>> {
  return { ...counts };
}

/**
 * Tests only: start the counters again from zero (LESSONS E-11).
 *
 * @beta
 */
export function resetLiveCountersForTests(): void {
  Object.assign(counts, ZERO);
}

// What the layers drop or cannot resolve is counted as well as handled
// (CLAUDE.md rule 9, LESSONS E-09, E-10); WP-8's status components read
// these.

export type LayerCounter =
  /** Data handed to a layer that a newer value replaced in the same frame. */
  | "update_superseded"
  /** A colour token that did not resolve to `#rrggbb` on the map's element. */
  | "token_unresolved"
  /**
   * A track update whose `times.capturedAt` is older than the one held
   * for the same id (LESSONS T-13): ignored, never reordered.
   */
  | "track_out_of_order"
  /**
   * A track update whose `capturedAt` or the held one's is not RFC 3339
   * UTC (02 §1), so the two cannot be ordered: applied, never hidden.
   */
  | "track_time_unordered"
  /** A trail point pushed out of its track's bounded ring (E-10). */
  | "trail_point_evicted"
  /**
   * A proximity alert whose peer is not in the track map (WP-11): a ring
   * is drawn on the party that is, never a line to a guessed position.
   * Counted once per alert while the peer stays missing.
   */
  | "alert_peer_missing"
  /**
   * An alert none of whose aircraft is in the track map (WP-11): nothing
   * can be drawn for it on the map; the list still shows it. Counted once
   * per alert while it stays so.
   */
  | "alert_aircraft_missing";

const counts: Record<LayerCounter, number> = {
  update_superseded: 0,
  token_unresolved: 0,
  track_out_of_order: 0,
  track_time_unordered: 0,
  trail_point_evicted: 0,
  alert_peer_missing: 0,
  alert_aircraft_missing: 0,
};

export function countLayer(counter: LayerCounter): void {
  counts[counter] += 1;
}

/** A snapshot of the layer counters since the page loaded. */
export function layerCounters(): Readonly<Record<LayerCounter, number>> {
  return { ...counts };
}

/** Tests only: start the counters again from zero (LESSONS E-11). */
export function resetLayerCountersForTests(): void {
  for (const k of Object.keys(counts) as LayerCounter[]) counts[k] = 0;
}

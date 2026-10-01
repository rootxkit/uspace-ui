// Every empty state of the map is counted as well as shown (CLAUDE.md rule
// 9, LESSONS E-02): WP-8's status components read these.

export type MapCounter =
  /** SOURCE.json absent, refused, timed out or malformed: the null path. */
  | "basemap_missing"
  /** SOURCE.json arrived but did not have the contract's shape. */
  | "basemap_source_malformed"
  /** The map could not be created (no WebGL). */
  | "webgl_unavailable";

const counts: Record<MapCounter, number> = {
  basemap_missing: 0,
  basemap_source_malformed: 0,
  webgl_unavailable: 0,
};

export function countMap(counter: MapCounter): void {
  counts[counter] += 1;
}

/** A snapshot of the map counters since the page loaded. */
export function mapCounters(): Readonly<Record<MapCounter, number>> {
  return { ...counts };
}

// What the layers drop or cannot resolve is counted as well as handled
// (CLAUDE.md rule 9, LESSONS E-09, E-10); WP-8's status components read
// these.

export type LayerCounter =
  /** Data handed to a layer that a newer value replaced in the same frame. */
  | "update_superseded"
  /** A colour token that did not resolve to `#rrggbb` on the map's element. */
  | "token_unresolved";

const counts: Record<LayerCounter, number> = {
  update_superseded: 0,
  token_unresolved: 0,
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

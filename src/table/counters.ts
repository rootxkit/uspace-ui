// What the table kit met and could not use is counted as well as handled
// (CLAUDE.md rule 9, LESSONS E-09): a URL whose table state does not
// parse, a PII filter found in a URL, a state entry naming a column the
// table does not have. Nothing here throws on input it did not write.

/** @beta */
export type TableCounter =
  /** A `<key>.*` search parameter that did not parse; it was ignored. */
  | "url_state_malformed"
  /** A filter on a PII column found in a URL; dropped, never applied. */
  | "url_pii_refused"
  /** A filter on a PII column kept in memory instead of the URL. */
  | "pii_filter_in_memory"
  /** A sort, filter or visibility entry for a column the table lacks. */
  | "state_unknown_column";

const counts: Record<TableCounter, number> = {
  url_state_malformed: 0,
  url_pii_refused: 0,
  pii_filter_in_memory: 0,
  state_unknown_column: 0,
};

export function countTable(counter: TableCounter, by = 1): void {
  counts[counter] += by;
}

/**
 * A snapshot of the table counters since the page loaded.
 *
 * @beta
 */
export function tableCounters(): Readonly<Record<TableCounter, number>> {
  return { ...counts };
}

/**
 * Sets every counter back to zero; for tests (E-11).
 *
 * @beta
 */
export function resetTableCountersForTests(): void {
  for (const k of Object.keys(counts) as TableCounter[]) counts[k] = 0;
}

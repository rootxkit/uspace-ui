// What the alert components drop or cannot do is counted as well as shown
// (CLAUDE.md rule 9, LESSONS E-09, E-10).

export type AlertCounter =
  /**
   * A second entry under one `alertId` in one `alerts` list: the later
   * one is shown, the earlier one is dropped (C-06: a raise replaces).
   */
  | "alert_duplicate_id"
  /** No Web Audio in this browser, or it refused to start. */
  | "tone_unavailable"
  /** A tone that failed to play on a started audio context. */
  | "tone_failed"
  /**
   * A `repeatMs` that is not a positive finite number: the tone sounds
   * once and does not repeat, and the period shows as a dash.
   */
  | "tone_repeat_invalid";

const counts: Record<AlertCounter, number> = {
  alert_duplicate_id: 0,
  tone_unavailable: 0,
  tone_failed: 0,
  tone_repeat_invalid: 0,
};

export function countAlert(counter: AlertCounter): void {
  counts[counter] += 1;
}

/** A snapshot of the alert counters since the page loaded. */
export function alertCounters(): Readonly<Record<AlertCounter, number>> {
  return { ...counts };
}

/** Tests only: start the counters again from zero (LESSONS E-11). */
export function resetAlertCountersForTests(): void {
  for (const k of Object.keys(counts) as AlertCounter[]) counts[k] = 0;
}

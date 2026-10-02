// What the i18n layer had to work around is counted as well as handled
// (CLAUDE.md rule 9): WP-8's status components read these, and the
// browser tests assert `missingKeys()` is 0 for the kit's own components.

export type I18nCounter =
  /** A `ka` lookup that found nothing in `ka` and showed the `en` text. */
  | "missing_ka"
  /** A key in neither language: the key itself was shown. */
  | "missing_key"
  /** A registration number whose secret part was cut off (06 §5). */
  | "registration_secret_refused"
  /** A time without a zone designator, or not a time: shown as a dash. */
  | "time_refused";

const counts: Record<I18nCounter, number> = {
  missing_ka: 0,
  missing_key: 0,
  registration_secret_refused: 0,
  time_refused: 0,
};

export function countI18n(counter: I18nCounter): void {
  counts[counter] += 1;
}

/** A snapshot of the i18n counters since the page loaded. */
export function i18nCounters(): Readonly<Record<I18nCounter, number>> {
  return { ...counts };
}

/** Lookups that fell back, to `en` or to the key, since the page loaded. */
export function missingKeys(): number {
  return counts.missing_ka + counts.missing_key;
}

/** Sets every counter back to 0. For tests (they restore global state). */
export function resetI18nCounters(): void {
  for (const k of Object.keys(counts) as I18nCounter[]) counts[k] = 0;
}

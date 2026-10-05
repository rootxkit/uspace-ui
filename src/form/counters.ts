// What the form kit met is counted as well as shown (CLAUDE.md rule 9):
// API field errors that matched no field (they are listed, never
// dropped), submissions the API refused, and submissions that failed
// without an API answer.

/** @beta */
export type FormCounter =
  /** An API field error whose path matched no registered field. */
  | "field_error_unmapped"
  /** A submission the API refused (an `ApiError` or returned errors). */
  | "submit_refused"
  /** A submission that threw something other than an `ApiError`. */
  | "submit_failed";

const counts: Record<FormCounter, number> = {
  field_error_unmapped: 0,
  submit_refused: 0,
  submit_failed: 0,
};

export function countForm(counter: FormCounter, by = 1): void {
  counts[counter] += by;
}

/**
 * A snapshot of the form counters since the page loaded.
 *
 * @beta
 */
export function formCounters(): Readonly<Record<FormCounter, number>> {
  return { ...counts };
}

/**
 * Sets every counter back to zero; for tests (E-11).
 *
 * @beta
 */
export function resetFormCountersForTests(): void {
  for (const k of Object.keys(counts) as FormCounter[]) counts[k] = 0;
}

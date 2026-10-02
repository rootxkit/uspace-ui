// What the BFF helpers met and could not use is counted as well as
// handled (CLAUDE.md rule 9, LESSONS E-09). Server side only: the app
// exposes them on its own health page if it wants them.

export type AuthCounter =
  /** A session token whose payload did not decode to a JSON object. */
  | "claims_malformed"
  /** A `roles` claim that was present but not an array (the pre-M20 string). */
  | "roles_not_array"
  /** An entry of `roles` that was not a string; dropped. */
  | "role_not_string"
  /** A token without the `sub`, `exp` or `realm` a display needs. */
  | "claims_incomplete"
  /** A request the proxy refused: path outside the allow-list. */
  | "proxy_path_refused"
  /** An unsafe request refused for a missing or mismatched CSRF pair. */
  | "csrf_refused"
  /** A sign-in refused for a missing or foreign `Origin`. */
  | "origin_refused"
  /** An upstream call that did not answer within its timeout. */
  | "upstream_timeout"
  /** An upstream call that failed before an answer (connection, DNS). */
  | "upstream_unreachable"
  /** A 2xx sign-in answer without a token or a challenge the BFF knows. */
  | "login_answer_invalid"
  /** No client address: the forwarded chain was shorter than the trusted hops, or not an IP. */
  | "client_address_unknown";

const ZERO: Readonly<Record<AuthCounter, number>> = {
  claims_malformed: 0,
  roles_not_array: 0,
  role_not_string: 0,
  claims_incomplete: 0,
  proxy_path_refused: 0,
  csrf_refused: 0,
  origin_refused: 0,
  upstream_timeout: 0,
  upstream_unreachable: 0,
  login_answer_invalid: 0,
  client_address_unknown: 0,
};

const counts: Record<AuthCounter, number> = { ...ZERO };

export function countAuth(counter: AuthCounter): void {
  counts[counter] += 1;
}

/** A snapshot of the BFF counters since the process started. */
export function authCounters(): Readonly<Record<AuthCounter, number>> {
  return { ...counts };
}

/** Sets every counter back to zero; for tests (E-11). */
export function resetAuthCountersForTests(): void {
  Object.assign(counts, ZERO);
}

// Reconnect timing (docs/PLAN.md §8 "Reconnect": first retry at 1 s,
// factor 2, cap 30 s, jitter; forever, LESSONS B-08). Transport constants,
// not policy thresholds: they decide how often a console knocks, never
// what it shows.

export interface Backoff {
  /** The first retry's ceiling, in ms. */
  initialMs: number;
  /** The cap of every ceiling, in ms. */
  maxMs: number;
  /** Each failed attempt multiplies the ceiling by this. */
  factor: number;
}

export const DEFAULT_BACKOFF: Readonly<Backoff> = Object.freeze({
  initialMs: 1000,
  maxMs: 30_000,
  factor: 2,
});

/**
 * A connection that stayed live this long ends a run of failures: the
 * retry after it starts from `initialMs` again (predecessor feed.ts). A
 * server that accepts and closes at once keeps backing off.
 */
export const STABLE_AFTER_MS = 10_000;

/**
 * The delay before retry number `attempt` (0 for the first): the ceiling
 * `min(maxMs, initialMs * factor^attempt)` with "equal jitter", half fixed
 * and half `random` (in [0, 1)), so a room of consoles does not reconnect
 * in step. Never below 1 ms and never NaN, whatever the options.
 */
export function reconnectDelayMs(
  attempt: number,
  backoff: Backoff,
  random: number,
): number {
  const exp = Math.max(0, Math.min(attempt, 64));
  const raw = backoff.initialMs * backoff.factor ** exp;
  const ceiling = Math.min(
    backoff.maxMs,
    Number.isFinite(raw) ? raw : backoff.maxMs,
  );
  const r = Number.isFinite(random) ? Math.min(Math.max(random, 0), 1) : 0;
  const delay = Math.round(ceiling / 2 + (ceiling / 2) * r);
  return Number.isFinite(delay) && delay >= 1 ? delay : 1;
}

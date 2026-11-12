// Display ages and the ordering of two capture times (docs/PLAN.md §3.11,
// WP-8). Nothing here places a time or judges one (CLAUDE.md rule 2): an
// age is two readings of one clock, never a reading of the browser's clock
// against a server time (04 §2: an age counts from receipt or from
// capture, never a mix). The only bridge between the two clocks is the
// offset the status frame gives (`server_ts` against the moment the frame
// arrived), and only the `"captured"` readings use it. `observedAge` is
// the age a track is drawn with: the largest of the readings it has, so
// the same sample delivered again, or one that arrives already old, is
// not shown as fresh (review 2026-11-12, F1).
import type { Times } from "../model/index.js";

// RFC 3339 UTC with `Z` (spec 02 §1), any number of fraction digits.
const UTC = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/;

/**
 * Orders two `capturedAt` values as written, without a clock or a `Date`:
 * the seconds part compares as text, the fraction padded to nanoseconds.
 * Negative when `a` is older, 0 when equal, positive when newer; null when
 * either is not RFC 3339 UTC, so the two cannot be ordered.
 *
 * @public
 */
export function compareCapturedAt(a: string, b: string): number | null {
  const ma = UTC.exec(a);
  const mb = UTC.exec(b);
  if (ma === null || mb === null) return null;
  const sa = ma[1] ?? "";
  const sb = mb[1] ?? "";
  if (sa !== sb) return sa < sb ? -1 : 1;
  const fa = (ma[2] ?? "").padEnd(9, "0");
  const fb = (mb[2] ?? "").padEnd(9, "0");
  return fa === fb ? 0 : fa < fb ? -1 : 1;
}

/**
 * Milliseconds since the epoch of an RFC 3339 UTC time (`Z` only, 02 §1);
 * null for anything else, so a time without a zone is never read as the
 * browser's local time.
 *
 * @public
 */
export function utcMs(iso: string | null | undefined): number | null {
  if (typeof iso !== "string" || !UTC.test(iso)) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Which clock an age counts on (04 §2).
 *
 * @public
 */
export type AgeBasis = "received" | "captured";

/**
 * A display age in seconds.
 *
 * - `"received"` (the default): `nowMs - receivedAtMs`, two readings of
 *   the browser clock (the live store stamps `receivedAtMs`; the app's
 *   tick gives `nowMs`). Null when the value carries no `receivedAtMs`.
 * - `"captured"`: the age of `times.capturedAt` on the server's clock,
 *   which needs `clockOffsetMs` (server minus browser, from the status
 *   frame, `LiveStatus.clockOffsetMs`). Without the offset, or without a
 *   `capturedAt` in RFC 3339 UTC, it is null: an age that cannot be read
 *   on one clock is not guessed.
 *
 * Null as well for a non-finite result. Never a zero for an unknown.
 *
 * @public
 */
export function ageS(
  t: { receivedAtMs: number } | { times: Times },
  nowMs: number,
  by: AgeBasis = "received",
  clockOffsetMs: number | null = null,
): number | null {
  if (by === "received") {
    if (!("receivedAtMs" in t)) return null;
    const age = (nowMs - t.receivedAtMs) / 1000;
    return Number.isFinite(age) ? age : null;
  }
  if (!("times" in t)) return null;
  if (clockOffsetMs === null || !Number.isFinite(clockOffsetMs)) return null;
  const capturedMs = utcMs(t.times.capturedAt);
  if (capturedMs === null) return null;
  const age = (nowMs + clockOffsetMs - capturedMs) / 1000;
  return Number.isFinite(age) ? age : null;
}

/**
 * Which evidence an observed age rests on.
 *
 * - `"server"`: the server's own `age_s` (`serverAgeS`), counted on by the
 *   browser clock since the frame that carried it arrived.
 * - `"captured"`: `times.capturedAt` on the server's clock, through the
 *   status frame's `clockOffsetMs`.
 * - `"received"`: the browser clock since this `capturedAt` first arrived
 *   (`sampleReceivedAtMs`).
 *
 * @public
 */
export type ObservedAgeBasis = "server" | "captured" | "received";

/**
 * An observed age and what it rests on.
 *
 * @public
 */
export interface ObservedAge {
  ageS: number;
  basis: ObservedAgeBasis;
}

/**
 * What `observedAge` reads: a `TrackView` or a `MannedView` as the live
 * store holds it, or any value with the same fields.
 *
 * @public
 */
export interface Observed {
  receivedAtMs: number;
  sampleReceivedAtMs?: number;
  serverAgeS?: number | null;
  times?: Times;
}

/**
 * The age of the observation a view shows, in seconds: how long ago the
 * aircraft was where the symbol is, as far as this console can tell. It is
 * the age a track is drawn with (`TrackLayer`, `MannedLayer`), and it is
 * the largest of up to three readings, each on one clock (04 §2), so a
 * track is never shown fresher than any of them says:
 *
 * 1. `"server"`: `serverAgeS + (nowMs - receivedAtMs) / 1000`, when the
 *    feed sent a finite `serverAgeS >= 0`. The server measured the age on
 *    its own clock; the browser only counts on, so its clock's error
 *    against the server's does not enter.
 * 2. `"captured"`: `(nowMs + clockOffsetMs - capturedAt) / 1000`, when
 *    `clockOffsetMs` is given (`LiveStatus.clockOffsetMs`: the status
 *    frame's `server_ts` minus the browser clock at its arrival, renewed
 *    by every status frame) and `capturedAt` is RFC 3339 UTC. The
 *    browser clock may be minutes off: the offset takes that out, and
 *    what is left is the status frame's transit time, by which this
 *    reading is too young.
 * 3. `"received"`: `(nowMs - sampleReceivedAtMs) / 1000`, the time since
 *    this `capturedAt` first reached this console (`receivedAtMs` when the
 *    view was not made by the live store). Always available, and the only
 *    reading without a server age or an offset; it is then too young by
 *    the age the sample had when it first arrived, which nothing here can
 *    know. It is a floor: delivering the same sample again never lowers
 *    it, and a `capturedAt` ahead of the server's clock cannot push the
 *    age below it.
 *
 * `capturedAt` is never read against the browser clock alone. Null when no
 * reading is finite; never a zero for an unknown.
 *
 * @public
 */
export function observedAge(
  t: Observed,
  nowMs: number,
  clockOffsetMs: number | null = null,
): ObservedAge | null {
  let best: ObservedAge | null = null;
  const offer = (ageS: number | null, basis: ObservedAgeBasis): void => {
    if (ageS === null || !Number.isFinite(ageS)) return;
    if (best === null || ageS > best.ageS) best = { ageS, basis };
  };
  const sinceReceiptS = (nowMs - t.receivedAtMs) / 1000;
  const serverAgeS = t.serverAgeS;
  if (
    typeof serverAgeS === "number" &&
    Number.isFinite(serverAgeS) &&
    serverAgeS >= 0
  ) {
    // A browser clock that stepped back does not make the server's age
    // younger than the server said.
    offer(serverAgeS + (sinceReceiptS > 0 ? sinceReceiptS : 0), "server");
  }
  if (t.times !== undefined)
    offer(
      ageS({ times: t.times }, nowMs, "captured", clockOffsetMs),
      "captured",
    );
  offer((nowMs - (t.sampleReceivedAtMs ?? t.receivedAtMs)) / 1000, "received");
  return best;
}

/**
 * `observedAge(...)?.ageS`: the number alone, null when unknown.
 *
 * @public
 */
export function observedAgeS(
  t: Observed,
  nowMs: number,
  clockOffsetMs: number | null = null,
): number | null {
  return observedAge(t, nowMs, clockOffsetMs)?.ageS ?? null;
}

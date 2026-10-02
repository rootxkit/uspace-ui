// Display ages and the ordering of two capture times (docs/PLAN.md §3.11,
// WP-8). Nothing here places a time or judges one (CLAUDE.md rule 2): an
// age is two readings of one clock, never a reading of the browser's clock
// against a server time (04 §2: an age counts from receipt or from
// capture, never a mix). The only bridge between the two clocks is the
// offset the status frame gives (`server_ts` against the moment the frame
// arrived), and only `ageS(..., "captured", offset)` uses it.
import type { Times } from "../model/index.js";

// RFC 3339 UTC with `Z` (spec 02 §1), any number of fraction digits.
const UTC = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/;

/**
 * Orders two `capturedAt` values as written, without a clock or a `Date`:
 * the seconds part compares as text, the fraction padded to nanoseconds.
 * Negative when `a` is older, 0 when equal, positive when newer; null when
 * either is not RFC 3339 UTC, so the two cannot be ordered.
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
 */
export function utcMs(iso: string | null | undefined): number | null {
  if (typeof iso !== "string" || !UTC.test(iso)) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Which clock an age counts on (04 §2). */
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

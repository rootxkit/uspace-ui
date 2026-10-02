// Age symbology (docs/PLAN.md §3.8, WP-7): which of the four age buckets
// an age falls in, and how each bucket draws. The age and the threshold
// are given; nothing here reads a clock or holds a threshold (CLAUDE.md
// rule 3, INV-03): `staleAfterS` is the policy value of the feed's status
// frame (`console/status/v1` `stale_after_s`, PLAN §6.3), never a default.
import type { Key } from "../i18n/en.js";
import type { AgeBucket } from "../theme/tokens.js";

/**
 * The thirds rule of PLAN §3.8: `live` below a third of `staleAfterS`,
 * `aging` below `staleAfterS`, `stale` from it on. `unknown` when the age
 * is not known (null, NaN, Infinity) or when `staleAfterS` is not a
 * positive finite number: an age that cannot be placed against the policy
 * is not called live (PLAN §14 Q6: without a threshold, ages are shown
 * without a bucket). A negative age (the browser clock stepped back
 * between receipt and now) is below every threshold, so `live`; the
 * layer's tick moves it on.
 */
export function ageBucket(ageS: number | null, staleAfterS: number): AgeBucket {
  if (!Number.isFinite(staleAfterS) || staleAfterS <= 0) return "unknown";
  if (ageS === null || !Number.isFinite(ageS)) return "unknown";
  if (ageS < staleAfterS / 3) return "live";
  if (ageS < staleAfterS) return "aging";
  return "stale";
}

/**
 * The CSS variable of a bucket's colour (styles/tokens.css; the same names
 * as `tokens.age`, in `AGE_BUCKETS` order, which age.test.ts pins).
 */
export function ageToken(b: AgeBucket): string {
  switch (b) {
    case "live":
    case "aging":
    case "stale":
    case "unknown":
      return `--us-age-${b}`;
    default:
      return b satisfies never;
  }
}

/**
 * The opacity a track draws with per bucket: the map's cue for age, which
 * needs no colour. Display-only constants. `unknown` is drawn in full: an
 * unknown is never dimmed as if it were known to be old (CLAUDE.md rule
 * 6); the legend says so.
 */
export function ageOpacity(b: AgeBucket): number {
  switch (b) {
    case "live":
      return 1;
    case "aging":
      return 0.7;
    case "stale":
      return 0.35;
    case "unknown":
      return 1;
    default:
      return b satisfies never;
  }
}

/** The catalogue key of a bucket's name. */
export const AGE_BUCKET_KEYS: Readonly<Record<AgeBucket, Key>> = Object.freeze({
  live: "age.bucket.live",
  aging: "age.bucket.aging",
  stale: "age.bucket.stale",
  unknown: "age.bucket.unknown",
});

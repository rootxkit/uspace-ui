// CSS variable names of the semantic palettes (docs/PLAN.md §3.2). Names,
// never colours: the colours live in styles/tokens.css, per scheme, and a
// test checks that every name here is defined there for both schemes.
import {
  IDENT_STATUSES,
  SEVERITIES,
  TRUSTS,
  ZONE_TYPES,
  type IdentStatus,
  type Severity,
  type Trust,
  type ZoneType,
} from "../model/index.js";

function names<K extends string>(
  prefix: string,
  keys: readonly K[],
): Readonly<Record<K, string>> {
  const out = {} as Record<K, string>;
  for (const k of keys) out[k] = `--us-${prefix}-${k}`;
  return Object.freeze(out);
}

/**
 * The age buckets of the track and source age display, in order.
 *
 * @public
 */
export const AGE_BUCKETS = ["live", "aging", "stale", "unknown"] as const;
/** @public */
export type AgeBucket = (typeof AGE_BUCKETS)[number];

/** @public */
export interface Tokens {
  severity: Readonly<Record<Severity, string>>;
  trust: Readonly<Record<Trust, string>>;
  ident: Readonly<Record<IdentStatus, string>>;
  /** No identification at all; not an `IdentStatus`, so kept apart. */
  identNone: string;
  zone: Readonly<Record<ZoneType, string>>;
  /** In `AGE_BUCKETS` order. */
  age: readonly string[];
  /** The accent ThemeProvider writes from `Brand.accent`. */
  brandAccent: string;
}

/** @public */
export const tokens: Tokens = Object.freeze({
  severity: names("severity", SEVERITIES),
  trust: names("trust", TRUSTS),
  ident: names("ident", IDENT_STATUSES),
  identNone: "--us-ident-none",
  zone: names("zone", ZONE_TYPES),
  age: Object.freeze(AGE_BUCKETS.map((b) => `--us-age-${b}`)),
  brandAccent: "--us-brand-accent",
});

// Severity symbology (docs/PLAN.md §3.8, WP-7): the colour, the glyph and
// the order of an alert's severity. The severity is the API's (LESSONS
// Z-10: severity per kind or type is policy, decided by the server); the
// kit only draws it.
import type { Key } from "../i18n/en.js";
import type { Severity } from "../model/index.js";
import { tokens } from "../theme/tokens.js";

/**
 * The CSS variable of a severity's colour (styles/tokens.css).
 *
 * @public
 */
export function severityToken(s: Severity): string {
  switch (s) {
    case "info":
    case "warning":
    case "critical":
      return tokens.severity[s];
    default:
      return s satisfies never;
  }
}

/**
 * The glyph beside a severity's colour, so that the three read without
 * colour: an octagon for critical, a triangle for warning, a circle for
 * info (the road-sign convention). The legend and the alert list draw it.
 *
 * @beta
 */
export type SeverityGlyph = "octagon" | "triangle" | "circle";

/** @beta */
export function severityGlyph(s: Severity): SeverityGlyph {
  switch (s) {
    case "critical":
      return "octagon";
    case "warning":
      return "triangle";
    case "info":
      return "circle";
    default:
      return s satisfies never;
  }
}

/**
 * Gravest first. A display-only constant: the order a legend or a list
 * shows severities in, not a ranking any logic reads.
 *
 * @beta
 */
export const SEVERITY_ORDER: readonly Severity[] = Object.freeze([
  "critical",
  "warning",
  "info",
] satisfies Severity[]);

/** @public */
export function severityOrder(): readonly Severity[] {
  return SEVERITY_ORDER;
}

/**
 * The catalogue key of a severity's name.
 *
 * @public
 */
export const SEVERITY_KEYS: Readonly<Record<Severity, Key>> = Object.freeze({
  critical: "severity.critical",
  warning: "severity.warning",
  info: "severity.info",
});

/**
 * The catalogue key of what a severity asks of the reader.
 *
 * @beta
 */
export const SEVERITY_HINT_KEYS: Readonly<Record<Severity, Key>> =
  Object.freeze({
    critical: "severity.critical.hint",
    warning: "severity.warning.hint",
    info: "severity.info.hint",
  });

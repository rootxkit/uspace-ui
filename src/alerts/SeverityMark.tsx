"use client";
// A severity as glyph and word (docs/PLAN.md §3.13, WP-11): the glyph of
// `symbology/severity` (octagon, triangle, circle) in the severity's
// colour, beside the severity's name, so that no severity is told by
// colour alone. The severity is the server's (Z-10).
import { useT } from "../i18n/I18nProvider.js";
import type { Severity } from "../model/index.js";
import {
  SEVERITY_KEYS,
  severityGlyph,
  severityToken,
  type SeverityGlyph,
} from "../symbology/severity.js";
import { cn } from "../ui/cn.js";

// The glyphs in a 16 px box. Display-only constants.
const POINTS: Readonly<Record<Exclude<SeverityGlyph, "circle">, string>> = {
  octagon: "5,1 11,1 15,5 15,11 11,15 5,15 1,11 1,5",
  triangle: "8,1 15,14 1,14",
};

/** @beta */
export interface SeverityMarkProps {
  severity: Severity;
  className?: string;
}

/** @beta */
export function SeverityMark(props: SeverityMarkProps) {
  const { severity, className } = props;
  const t = useT();
  const glyph = severityGlyph(severity);
  const fill = `var(${severityToken(severity)})`;
  return (
    <span
      className={cn("inline-flex items-center gap-1 font-semibold", className)}
      data-severity-mark={severity}
    >
      <svg
        aria-hidden="true"
        className="shrink-0"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        data-glyph={glyph}
      >
        {glyph === "circle" ? (
          <circle cx="8" cy="8" r="7" fill={fill} />
        ) : (
          <polygon points={POINTS[glyph]} fill={fill} />
        )}
      </svg>
      <span>{t(SEVERITY_KEYS[severity])}</span>
    </span>
  );
}

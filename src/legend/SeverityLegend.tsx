"use client";
// SeverityLegend (docs/PLAN.md §3.10, WP-7): the three severities, gravest
// first, each with its colour and its glyph (an octagon, a triangle, a
// circle: readable without colour), its name and what it asks of the
// reader. The severity of an alert is the server's (Z-10).
import { useT } from "../i18n/I18nProvider.js";
import type { Severity } from "../model/index.js";
import {
  SEVERITY_HINT_KEYS,
  SEVERITY_KEYS,
  severityGlyph,
  severityOrder,
  severityToken,
  type SeverityGlyph,
} from "../symbology/severity.js";
import { LegendSection } from "./LegendSection.js";

// The glyphs in an 18 px box. Display-only constants.
const GLYPH_POINTS: Readonly<Record<Exclude<SeverityGlyph, "circle">, string>> =
  {
    octagon: "6,1 12,1 17,6 17,12 12,17 6,17 1,12 1,6",
    triangle: "9,1 17,16 1,16",
  };

/** The severity's glyph in its colour. */
export function SeveritySwatch(props: { severity: Severity }) {
  const glyph = severityGlyph(props.severity);
  const fill = `var(${severityToken(props.severity)})`;
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      data-glyph={glyph}
    >
      {glyph === "circle" ? (
        <circle cx="9" cy="9" r="8" fill={fill} />
      ) : (
        <polygon points={GLYPH_POINTS[glyph]} fill={fill} />
      )}
    </svg>
  );
}

export interface SeverityLegendProps {
  defaultCollapsed?: boolean;
  className?: string;
}

export function SeverityLegend(props: SeverityLegendProps = {}) {
  const { defaultCollapsed, className } = props;
  const t = useT();
  return (
    <LegendSection
      title={t("severity.legend.title")}
      kind="severity"
      defaultCollapsed={defaultCollapsed}
      className={className}
    >
      <ul className="mt-2 grid list-none gap-2 p-0">
        {severityOrder().map((s) => (
          <li key={s} data-severity={s} className="flex items-start gap-2">
            <SeveritySwatch severity={s} />
            <span className="min-w-0">
              {t(SEVERITY_KEYS[s])}
              <span className="block text-xs text-muted-foreground">
                {t(SEVERITY_HINT_KEYS[s])}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </LegendSection>
  );
}

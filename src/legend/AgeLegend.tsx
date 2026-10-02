"use client";
// AgeLegend (docs/PLAN.md §3.10, WP-7): the four age buckets with the
// opacity the map draws each with and the ranges they cover under the
// server's `stale_after_s` (the thirds rule of PLAN §3.8). The threshold
// is a required prop with no default (INV-03); a value that is not a
// positive number says that ages are not bucketed, rather than inventing
// ranges.
import { fmtNum } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import { AGE_BUCKETS, type AgeBucket } from "../theme/tokens.js";
import { AGE_BUCKET_KEYS, ageBucket, ageOpacity } from "../symbology/age.js";
import { LegendNote, LegendSection } from "./LegendSection.js";

/** A disc at the opacity the map draws a track of `bucket` with. */
export function AgeSwatch(props: { bucket: AgeBucket }) {
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      data-opacity={ageOpacity(props.bucket)}
    >
      <circle
        cx="9"
        cy="9"
        r="7"
        fill="currentColor"
        fillOpacity={ageOpacity(props.bucket)}
      />
    </svg>
  );
}

export interface AgeLegendProps {
  /** The feed's `stale_after_s` (PLAN §6.3). Required: no default. */
  staleAfterS: number;
  defaultCollapsed?: boolean;
  className?: string;
}

export function AgeLegend(props: AgeLegendProps) {
  const { staleAfterS, defaultCollapsed, className } = props;
  const t = useT();
  const { lang } = useLang();
  // `ageBucket` is the judge of whether the threshold is usable.
  const bucketed = ageBucket(0, staleAfterS) !== "unknown";
  const secs = (v: number): string =>
    t("age.seconds", {
      n: fmtNum(v, Number.isInteger(v) ? 0 : 1, undefined, lang),
    });
  const vars = bucketed
    ? { a: secs(staleAfterS / 3), b: secs(staleAfterS) }
    : null;
  const range = (b: AgeBucket): string | null => {
    if (b === "unknown") return t("age.legend.unknown");
    if (vars === null) return null;
    switch (b) {
      case "live":
        return t("age.legend.live", vars);
      case "aging":
        return t("age.legend.aging", vars);
      case "stale":
        return t("age.legend.stale", vars);
      default:
        return b satisfies never;
    }
  };
  return (
    <LegendSection
      title={t("age.legend.title")}
      kind="age"
      defaultCollapsed={defaultCollapsed}
      className={className}
    >
      <ul className="mt-2 grid list-none gap-2 p-0">
        {AGE_BUCKETS.map((b) => {
          const text = range(b);
          return (
            <li key={b} data-age={b} className="flex items-start gap-2">
              <AgeSwatch bucket={b} />
              <span className="min-w-0">
                {t(AGE_BUCKET_KEYS[b])}
                {text !== null && (
                  <span className="block text-xs text-muted-foreground">
                    {text}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {vars === null ? (
        <LegendNote note="no-threshold">
          {t("age.legend.no_threshold")}
        </LegendNote>
      ) : (
        <LegendNote note="basis">{t("age.legend.basis", vars)}</LegendNote>
      )}
    </LegendSection>
  );
}

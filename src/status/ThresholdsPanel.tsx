"use client";
// ThresholdsPanel (1.0.0; uspace-ussp docs/PLAN.md Q28 gap 2): the
// thresholds a system's monitor judges with, as its status frame carries
// them (`LiveStatus.extras.thresholds`, `evaluationPeriodS`), with the
// policy version they belong to. The kit judges nothing with them and
// holds none (INV-03, CLAUDE.md rule 3): a threshold the frame does not
// carry is not shown, and a frame with none says so instead of showing a
// default. Each value carries the unit its name ends in (E-13); a name the
// kit has no words for is shown as the system spells it.
import { fmtNum } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import type { Key } from "../i18n/en.js";
import { thresholdUnit } from "../live/frame.js";
import { cn } from "../ui/cn.js";

/**
 * The words for the thresholds the kit knows by name (the USSP's traffic
 * stream, uspace-ussp `trafficws.ThresholdsBody`). Display order is this
 * order, then any other name alphabetically (a display-only order).
 *
 * @beta
 */
export const THRESHOLD_KEYS: Readonly<Record<string, Key>> = {
  cpa_tcpa_max_s: "thresholds.cpa_tcpa_max_s",
  cpa_horizontal_min_m: "thresholds.cpa_horizontal_min_m",
  cpa_vertical_min_m: "thresholds.cpa_vertical_min_m",
  cpa_neighbour_radius_m: "thresholds.cpa_neighbour_radius_m",
  cpa_clear_after_s: "thresholds.cpa_clear_after_s",
  traffic_radius_m: "thresholds.traffic_radius_m",
};

/** @public */
export interface ThresholdsPanelProps {
  /** `LiveStatus.extras.thresholds`; null: the frame carries none. */
  thresholds: Readonly<Record<string, number>> | null;
  /** `LiveStatus.extras.evaluationPeriodS`, when the frame carries it. */
  evaluationPeriodS?: number | null;
  /** `LiveStatus.policyVersion`: the policy the values belong to. */
  policyVersion: string | null;
  className?: string;
}

const KNOWN = Object.keys(THRESHOLD_KEYS);

function order(names: string[]): string[] {
  const known = KNOWN.filter((n) => names.includes(n));
  const other = names.filter((n) => !KNOWN.includes(n)).sort();
  return [...known, ...other];
}

/** @public */
export function ThresholdsPanel(props: ThresholdsPanelProps) {
  const { thresholds, evaluationPeriodS, policyVersion, className } = props;
  const t = useT();
  const { lang } = useLang();
  const unitText = (u: "s" | "m" | null): string =>
    u === null ? "" : t(u === "s" ? "unit.symbol.s" : "unit.symbol.m");
  const value = (v: number, u: "s" | "m" | null): string =>
    fmtNum(v, Number.isInteger(v) ? 0 : 1, unitText(u), lang);
  const rows: { name: string; label: string; text: string }[] = [];
  if (thresholds !== null) {
    for (const name of order(Object.keys(thresholds))) {
      const v = thresholds[name];
      if (v === undefined) continue;
      const key = THRESHOLD_KEYS[name];
      rows.push({
        name,
        label:
          key === undefined ? t("thresholds.unlabelled", { name }) : t(key),
        text: value(v, thresholdUnit(name)),
      });
    }
  }
  if (evaluationPeriodS !== null && evaluationPeriodS !== undefined) {
    rows.push({
      name: "evaluation_period_s",
      label: t("thresholds.evaluation_period_s"),
      text: value(evaluationPeriodS, "s"),
    });
  }
  return (
    <section
      aria-label={t("thresholds.title")}
      data-panel="thresholds"
      data-thresholds={rows.length > 0 ? "present" : "absent"}
      className={cn(
        "rounded-md border border-border bg-card px-3 py-2 text-sm text-card-foreground",
        className,
      )}
    >
      <h2 className="m-0 text-sm font-semibold">{t("thresholds.title")}</h2>
      <p className="m-0 text-xs text-muted-foreground">
        {policyVersion === null
          ? t("thresholds.no_policy")
          : t("thresholds.policy", { version: policyVersion })}
      </p>
      {rows.length === 0 ? (
        <p className="m-0 mt-1" data-thresholds-none="">
          {t("thresholds.none")}
        </p>
      ) : (
        <dl className="m-0 mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
          {rows.map((r) => (
            <div key={r.name} className="contents" data-threshold={r.name}>
              <dt>{r.label}</dt>
              <dd className="m-0 text-right tabular-nums">{r.text}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="m-0 mt-1 text-xs text-muted-foreground">
        {t("thresholds.caption")}
      </p>
    </section>
  );
}

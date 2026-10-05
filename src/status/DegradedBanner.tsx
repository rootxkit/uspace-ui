"use client";
// DegradedBanner (docs/PLAN.md §3.12, WP-8; spec 02 F5 `degraded: [manned,
// dss]`, 05 §6 "nothing hides an aircraft", 02 F4 "never shows an empty
// sky as clear"): each degraded entry the status frame lists, in our words
// for the keys the spec names and in the server's for the rest, and the
// ages the frame carries (the CIS cache, each dataset, the registry
// projection). An age the frame does not carry is not mentioned at all:
// the banner never invents one. With nothing degraded and no age to show,
// it renders nothing.
import { fmtAge } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import type { DatasetAge } from "../live/frame.js";
import { cn } from "../ui/cn.js";
import { degradedLabel } from "./words.js";

/** @public */
export interface DegradedBannerProps {
  /** The status frame's `degraded[]`. */
  degraded: readonly string[];
  /** The status frame's `cis_age_s`, when it carries one. */
  cisAgeS?: number | null;
  /**
   * The app's bound on the CIS age (policy, e.g. 05: 300 s), when it has
   * one; an age at or over it is said to be over. No default.
   */
  cisStaleBoundS?: number | null;
  /** The status frame's `datasets{}` (CISP), when it carries them. */
  datasets?: Readonly<Record<string, DatasetAge>> | null;
  /** The status frame's `projection_age_s` (authority), when present. */
  projectionAgeS?: number | null;
  className?: string;
}

const known = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined && Number.isFinite(v);

/** @public */
export function DegradedBanner(props: DegradedBannerProps) {
  const {
    degraded,
    cisAgeS,
    cisStaleBoundS,
    datasets,
    projectionAgeS,
    className,
  } = props;
  const t = useT();
  const { lang } = useLang();
  const ages: { key: string; text: string; over?: boolean }[] = [];
  if (known(cisAgeS)) {
    const over =
      known(cisStaleBoundS) && cisStaleBoundS > 0 && cisAgeS >= cisStaleBoundS;
    ages.push({
      key: "cis",
      over,
      text: over
        ? t("degraded.cis_age_over", {
            age: fmtAge(cisAgeS, lang),
            bound: fmtAge(cisStaleBoundS, lang),
          })
        : t("degraded.cis_age", { age: fmtAge(cisAgeS, lang) }),
    });
  }
  if (datasets !== null && datasets !== undefined) {
    for (const [name, d] of Object.entries(datasets).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      ages.push({
        key: `dataset:${name}`,
        text: t("degraded.dataset_age", {
          dataset: name,
          version: d.version,
          age: fmtAge(d.ageS, lang),
        }),
      });
    }
  }
  if (known(projectionAgeS)) {
    ages.push({
      key: "projection",
      text: t("degraded.projection_age", { age: fmtAge(projectionAgeS, lang) }),
    });
  }
  if (degraded.length === 0 && ages.length === 0) return null;
  const isDegraded = degraded.length > 0;
  return (
    <section
      className={cn(
        "rounded-md border-2 bg-card px-3 py-2 text-sm text-card-foreground",
        isDegraded ? "border-severity-warning" : "border-border",
        className,
      )}
      aria-label={t("degraded.title")}
      data-banner="degraded"
      data-degraded={isDegraded ? "true" : "false"}
    >
      {isDegraded && (
        <>
          <h2 className="m-0 text-sm font-semibold">{t("degraded.title")}</h2>
          <ul className="m-0 mt-1 list-disc pl-5">
            {degraded.map((d) => (
              <li key={d} data-degraded-key={d}>
                {degradedLabel(d, t)}
              </li>
            ))}
          </ul>
        </>
      )}
      {ages.length > 0 && (
        <ul className={cn("m-0 list-none p-0 text-xs", isDegraded && "mt-2")}>
          {ages.map((a) => (
            <li
              key={a.key}
              data-age-of={a.key}
              data-over={a.over === true ? "true" : undefined}
            >
              {a.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

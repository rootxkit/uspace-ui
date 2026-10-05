"use client";
// AgeChip (docs/PLAN.md §3.12, WP-8): an age and its bucket under the
// server's `stale_after_s` (the thirds rule of `symbology/age`). The
// threshold has no default (INV-03): without one (null, zero, NaN) the
// chip shows the raw age with no bucket, visible and not wrong (PLAN §14
// Q6). An unknown age is a dash, never a zero (CLAUDE.md rule 6).
import { fmtAge } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import { AGE_BUCKET_KEYS, ageBucket } from "../symbology/age.js";
import { cn } from "../ui/cn.js";

/** @public */
export interface AgeChipProps {
  /** The age in seconds (`ageS`, `sourceAgeS`); null when unknown. */
  ageS: number | null;
  /** The feed's `stale_after_s`; null until the server sends one. */
  staleAfterS: number | null;
  className?: string;
}

const BORDER: Readonly<Record<string, string>> = {
  live: "border-age-live",
  aging: "border-age-aging",
  stale: "border-age-stale",
  unknown: "border-border",
};

/** @public */
export function AgeChip(props: AgeChipProps) {
  const { ageS, staleAfterS, className } = props;
  const t = useT();
  const { lang } = useLang();
  const bucket = ageBucket(ageS, staleAfterS ?? Number.NaN);
  // "unknown" covers both an unknown age and an unusable threshold; only
  // the second leaves a known age to show without a bucket.
  const bucketed = bucket !== "unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-xs tabular-nums",
        BORDER[bucket],
        className,
      )}
      data-age={bucket}
      data-age-s={
        ageS === null || !Number.isFinite(ageS) ? "" : String(Math.round(ageS))
      }
    >
      <span>{fmtAge(ageS, lang)}</span>
      {bucketed && <span>· {t(AGE_BUCKET_KEYS[bucket])}</span>}
      {!bucketed && ageS === null && (
        <span className="sr-only">{t(AGE_BUCKET_KEYS.unknown)}</span>
      )}
    </span>
  );
}

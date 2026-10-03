"use client";
// SourceStateBadge (docs/PLAN.md §3.12, WP-8): one source's state in the
// words of LESSONS B-03, B-04, B-11. A disabled source says who disabled
// it and how; a silent one says since when; the two never look alike
// (B-11). `lagging` says how far behind and that data still arrives;
// `unreachable` says the data is buffered at the source; neither says
// "lost" (C-12, B-04). The state is the server's (`createSourceStore`);
// the badge only words it.
import { fmtAge, fmtTimeUTC } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import type { Lang } from "../i18n/lang.js";
import type { Translate } from "../i18n/translate.js";
import type { SourceState, SourceView } from "../model/index.js";
import { sourceAgeS } from "../live/sourceStore.js";
import { cn } from "../ui/cn.js";
import { DISABLED_BY_KEYS, SOURCE_STATE_KEYS } from "./words.js";

/** A `SourceView`, with the age the live source store adds when present. */
export type SourceInput = SourceView & {
  ageS?: number | null;
  ageAtMs?: number;
};

export interface SourceStateBadgeProps {
  source: SourceInput;
  /** The app's clock tick (`useNowMs`). */
  nowMs: number;
  className?: string;
}

const BORDER: Readonly<Record<SourceState, string>> = {
  disabled: "border-severity-critical border-dashed",
  healthy: "border-age-live",
  stale: "border-age-stale",
  lagging: "border-age-aging",
  unreachable: "border-severity-warning",
  never_heard: "border-border border-dotted",
};

/** The display age of a source, or null (never heard, or no age given). */
export function sourceDisplayAgeS(
  s: SourceInput,
  nowMs: number,
): number | null {
  if (s.ageS === undefined || s.ageAtMs === undefined) return null;
  return sourceAgeS({ ageS: s.ageS, ageAtMs: s.ageAtMs }, nowMs);
}

/** The lines under a source's state: who and how, since when, how far behind. */
export function useSourceDetail(s: SourceInput, nowMs: number): string[] {
  const t = useT();
  const { lang } = useLang();
  return sourceDetailLines(s, sourceDisplayAgeS(s, nowMs), t, lang);
}

/**
 * The same lines without a provider, for a caller that has its own
 * translator (ReceiverLayer's hover card, WP-12): `ageS` is the source's
 * display age, or null.
 */
export function sourceDetailLines(
  s: Pick<
    SourceView,
    "state" | "disabledBy" | "disabledByWho" | "lastSeenAt" | "lagS"
  >,
  age: number | null,
  t: Translate,
  lang: Lang,
): string[] {
  const lines: string[] = [];
  switch (s.state) {
    case "disabled":
      if (s.disabledByWho !== null && s.disabledByWho.trim() !== "")
        lines.push(t("source.disabled_by", { who: s.disabledByWho }));
      if (s.disabledBy !== null) lines.push(t(DISABLED_BY_KEYS[s.disabledBy]));
      break;
    case "healthy":
      if (age !== null)
        lines.push(t("source.last_heard", { age: fmtAge(age, lang) }));
      break;
    case "lagging":
      if (s.lagS !== null)
        lines.push(t("source.lagging_by", { age: fmtAge(s.lagS, lang) }));
      break;
    case "stale":
    case "unreachable":
      if (s.lastSeenAt !== null)
        lines.push(
          t("source.silent_since", {
            time: fmtTimeUTC(s.lastSeenAt, lang, { seconds: true }),
          }),
        );
      if (age !== null)
        lines.push(t("source.last_heard", { age: fmtAge(age, lang) }));
      break;
    case "never_heard":
      break;
    default:
      return s.state satisfies never;
  }
  return lines;
}

export function SourceStateBadge(props: SourceStateBadgeProps) {
  const { source, nowMs, className } = props;
  const t = useT();
  const detail = useSourceDetail(source, nowMs);
  return (
    <span
      className={cn("inline-flex flex-col gap-0.5 text-sm", className)}
      data-source-state={source.state}
    >
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full border-2 px-2 py-0.5 text-xs font-medium",
          BORDER[source.state],
        )}
        data-part="state"
      >
        {t(SOURCE_STATE_KEYS[source.state])}
      </span>
      {detail.map((line) => (
        <span
          key={line}
          className="text-xs text-muted-foreground"
          data-part="detail"
        >
          {line}
        </span>
      ))}
    </span>
  );
}

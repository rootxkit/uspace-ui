"use client";
// IdentificationLegend (docs/PLAN.md §3.10, WP-7; spec 04 §3.2): the four
// identification statuses and "no identification", in `identOrder()`
// (expected first, then those needing attention, G-03), each with the
// colour and the mark the map draws, its name, what it means and an
// optional count; then the broadcast and provider caveats (R-05, PLAN
// §14 Q18) and the mismatch note (G-02). The statuses are the server's;
// the legend explains them.
import { useT } from "../i18n/I18nProvider.js";
import {
  IDENT_STATUS_HINT_KEYS,
  IDENT_STATUS_KEYS,
  identMark,
  identOrder,
  identToken,
  needsAttention,
  type IdentKey,
} from "../symbology/ident.js";
import { LegendCount, LegendNote, LegendSection } from "./LegendSection.js";

/** Swatch size in CSS pixels. Display-only constant. */
const SWATCH_PX = 18;

/** The status's colour as a disc, with its mark beside it as the map draws it. */
export function IdentSwatch(props: { status: IdentKey }) {
  const { status } = props;
  const mark = identMark(status);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5"
      aria-hidden="true"
    >
      <svg
        width={SWATCH_PX}
        height={SWATCH_PX}
        viewBox="0 0 18 18"
        data-token={identToken(status === "none" ? null : status)}
      >
        <circle
          cx="9"
          cy="9"
          r="7"
          fill={`var(${identToken(status === "none" ? null : status)})`}
          stroke="var(--us-surface)"
          strokeWidth="1"
        />
      </svg>
      <span className="w-3 text-center font-semibold" data-mark={mark}>
        {mark}
      </span>
    </span>
  );
}

export interface IdentificationLegendProps {
  /**
   * Tracks per status (`none`: no identification block), as the app
   * counted what it shows. When given, a status absent from it shows a
   * dash (not provided), never a zero.
   */
  counts?: Partial<Record<IdentKey, number>>;
  defaultCollapsed?: boolean;
  className?: string;
}

export function IdentificationLegend(props: IdentificationLegendProps) {
  const { counts, defaultCollapsed, className } = props;
  const t = useT();
  return (
    <LegendSection
      title={t("ident.legend.title")}
      kind="identification"
      defaultCollapsed={defaultCollapsed}
      className={className}
    >
      <ul className="mt-2 grid list-none gap-2 p-0">
        {identOrder().map((status) => {
          const mark = identMark(status);
          return (
            <li
              key={status}
              data-ident={status}
              data-attention={
                needsAttention(status === "none" ? null : status)
                  ? "true"
                  : "false"
              }
              className="flex items-start gap-2"
            >
              <IdentSwatch status={status} />
              <span className="min-w-0">
                {t(IDENT_STATUS_KEYS[status])}
                <span className="block text-xs text-muted-foreground">
                  {t(IDENT_STATUS_HINT_KEYS[status])}
                </span>
                <span className="sr-only">
                  {mark === ""
                    ? t("ident.legend.no_mark")
                    : t("ident.legend.mark", { mark })}
                </span>
              </span>
              <LegendCount
                counts={counts}
                row={status}
                format={(count) => t("track.legend.count", { count })}
              />
            </li>
          );
        })}
      </ul>
      <LegendNote note="attention">{t("ident.legend.attention")}</LegendNote>
      <LegendNote note="broadcast">{t("track.broadcast_caveat")}</LegendNote>
      <LegendNote note="provider">{t("ident.caveat.provider")}</LegendNote>
      <LegendNote note="mismatch">{t("ident.legend.mismatch")}</LegendNote>
    </LegendSection>
  );
}

"use client";
// TrackLegend (docs/PLAN.md §3.10, WP-7): the six trust classes, each with
// the symbol the map draws (the same outline, from the same generator),
// how it is filled (the broadcast hollow, the simulated dashed ring), its
// name and its one-line meaning from spec 04 §2, and the notes on what the
// colour, the arrow and the rings mean. A legend's meaning is a contract
// (PLAN §12): operators are trained on it.
import { useT } from "../i18n/I18nProvider.js";
import type { Trust } from "../model/index.js";
import {
  TRUST_FILL_KEYS,
  TRUST_KEYS,
  TRUST_MEANING_KEYS,
  trustOrder,
} from "../symbology/track.js";
import {
  TRACK_ICON_PX,
  trackIconParts,
  trustFill,
  trustShape,
} from "../symbology/trackIcon.js";
import { LegendCount, LegendNote, LegendSection } from "./LegendSection.js";

/** Swatch size in CSS pixels. Display-only constant. */
const SWATCH_PX = 24;

/**
 * The map's symbol of a trust class, in the current text colour (on the
 * map the colour is the identification status's). `directional` adds the
 * arrow the map rotates by the track's course.
 */
export function TrackSwatch(props: {
  trust: Trust;
  directional?: boolean;
  size?: number;
}) {
  const { trust, directional = false, size = SWATCH_PX } = props;
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      data-shape={trustShape(trust)}
      data-fill={trustFill(trust)}
      width={size}
      height={size}
      viewBox={`0 0 ${TRACK_ICON_PX} ${TRACK_ICON_PX}`}
    >
      {trackIconParts(trust, directional).map((p, i) =>
        p.fill ? (
          <path key={i} d={p.d} fill="currentColor" />
        ) : (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={p.strokeWidth}
            strokeDasharray={p.dash ?? undefined}
          />
        ),
      )}
    </svg>
  );
}

export interface TrackLegendProps {
  /**
   * Tracks per trust class, as the app counted what it shows. When given,
   * a class absent from it shows a dash (not provided), never a zero.
   */
  counts?: Partial<Record<Trust, number>>;
  defaultCollapsed?: boolean;
  className?: string;
}

export function TrackLegend(props: TrackLegendProps) {
  const { counts, defaultCollapsed, className } = props;
  const t = useT();
  return (
    <LegendSection
      title={t("track.legend.title")}
      kind="track"
      defaultCollapsed={defaultCollapsed}
      className={className}
    >
      <ul className="mt-2 grid list-none gap-2 p-0">
        {trustOrder().map((trust) => (
          <li key={trust} data-trust={trust} className="flex items-start gap-2">
            <TrackSwatch trust={trust} />
            <span className="min-w-0">
              {t(TRUST_KEYS[trust])}
              <span className="text-muted-foreground">
                {" · "}
                {t(TRUST_FILL_KEYS[trustFill(trust)])}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t(TRUST_MEANING_KEYS[trust])}
              </span>
            </span>
            <LegendCount
              counts={counts}
              row={trust}
              format={(count) => t("track.legend.count", { count })}
            />
          </li>
        ))}
      </ul>
      <LegendNote note="shape">{t("track.legend.shape")}</LegendNote>
      <LegendNote note="arrow">
        <span className="inline-flex items-center gap-1 align-middle">
          <TrackSwatch trust="authenticated" directional size={18} />
        </span>{" "}
        {t("track.legend.arrow")}
      </LegendNote>
      <LegendNote note="emergency">{t("track.legend.emergency")}</LegendNote>
      <LegendNote note="selected">{t("track.legend.selected")}</LegendNote>
    </LegendSection>
  );
}

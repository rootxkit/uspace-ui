"use client";
// ZoneLegend (docs/PLAN.md §3.10, WP-6): the five ED-318 zone types in a
// fixed order, each with the swatch the map draws (colour, pattern and
// outline weight, so the legend reads without colour), its name, an
// optional count, and the note on dimming: dimmed means the server said
// the zone does not apply now; full means it applies or the server did
// not say. A legend's meaning is a contract (PLAN §12): operators are
// trained on it.
import { useId, useState } from "react";

import { useT } from "../i18n/I18nProvider.js";
import type { ZoneType } from "../model/index.js";
import {
  ZONE_PATTERN_KEYS,
  ZONE_TYPE_KEYS,
  zoneLineWidthPx,
  zoneOrder,
  zonePattern,
  zonePatternFillOpacity,
  zoneToken,
} from "../symbology/zone.js";
import { cn } from "../ui/cn.js";

/** Swatch size in CSS pixels. Display-only constant. */
const SWATCH_W = 28;
const SWATCH_H = 18;

/**
 * The map's swatch of a zone type, in its token's colour.
 *
 * @beta
 */
export function ZoneSwatch(props: { type: ZoneType }) {
  const { type } = props;
  // A fragment id usable in `url(#...)` whatever React's id format.
  const pid = `us-zone-swatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const colour = `var(${zoneToken(type)})`;
  const pattern = zonePattern(type);
  const width = zoneLineWidthPx(type);
  // As the map draws it: a pattern, a solid tint, or no fill at all.
  const fill =
    pattern === "hatched" || pattern === "dotted"
      ? `url(#${pid})`
      : pattern === "solid"
        ? colour
        : "none";
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      data-pattern={pattern}
      width={SWATCH_W}
      height={SWATCH_H}
      viewBox={`0 0 ${SWATCH_W} ${SWATCH_H}`}
    >
      {pattern === "hatched" && (
        <pattern
          id={pid}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width="2" height="6" fill={colour} />
        </pattern>
      )}
      {pattern === "dotted" && (
        <pattern id={pid} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect x="1" y="1" width="2" height="2" fill={colour} />
        </pattern>
      )}
      <rect
        x={width / 2}
        y={width / 2}
        width={SWATCH_W - width}
        height={SWATCH_H - width}
        fill={fill}
        fillOpacity={pattern === "solid" ? zonePatternFillOpacity("solid") : 1}
        stroke={colour}
        strokeWidth={width}
      />
    </svg>
  );
}

/** @public */
export interface ZoneLegendProps {
  /**
   * Zones per type, as the app counted what it shows. When given, a type
   * absent from it shows a dash (not provided), never a zero.
   */
  counts?: Partial<Record<ZoneType, number>>;
  /** Start collapsed (default false). */
  defaultCollapsed?: boolean;
  className?: string;
}

/** @public */
export function ZoneLegend(props: ZoneLegendProps) {
  const { counts, defaultCollapsed = false, className } = props;
  const t = useT();
  const [open, setOpen] = useState(!defaultCollapsed);
  const listId = useId();
  return (
    <section
      className={cn(
        "us-legend rounded-md border border-border bg-card p-3 text-sm text-card-foreground",
        className,
      )}
      aria-label={t("zone.legend.title")}
      data-legend="zone"
    >
      <h2 className="m-0 text-sm font-semibold">
        <button
          type="button"
          className="w-full rounded-sm text-left font-semibold focus-visible:outline-2 focus-visible:outline-ring"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          {t("zone.legend.title")}
        </button>
      </h2>
      <div id={listId} hidden={!open}>
        <ul className="mt-2 grid list-none gap-1.5 p-0">
          {zoneOrder().map((type) => {
            const count = counts?.[type];
            return (
              <li
                key={type}
                data-zone-type={type}
                className="flex items-center gap-2"
              >
                <ZoneSwatch type={type} />
                <span className="min-w-0">
                  {t(ZONE_TYPE_KEYS[type])}
                  <span className="block text-xs text-muted-foreground">
                    {t(ZONE_PATTERN_KEYS[zonePattern(type)])}
                  </span>
                </span>
                {counts !== undefined &&
                  (count === undefined ? (
                    <span
                      className="ml-auto whitespace-nowrap tabular-nums"
                      data-count="absent"
                      title={t("common.not_provided")}
                    >
                      {t("common.dash")}
                      <span className="sr-only">
                        {t("common.not_provided")}
                      </span>
                    </span>
                  ) : (
                    <span
                      className="ml-auto whitespace-nowrap tabular-nums"
                      data-count={count}
                    >
                      {t("zone.legend.count", { count })}
                    </span>
                  ))}
              </li>
            );
          })}
        </ul>
        <p
          className="mt-2 mb-0 text-xs text-muted-foreground"
          data-note="dimmed"
        >
          {t("zone.legend.dimmed")}
        </p>
        <p
          className="mt-1 mb-0 text-xs text-muted-foreground"
          data-note="unstated"
        >
          {t("zone.legend.unstated")}
        </p>
      </div>
    </section>
  );
}

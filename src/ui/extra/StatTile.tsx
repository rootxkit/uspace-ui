"use client";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { useT } from "../../i18n/I18nProvider.js";
import type { StatusTone } from "../../theme/status.js";
import { cn } from "../cn.js";
import { STAT_UNKNOWN } from "./Stat.js";
import { StatusBadge } from "./StatusBadge.js";
import { TONE_FILL, TONE_TEXT } from "./tones.js";

/**
 * Which way a value moved, as the app worked it out from the API's
 * numbers; the kit draws it and never computes it.
 *
 * @public
 */
export type TrendDirection = "up" | "down" | "flat";

/** @public */
export interface StatTrend {
  direction: TrendDirection;
  /** The movement in words and numbers, such as "+3 since 10:00 UTC". */
  label: ReactNode;
  /**
   * Whether the movement is good or bad is the app's call (more tracks is
   * neither); without a tone the trend is neutral.
   */
  tone?: StatusTone;
}

/** @public */
export interface StatTileStatus {
  tone: StatusTone;
  /** The status in words, shown in the tile: the colour only repeats it. */
  label: ReactNode;
}

/** @public */
export interface StatTileProps {
  label: ReactNode;
  /** `null` is unknown and renders a dash, never a zero. */
  value: ReactNode | null;
  /** The unit as display text, such as "m AGL"; omitted for a count. */
  unit?: ReactNode;
  status?: StatTileStatus;
  trend?: StatTrend;
  /** A footnote, such as the time the value is as of. */
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

const TREND_KEY = {
  up: "stat.trend.up",
  down: "stat.trend.down",
  flat: "stat.trend.flat",
} as const;

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };

/**
 * One key figure: its label, value and unit, its status as a tone and as
 * words, and the app's trend. A KpiRow lays several out.
 *
 * @public
 */
export function StatTile(props: StatTileProps): ReactNode {
  const { label, value, unit, status, trend, hint, icon, className } = props;
  const t = useT();
  const unknown = value === null;
  const Arrow = trend === undefined ? null : TREND_ICON[trend.direction];
  return (
    <div
      data-slot="stat-tile"
      data-tone={status?.tone}
      className={cn(
        "relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-panel border border-border bg-card p-4 text-card-foreground shadow-panel",
        className,
      )}
    >
      {status !== undefined && (
        <span
          aria-hidden="true"
          data-part="bar"
          className={cn(
            "absolute inset-y-0 left-0 w-1",
            TONE_FILL[status.tone],
          )}
        />
      )}
      <p className="m-0 flex min-w-0 items-center gap-2 text-sm font-semibold text-muted-foreground">
        {icon !== undefined && (
          <span
            aria-hidden="true"
            className="inline-flex size-4 shrink-0 [&>svg]:size-4"
          >
            {icon}
          </span>
        )}
        <span className="min-w-0">{label}</span>
      </p>
      <p
        className="m-0 flex items-baseline gap-1.5 text-kpi font-bold tracking-tight text-foreground tabular-nums"
        data-part="value"
        data-unknown={unknown ? "" : undefined}
      >
        {unknown ? STAT_UNKNOWN : value}
        {!unknown && unit !== undefined && (
          <span className="text-sm font-normal tracking-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      {(status !== undefined || trend !== undefined) && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          {status !== undefined && (
            <StatusBadge tone={status.tone} data-part="status">
              {status.label}
            </StatusBadge>
          )}
          {trend !== undefined && Arrow !== null && (
            <span
              data-part="trend"
              data-direction={trend.direction}
              className={cn(
                "inline-flex items-center gap-1 font-semibold",
                TONE_TEXT[trend.tone ?? "neutral"],
              )}
            >
              <Arrow aria-hidden="true" className="size-3.5" />
              <span className="sr-only">
                {t("stat.trend", {
                  direction: t(TREND_KEY[trend.direction]),
                })}{" "}
              </span>
              <span>{trend.label}</span>
            </span>
          )}
        </div>
      )}
      {hint !== undefined && (
        <p className="m-0 text-xs text-muted-foreground" data-part="hint">
          {hint}
        </p>
      )}
    </div>
  );
}

/** @public */
export interface KpiRowProps {
  /** Names the group for assistive technology, such as "Airspace now". */
  label?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * A responsive row of StatTiles: as many columns as fit, each at least
 * 11rem wide, so a narrow screen stacks them.
 *
 * @public
 */
export function KpiRow(props: KpiRowProps): ReactNode {
  const { label, children, className } = props;
  return (
    <div
      data-slot="kpi-row"
      role={label === undefined ? undefined : "group"}
      aria-label={label}
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(min(11rem,100%),1fr))] gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

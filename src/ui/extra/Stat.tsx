import type { ReactNode } from "react";

import { cn } from "../cn.js";

/**
 * What a Stat shows for a value the API did not provide (PLAN §3).
 *
 * @beta
 */
export const STAT_UNKNOWN = "—";

/** @beta */
export interface StatProps {
  label: ReactNode;
  /** `null` is unknown and renders a dash, never a zero. */
  value: ReactNode | null;
  /** The unit as display text, such as "m AMSL"; omitted for a count. */
  unit?: ReactNode;
  className?: string;
}

/**
 * A labelled value with its unit.
 *
 * @beta
 */
export function Stat(props: StatProps): ReactNode {
  const { label, value, unit, className } = props;
  const unknown = value === null;
  return (
    <div data-slot="stat" className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className="text-lg font-semibold text-foreground tabular-nums"
        data-unknown={unknown ? "" : undefined}
      >
        {unknown ? STAT_UNKNOWN : value}
        {!unknown && unit !== undefined && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

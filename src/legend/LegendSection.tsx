"use client";
// The frame the track legends share (WP-7): a labelled region whose title
// is a keyboard-reachable toggle, as ZoneLegend draws it, and the count
// cell, which shows a dash (not provided) for a value the app did not
// count, never a zero (CLAUDE.md rule 6).
import { useId, useState, type ReactNode } from "react";

import { useT } from "../i18n/I18nProvider.js";
import { cn } from "../ui/cn.js";

/** @beta */
export interface LegendSectionProps {
  /** The region's name and the toggle's text, already translated. */
  title: string;
  /** `data-legend` on the region, for tests and the golden snapshots. */
  kind: string;
  defaultCollapsed?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** @beta */
export function LegendSection(props: LegendSectionProps) {
  const { title, kind, defaultCollapsed = false, className, children } = props;
  const [open, setOpen] = useState(!defaultCollapsed);
  const bodyId = useId();
  return (
    <section
      className={cn(
        "us-legend rounded-md border border-border bg-card p-3 text-sm text-card-foreground",
        className,
      )}
      aria-label={title}
      data-legend={kind}
    >
      <h2 className="m-0 text-sm font-semibold">
        <button
          type="button"
          className="w-full rounded-sm text-left font-semibold focus-visible:outline-2 focus-visible:outline-ring"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          {title}
        </button>
      </h2>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

/**
 * A row's count: the app's number through `format`, or a dash with "not
 * provided" when the app passed counts but none for this row.
 *
 * @beta
 */
export function LegendCount(props: {
  counts: Readonly<Record<string, number | undefined>> | undefined;
  row: string;
  format(count: number): string;
}) {
  const t = useT();
  const { counts, row, format } = props;
  if (counts === undefined) return null;
  const count = counts[row];
  if (count === undefined) {
    return (
      <span
        className="ml-auto whitespace-nowrap tabular-nums"
        data-count="absent"
        title={t("common.not_provided")}
      >
        {t("common.dash")}
        <span className="sr-only">{t("common.not_provided")}</span>
      </span>
    );
  }
  return (
    <span className="ml-auto whitespace-nowrap tabular-nums" data-count={count}>
      {format(count)}
    </span>
  );
}

/**
 * A note under a legend's list.
 *
 * @beta
 */
export function LegendNote(props: { note: string; children: ReactNode }) {
  return (
    <p
      className="mt-2 mb-0 text-xs text-muted-foreground"
      data-note={props.note}
    >
      {props.children}
    </p>
  );
}

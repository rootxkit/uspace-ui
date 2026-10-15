"use client";
import type { ReactNode } from "react";

import { fmtAge } from "../../i18n/format.js";
import { useLang, useT } from "../../i18n/I18nProvider.js";
import type { StatusTone } from "../../theme/status.js";
import { cn } from "../cn.js";
import { TONE_FILL, TONE_SOFT } from "./tones.js";

/**
 * What the top bar says about the console's data. `stale` is the server's
 * statement (its `stale` flag, or an age past the `stale_after_s` its
 * status frame sent), never a threshold of the kit's.
 *
 * @public
 */
export type FeedPillState = "live" | "stale" | "connecting" | "down";

/** @public */
export interface StatusPillProps {
  state: FeedPillState;
  /**
   * Seconds since the last update, from the app's clock tick; `null` is
   * "no update yet", absent shows no age.
   */
  ageS?: number | null;
  className?: string;
}

const TONE: Readonly<Record<FeedPillState, StatusTone>> = {
  live: "ok",
  stale: "warning",
  connecting: "info",
  down: "critical",
};

// C-12: down is "feed down, retrying", never "lost".
const WORD = {
  live: "feed.live",
  stale: "shell.stale",
  connecting: "feed.connecting",
  down: "feed.down_retrying",
} as const;

/**
 * The live/stale pill of the top bar: the feed's state in words, with
 * its tone and the age of the last update. A quiet live feed stays live
 * and its age climbs (E-02).
 *
 * @public
 */
export function StatusPill(props: StatusPillProps): ReactNode {
  const { state, ageS, className } = props;
  const t = useT();
  const { lang } = useLang();
  const word = t(WORD[state]);
  const age =
    ageS === undefined
      ? null
      : ageS === null
        ? t("shell.no_update_yet")
        : t("shell.updated_ago", { age: fmtAge(ageS, lang) });
  return (
    <span
      data-slot="status-pill"
      data-state={state}
      className={cn(
        "inline-flex h-7 max-w-full min-w-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold whitespace-nowrap",
        TONE_SOFT[TONE[state]],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-2 shrink-0 rounded-full ring-[3px] ring-current/20",
          TONE_FILL[TONE[state]],
        )}
      />
      <span className="sr-only">{t("shell.status")} </span>
      <span data-part="state">{word}</span>
      {age !== null && (
        <span
          data-part="age"
          className="min-w-0 truncate font-normal tabular-nums"
        >
          {age}
        </span>
      )}
    </span>
  );
}

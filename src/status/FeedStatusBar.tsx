"use client";
// FeedStatusBar (docs/PLAN.md §3.12, WP-8): the connection in words, the
// age of the last frame, the server's dropped-frame count (05 §5: shown
// when 0 as well, so a zero is seen to be a zero), the frames this console
// ignored, what is degraded, and a session that ended. `down` is "feed
// down, retrying" with the age of the last frame, never "data lost"
// (C-12). A quiet feed stays `live` and its last-frame age climbs (E-02).
import type { ReactNode } from "react";

import { fmtAge } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import type { FeedStatus } from "../model/index.js";
import { cn } from "../ui/cn.js";
import { CONNECTION_KEYS, degradedLabel } from "./words.js";

/**
 * `FeedStatus`, and what `useFeed` adds when the app passes its result:
 * the last frame's time, the ignored frames, a 4401 close.
 *
 * @public
 */
export type FeedStatusInput = FeedStatus & {
  lastFrameAtMs?: number | null;
  framesMalformed?: number;
  unauthorized?: boolean;
};

/** @public */
export interface FeedStatusBarProps {
  status: FeedStatusInput;
  /** The app's clock tick (`useNowMs`). */
  nowMs: number;
  className?: string;
}

const DOT: Readonly<Record<FeedStatus["connection"], string>> = {
  connecting: "bg-age-aging",
  live: "bg-age-live",
  down: "bg-severity-critical",
};

function Part(props: {
  part: string;
  children: ReactNode;
  extra?: Record<string, string>;
}) {
  return (
    <span data-part={props.part} {...props.extra}>
      {props.children}
    </span>
  );
}

/** @public */
export function FeedStatusBar(props: FeedStatusBarProps) {
  const { status, nowMs, className } = props;
  const t = useT();
  const { lang } = useLang();
  const last = status.lastFrameAtMs;
  const parts: ReactNode[] = [];
  if (last !== undefined) {
    parts.push(
      <Part key="last" part="last-frame">
        {last === null
          ? t("feed.no_frame_yet")
          : t("feed.last_frame", { age: fmtAge((nowMs - last) / 1000, lang) })}
      </Part>,
    );
  }
  parts.push(
    <Part
      key="dropped"
      part="dropped"
      extra={{ "data-dropped": String(status.droppedFrames) }}
    >
      {t("feed.dropped", { count: status.droppedFrames })}
    </Part>,
  );
  if (status.framesMalformed !== undefined && status.framesMalformed > 0) {
    parts.push(
      <Part key="malformed" part="malformed">
        {t("feed.malformed", { count: status.framesMalformed })}
      </Part>,
    );
  }
  if (status.degraded.length > 0) {
    parts.push(
      <Part key="degraded" part="degraded">
        {t("feed.degraded", {
          list: status.degraded.map((d) => degradedLabel(d, t)).join("; "),
        })}
      </Part>,
    );
  }
  if (status.connection === "live" && status.staleAfterS === null) {
    parts.push(
      <Part key="threshold" part="no-threshold">
        {t("feed.no_threshold")}
      </Part>,
    );
  }
  if (status.unauthorized === true) {
    parts.push(
      <Part key="session" part="session">
        {t("feed.session_expired")}
      </Part>,
    );
  }
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-card-foreground",
        className,
      )}
      data-connection={status.connection}
    >
      <span
        data-part="connection"
        className="inline-flex items-center gap-2 font-semibold"
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block size-2.5 rounded-full",
            DOT[status.connection],
          )}
        />
        {t(CONNECTION_KEYS[status.connection])}
      </span>
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-3">
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          {p}
        </span>
      ))}
    </div>
  );
}

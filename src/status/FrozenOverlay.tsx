"use client";
// FrozenOverlay (docs/PLAN.md §3.12, WP-8; spec 05 §6: consoles freeze
// with the age shown; 02 F4: never an empty sky shown as clear). While the
// feed is not live the picture stays, dimmed, under a notice that says the
// feed is down and retrying (never "lost", C-12) and how old the data is.
// Before any frame it says no data has arrived, so an empty map is not
// read as an empty sky. While the feed is live it renders nothing.
//
// Place it inside the map's positioned container, after the map: it
// covers its parent and lets the map underneath keep its controls.
import { fmtAge, fmtTimeUTC } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import { cn } from "../ui/cn.js";
import type { FeedStatusInput } from "./FeedStatusBar.js";
import { CONNECTION_KEYS } from "./words.js";

/** @public */
export interface FrozenOverlayProps {
  status: FeedStatusInput;
  /** The app's clock tick (`useNowMs`). */
  nowMs: number;
  className?: string;
}

/** @public */
export function FrozenOverlay(props: FrozenOverlayProps) {
  const { status, nowMs, className } = props;
  const t = useT();
  const { lang } = useLang();
  if (status.connection === "live") return null;
  const last = status.lastFrameAtMs;
  let line: string;
  if (last === undefined) {
    // A plain FeedStatus: how long the feed has been in this state.
    line = t("feed.frozen", {
      age: fmtAge((nowMs - status.sinceMs) / 1000, lang),
    });
  } else if (last === null) {
    line = t("feed.no_data_yet");
  } else {
    line = t("feed.as_of", {
      time: fmtTimeUTC(new Date(last).toISOString(), lang, { seconds: true }),
      age: fmtAge((nowMs - last) / 1000, lang),
    });
  }
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-background/50 p-4",
        className,
      )}
      data-overlay="frozen"
      data-connection={status.connection}
    >
      <div
        role="status"
        className="pointer-events-auto rounded-md border-2 border-severity-warning bg-card px-4 py-2 text-sm text-card-foreground shadow"
      >
        <p className="m-0 font-semibold">
          {t(CONNECTION_KEYS[status.connection])}
        </p>
        <p className="m-0" data-part="as-of">
          {line}
        </p>
      </div>
    </div>
  );
}

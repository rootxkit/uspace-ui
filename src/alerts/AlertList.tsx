"use client";
// AlertList (docs/PLAN.md §3.13, WP-11): every alert the app passes,
// critical first and then the most recently raised, each with its
// severity as glyph and word, its kind, its state, its one-line summary,
// its aircraft, the time it was raised (UTC, from the server, so a
// replayed alert keeps its time, C-08) and whether this console has
// acknowledged it. It hides nothing: a cleared alert stays, with its
// reason and its own numbers, for as long as the app passes it (the
// store's hold, C-14), and an unacknowledged or stale one stays until the
// server clears it. The acknowledge button exists only when the app says
// this user may acknowledge (`canAcknowledge`, its role decision; the
// authority's violations pass false, 01 §1 MUST NOT); the kit only calls
// back. A live region announces each new critical alert once, and again
// only when an alert's severity rises to critical (C-07).
import { useMemo, useState } from "react";

import { fmtAge, fmtTimeUTC } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import type { Lang } from "../i18n/lang.js";
import type { Translate } from "../i18n/translate.js";
import type { AlertView, TrackView } from "../model/index.js";
import { ageS } from "../live/time.js";
import { Button } from "../ui/button.js";
import { cn } from "../ui/cn.js";
import { alertChanges, sortAlerts, uniqueById, type Seen } from "./changes.js";
import { SeverityMark } from "./SeverityMark.js";
import { alertPeer, alertSummary, kindName } from "./summary.js";
import { ALERT_STATE_KEYS } from "./words.js";

/** @public */
export interface AlertListProps {
  /** Every alert to show (a store snapshot's values). */
  alerts: readonly AlertView[];
  /** The tracks, to say when a party is broadcast and unverified (R-05). */
  tracks?: ReadonlyMap<string, TrackView>;
  /** The app's clock tick (`useNowMs`), for the age of the last update. */
  nowMs: number;
  /** Called when the user acknowledges; recording it is the app's POST. */
  onAcknowledge?(a: AlertView): void;
  /** The app's role decision: may this user acknowledge? No default. */
  canAcknowledge: boolean;
  /** Called to centre the map on the alert (the app's `flyTo`). */
  onSelect?(a: AlertView): void;
  className?: string;
}

const BORDER = {
  critical: "border-severity-critical",
  warning: "border-severity-warning",
  info: "border-severity-info",
} as const;

/** Every party of an alert: its aircraft and the proximity peer. */
function parties(a: AlertView): string[] {
  const peer = alertPeer(a).trackId;
  return peer === null || a.aircraft.includes(peer)
    ? [...a.aircraft]
    : [...a.aircraft, peer];
}

/** True when a party is broadcast, by its track or by `detail.peer`. */
function involvesBroadcast(
  a: AlertView,
  tracks: ReadonlyMap<string, TrackView> | undefined,
): boolean {
  if (alertPeer(a).trust === "broadcast") return true;
  return parties(a).some((id) => tracks?.get(id)?.trust === "broadcast");
}

interface Announcer {
  input: readonly AlertView[] | null;
  seen: ReadonlyMap<string, Seen>;
  message: string;
  count: number;
}

function announce(
  prev: Announcer,
  alerts: readonly AlertView[],
  t: Translate,
  lang: Lang,
): Announcer {
  const { seen, changes } = alertChanges(prev.seen, alerts);
  const critical = changes.filter((c) => c.alert.severity === "critical");
  if (critical.length === 0) return { ...prev, input: alerts, seen };
  return {
    input: alerts,
    seen,
    count: prev.count + critical.length,
    message: critical
      .map(({ alert }) =>
        t("alert.list.announce", {
          kind: kindName(t, alert.kind),
          summary: alertSummary(alert, t, lang),
        }),
      )
      .join(" "),
  };
}

/** @public */
export function AlertList(props: AlertListProps) {
  const {
    alerts,
    tracks,
    nowMs,
    onAcknowledge,
    canAcknowledge,
    onSelect,
    className,
  } = props;
  const t = useT();
  const { lang } = useLang();
  const unique = useMemo(() => uniqueById(alerts), [alerts]);
  const sorted = useMemo(() => sortAlerts(unique), [unique]);

  // The announcement follows the alerts the page was given (React's
  // "adjust state when a prop changes"): computed once per new list.
  const [announcer, setAnnouncer] = useState<Announcer>({
    input: null,
    seen: new Map(),
    message: "",
    count: 0,
  });
  if (announcer.input !== unique) {
    setAnnouncer(announce(announcer, unique, t, lang));
  }

  const ackable = canAcknowledge && onAcknowledge !== undefined;
  return (
    <section
      className={cn("grid gap-2", className)}
      aria-label={t("alert.list.title")}
      data-alert-list=""
    >
      <div
        className="sr-only"
        role="alert"
        aria-live="assertive"
        data-announcements={announcer.count}
      >
        {announcer.message}
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-part="empty">
          {t("alert.list.empty")}
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {sorted.map((a) => {
            const kind = kindName(t, a.kind);
            const ids = a.aircraft.join(", ");
            const cleared = a.state === "cleared";
            const age = ageS(a, nowMs);
            return (
              <li
                key={a.alertId}
                className={cn(
                  "rounded-md border-2 border-l-8 bg-card p-2 text-sm text-card-foreground",
                  BORDER[a.severity],
                  cleared && "border-dashed",
                )}
                data-alert-id={a.alertId}
                data-severity={a.severity}
                data-state={a.state}
                data-acknowledged={String(a.acknowledged)}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <SeverityMark severity={a.severity} />
                  <span className="font-medium" data-part="kind">
                    {kind}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 text-xs",
                      cleared ? "border-dashed" : "border-solid",
                    )}
                    data-part="state"
                  >
                    <span className="sr-only">
                      {t("alert.list.state", {
                        state: t(ALERT_STATE_KEYS[a.state]),
                      })}
                    </span>
                    <span aria-hidden="true">
                      {t(ALERT_STATE_KEYS[a.state])}
                    </span>
                  </span>
                </div>
                <p className="my-1" data-part="summary">
                  {alertSummary(a, t, lang)}
                </p>
                {involvesBroadcast(a, tracks) && (
                  <p className="my-1 text-xs" data-part="caveat">
                    {t("alert.broadcast_caveat")}
                  </p>
                )}
                <p
                  className="my-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground"
                  data-part="meta"
                >
                  <span>{t("alert.list.aircraft", { ids })}</span>
                  <span>
                    {t("alert.list.raised_at", {
                      time: fmtTimeUTC(a.raisedAt, lang, { seconds: true }),
                    })}
                  </span>
                  <span data-part="received">
                    {t("alert.list.received", { age: fmtAge(age, lang) })}
                  </span>
                  <span>
                    {t("alert.list.policy", { version: a.policyVersion })}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {a.acknowledged ? (
                    <span className="text-xs" data-part="ack">
                      {t("alert.list.acknowledged")}
                    </span>
                  ) : (
                    !cleared && (
                      <span className="text-xs font-medium" data-part="ack">
                        {t("alert.list.not_acknowledged")}
                      </span>
                    )
                  )}
                  {ackable && !cleared && !a.acknowledged && (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={t("alert.list.acknowledge_label", {
                        kind,
                        ids,
                      })}
                      onClick={() => {
                        onAcknowledge(a);
                      }}
                    >
                      {t("alert.list.acknowledge")}
                    </Button>
                  )}
                  {onSelect !== undefined && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t("alert.list.show", { kind, ids })}
                      onClick={() => {
                        onSelect(a);
                      }}
                    >
                      {t("alert.list.show_short")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

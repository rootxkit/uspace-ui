"use client";
// AlertToaster (docs/PLAN.md §3.13, WP-11): a notice for each alert this
// page has not shown and for each severity rise (C-07), one notice per
// alert id, replaced in place and never stacked (C-06), and the tone
// while a critical alert is not acknowledged on this console (PLAN §14
// Q15: the tone stops on the local flag, so an operator is never left
// with a tone they cannot stop while the API is down).
//
// A critical notice stays until the alert is acknowledged or cleared; a
// warning or information notice can be dismissed and leaves on its own
// after a display hold. Either way the alert stays in the list: a notice
// is a pointer, never the record. The sound control is always on screen
// when the app allows a tone: "enable" until a gesture has started audio,
// then on or off, so a silent console is a visible state (E-02).
import { XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DASH, fmtNum } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import type { AlertView, Severity } from "../model/index.js";
import { SEVERITY_KEYS } from "../symbology/severity.js";
import { Button } from "../ui/button.js";
import { cn } from "../ui/cn.js";
import {
  alertChanges,
  soundingAlerts,
  uniqueById,
  type AlertChange,
  type Seen,
} from "./changes.js";
import { SeverityMark } from "./SeverityMark.js";
import { alertSummary, kindName } from "./summary.js";
import { useAlertTone, validRepeatMs, type AlertTone } from "./tone.js";

/**
 * How long a warning or information notice stays before it leaves on its
 * own. A display constant, not a threshold: the alert itself stays in
 * the list for as long as the server holds it.
 */
export const TOAST_HOLD_MS = 15_000;

/** At most this many notices on screen; the oldest non-critical goes first. Display constant. */
export const TOAST_LIMIT = 5;

export interface AlertToasterProps {
  /** Every alert the app shows (a store snapshot's values). */
  alerts: readonly AlertView[];
  /**
   * The tone for critical alerts: `tone` is the app's switch, `repeatMs`
   * the server's repeat period (02 F5). Required when given: no default.
   * Without it there is no tone, and the toaster says so.
   */
  critical?: { tone: boolean; repeatMs: number };
  className?: string;
}

interface Toast {
  alertId: string;
  change: AlertChange["change"];
  severity: Severity;
  /** Order of arrival, for the limit. */
  seq: number;
}

interface Toasts {
  input: readonly AlertView[] | null;
  seen: ReadonlyMap<string, Seen>;
  list: readonly Toast[];
  seq: number;
}

/** The notices after `alerts` arrived: new ones in, gone ones out. */
function nextToasts(prev: Toasts, alerts: readonly AlertView[]): Toasts {
  const { seen, changes } = alertChanges(prev.seen, alerts);
  const byId = new Map(alerts.map((a) => [a.alertId, a]));
  let seq = prev.seq;
  const list = new Map<string, Toast>();
  for (const toast of prev.list) {
    const a = byId.get(toast.alertId);
    // A notice leaves with its alert's clear or acknowledgement; the
    // list shows both.
    if (a === undefined || a.state === "cleared" || a.acknowledged) continue;
    list.set(toast.alertId, toast);
  }
  for (const { alert, change } of changes) {
    if (alert.acknowledged) continue;
    seq += 1;
    // One notice per alert id: a new change replaces the old notice.
    list.delete(alert.alertId);
    list.set(alert.alertId, {
      alertId: alert.alertId,
      change,
      severity: alert.severity,
      seq,
    });
  }
  let kept = [...list.values()];
  while (kept.length > TOAST_LIMIT) {
    const victim =
      kept.find((x) => x.severity !== "critical") ?? (kept[0] as Toast);
    kept = kept.filter((x) => x !== victim);
  }
  return { input: alerts, seen, list: kept, seq };
}

function ToneControl(props: { tone: AlertTone; repeatMs: number }) {
  const { tone, repeatMs } = props;
  const t = useT();
  const { lang } = useLang();
  const period = validRepeatMs(repeatMs)
    ? fmtNum(repeatMs / 1000, 0, undefined, lang)
    : DASH;
  const status = {
    needs_gesture: t("alert.tone.needs_gesture"),
    on: t("alert.tone.on"),
    muted: t("alert.tone.muted"),
    unavailable: t("alert.tone.unavailable"),
  }[tone.state];
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border bg-popover p-2 text-xs text-popover-foreground"
      data-tone={tone.state}
      data-sounding={String(tone.sounding)}
    >
      <span role="status" className="font-medium">
        {status}
      </span>
      {(tone.state === "on" || tone.state === "needs_gesture") && (
        <span>{t("alert.tone.repeat", { s: period })}</span>
      )}
      {tone.state === "needs_gesture" && (
        <Button size="sm" onClick={tone.enable}>
          {t("alert.tone.enable")}
        </Button>
      )}
      {tone.state === "on" && (
        <Button size="sm" variant="outline" onClick={tone.mute}>
          {t("alert.tone.mute")}
        </Button>
      )}
      {tone.state === "muted" && (
        <Button size="sm" onClick={tone.unmute}>
          {t("alert.tone.unmute")}
        </Button>
      )}
    </div>
  );
}

const BORDER = {
  critical: "border-severity-critical",
  warning: "border-severity-warning",
  info: "border-severity-info",
} as const;

export function AlertToaster(props: AlertToasterProps) {
  const { alerts, critical, className } = props;
  const t = useT();
  const { lang } = useLang();
  const unique = useMemo(() => uniqueById(alerts), [alerts]);

  const [toasts, setToasts] = useState<Toasts>({
    input: null,
    seen: new Map(),
    list: [],
    seq: 0,
  });
  if (toasts.input !== unique) setToasts(nextToasts(toasts, unique));

  // A non-critical notice leaves after the display hold.
  const expiring = toasts.list
    .filter((x) => x.severity !== "critical")
    .map((x) => `${x.alertId}#${x.seq}`)
    .join(" ");
  useEffect(() => {
    if (expiring === "") return;
    const ids = new Set(expiring.split(" "));
    const id = setTimeout(() => {
      setToasts((s) => ({
        ...s,
        list: s.list.filter((x) => !ids.has(`${x.alertId}#${x.seq}`)),
      }));
    }, TOAST_HOLD_MS);
    return () => {
      clearTimeout(id);
    };
  }, [expiring]);

  const sounding = soundingAlerts(unique);
  const cue = sounding
    .map((a) => a.alertId)
    .sort()
    .join(" ");
  const repeatMs = critical?.repeatMs ?? Number.NaN;
  const tone = useAlertTone(
    critical?.tone === true && sounding.length > 0,
    repeatMs,
    cue,
  );

  const byId = new Map(unique.map((a) => [a.alertId, a]));
  return (
    <section
      className={cn(
        "pointer-events-none fixed right-4 bottom-4 z-50 grid w-[min(28rem,calc(100vw-2rem))] gap-2",
        className,
      )}
      aria-label={t("alert.toast.region")}
      data-alert-toaster=""
    >
      <ol className="m-0 grid list-none gap-2 p-0" aria-live="polite">
        {toasts.list.map((toast) => {
          const a = byId.get(toast.alertId);
          if (a === undefined) return null;
          const kind = kindName(t, a.kind);
          const severity = t(SEVERITY_KEYS[a.severity]);
          return (
            <li
              key={toast.alertId}
              className={cn(
                "pointer-events-auto rounded-md border-2 border-l-8 bg-popover p-3 text-sm text-popover-foreground shadow-md",
                BORDER[a.severity],
              )}
              data-toast={toast.alertId}
              data-change={toast.change}
              data-severity={a.severity}
            >
              <div className="flex items-start justify-between gap-2">
                <SeverityMark severity={a.severity} />
                {a.severity !== "critical" && (
                  <Button
                    size="xs"
                    variant="ghost"
                    aria-label={t("alert.toast.dismiss")}
                    onClick={() => {
                      setToasts((s) => ({
                        ...s,
                        list: s.list.filter((x) => x.alertId !== a.alertId),
                      }));
                    }}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                )}
              </div>
              <p className="my-1 font-medium">
                {toast.change === "rose"
                  ? t("alert.toast.rose", { severity, kind })
                  : t("alert.toast.raised", { severity, kind })}
              </p>
              <p className="my-1">{alertSummary(a, t, lang)}</p>
            </li>
          );
        })}
      </ol>
      <div className="pointer-events-auto">
        {critical === undefined || !critical.tone ? (
          <p
            className="m-0 rounded-md border bg-popover p-2 text-xs text-popover-foreground"
            data-tone="disabled"
          >
            {t("alert.tone.disabled")}
          </p>
        ) : (
          <ToneControl tone={tone} repeatMs={repeatMs} />
        )}
      </div>
    </section>
  );
}

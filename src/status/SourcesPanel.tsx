"use client";
// SourcesPanel (docs/PLAN.md §3.12, WP-8): every source the status frame
// names, grouped by type, with its state, counters and, for a person who
// may switch it, a switch. The switch opens a confirm dialog with a
// mandatory reason (LESSONS B-09, B-11) and only calls back: recording the
// change is the app's API call (PLAN §7 "display is not authorisation").
// Until WP-10's ConfirmDialog lands, the dialog is this minimal one on the
// vendored `ui` Dialog. A source switched off with its whole type is
// switched at the type's row, not at its own.
import { useId, useState } from "react";

import { fmtNum } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import type { SourceView } from "../model/index.js";
import { Button } from "../ui/button.js";
import { cn } from "../ui/cn.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.js";
import { Label } from "../ui/label.js";
import { Textarea } from "../ui/textarea.js";
import { SourceStateBadge, type SourceInput } from "./SourceStateBadge.js";

export interface SourcesPanelProps {
  sources: readonly SourceInput[];
  /** The app's clock tick (`useNowMs`). */
  nowMs: number;
  /** Called with the trimmed reason once the person confirms. */
  onSwitch?(s: SourceView, enabled: boolean, reason: string): void;
  /** Whether this person may switch sources (the API decides again). */
  canSwitch: boolean;
  className?: string;
}

function rowName(s: SourceView, t: ReturnType<typeof useT>): string {
  return s.instanceId ?? t("source.all", { type: s.sourceType });
}

function SwitchDialog(props: {
  source: SourceView;
  name: string;
  enable: boolean;
  onConfirm(reason: string): void;
  onClose(): void;
}) {
  const { source, name, enable, onConfirm, onClose } = props;
  const t = useT();
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const fieldId = useId();
  const errorId = useId();
  const blank = reason.trim() === "";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent showCloseButton={false} data-switch-for={name}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (blank) return;
            onConfirm(reason.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t(
                enable
                  ? "source.switch.title_enable"
                  : "source.switch.title_disable",
                { name },
              )}
            </DialogTitle>
            <DialogDescription>
              {t("source.switch.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={fieldId}>{t("source.switch.reason")}</Label>
            <Textarea
              id={fieldId}
              value={reason}
              aria-required="true"
              aria-invalid={tried && blank ? true : undefined}
              aria-describedby={tried && blank ? errorId : undefined}
              data-source-type={source.sourceType}
              onChange={(e) => {
                setReason(e.target.value);
              }}
            />
            {tried && blank && (
              <p
                id={errorId}
                className="m-0 text-sm text-severity-critical"
                role="alert"
              >
                {t("source.switch.reason_required")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" aria-disabled={blank ? true : undefined}>
              {t("action.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SourceRow(props: {
  s: SourceInput;
  nowMs: number;
  switchable: boolean;
  onOpen(s: SourceInput): void;
}) {
  const { s, nowMs, switchable, onOpen } = props;
  const t = useT();
  const { lang } = useLang();
  const name = rowName(s, t);
  const enable = s.state === "disabled";
  return (
    <li
      className="flex flex-wrap items-start justify-between gap-2 border-t border-border py-2 first:border-t-0"
      data-source={`${s.sourceType}/${s.instanceId ?? "*"}`}
    >
      <div className="grid min-w-0 gap-1">
        <span
          className={cn(
            "font-medium",
            s.instanceId !== null && "font-mono text-xs",
          )}
        >
          {name}
        </span>
        <SourceStateBadge source={s} nowMs={nowMs} />
        <span className="text-xs text-muted-foreground" data-part="counters">
          {t("source.counters", {
            accepted: fmtNum(s.accepted, 0, undefined, lang),
            refused: fmtNum(s.refused, 0, undefined, lang),
          })}
        </span>
      </div>
      {switchable && (
        <Button
          type="button"
          size="sm"
          variant={enable ? "default" : "outline"}
          aria-label={t(
            enable
              ? "source.switch.title_enable"
              : "source.switch.title_disable",
            { name },
          )}
          onClick={() => {
            onOpen(s);
          }}
        >
          {t(enable ? "source.switch.enable" : "source.switch.disable")}
        </Button>
      )}
      {!switchable && s.instanceId !== null && s.disabledBy === "type" && (
        <span className="text-xs text-muted-foreground" data-part="at-type">
          {t("source.switch.at_type")}
        </span>
      )}
    </li>
  );
}

export function SourcesPanel(props: SourcesPanelProps) {
  const { sources, nowMs, onSwitch, canSwitch, className } = props;
  const t = useT();
  const [open, setOpen] = useState<SourceInput | null>(null);
  const groups = new Map<string, SourceInput[]>();
  for (const s of sources) {
    const list = groups.get(s.sourceType) ?? [];
    list.push(s);
    groups.set(s.sourceType, list);
  }
  const mayOpen = (s: SourceInput): boolean =>
    canSwitch &&
    onSwitch !== undefined &&
    // An instance off with its whole type is switched at the type's row.
    !(
      s.instanceId !== null &&
      s.state === "disabled" &&
      s.disabledBy === "type"
    );
  return (
    <section
      className={cn(
        "rounded-md border border-border bg-card p-3 text-sm text-card-foreground",
        className,
      )}
      aria-label={t("source.panel.title")}
      data-panel="sources"
    >
      <h2 className="m-0 mb-2 text-sm font-semibold">
        {t("source.panel.title")}
      </h2>
      {sources.length === 0 && (
        <p className="m-0 text-muted-foreground" data-part="empty">
          {t("source.panel.empty")}
        </p>
      )}
      {[...groups].map(([type, list]) => (
        <section
          key={type}
          aria-label={type}
          data-source-type={type}
          className="mt-2"
        >
          <h3 className="m-0 font-mono text-xs font-semibold">{type}</h3>
          <ul className="m-0 list-none p-0">
            {list.map((s) => (
              <SourceRow
                key={`${s.sourceType}/${s.instanceId ?? "*"}`}
                s={s}
                nowMs={nowMs}
                switchable={mayOpen(s)}
                onOpen={setOpen}
              />
            ))}
          </ul>
        </section>
      ))}
      {open !== null && onSwitch !== undefined && (
        <SwitchDialog
          source={open}
          name={rowName(open, t)}
          enable={open.state === "disabled"}
          onClose={() => {
            setOpen(null);
          }}
          onConfirm={(reason) => {
            onSwitch(open, open.state === "disabled", reason);
            setOpen(null);
          }}
        />
      )}
    </section>
  );
}

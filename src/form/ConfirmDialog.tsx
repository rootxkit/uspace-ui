"use client";
// ConfirmDialog (docs/PLAN.md §3.15, WP-10): every audited act (a source
// switch, a publication, a certificate status) goes through a dialog that
// names the act and, when the act needs one, asks for the reason (spec
// 02 §1: "every disable is an audited act by a person"; LESSONS B-09,
// B-11: a switch has a reason and a person). The kit only calls back with
// the reason; recording the act is the app's API call (PLAN §7).
//
// A destructive act never has its confirm button focused when the dialog
// opens, so a stray Enter cannot confirm it: focus goes to the reason, or
// to Cancel. Escape cancels; focus returns to the element that opened it.
import { useId, useRef, useState, type ReactNode } from "react";

import { useT } from "../i18n/I18nProvider.js";
import type { Vars } from "../i18n/translate.js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog.js";
import { Button } from "../ui/button.js";
import { Label } from "../ui/label.js";
import { Textarea } from "../ui/textarea.js";

export interface ConfirmReason {
  required: true;
  /** The minimum length the caller's policy sets; no default. */
  minLength: number;
}

export interface ConfirmDialogProps {
  titleKey: string;
  bodyKey: string;
  /** Interpolated into the title and the body (`{name}`). */
  vars?: Vars;
  /** Ask for a reason before the act; it is passed to `onConfirm`. */
  reason?: ConfirmReason;
  /** A destructive act: red confirm button, never focused on open. */
  destructive?: boolean;
  confirmLabelKey?: string;
  cancelLabelKey?: string;
  /** Called once the person confirms, with the trimmed reason when asked. */
  onConfirm(reason?: string): void;
  /** Called when the person cancels (button, Escape, outside click). */
  onCancel?(): void;
  /** Controlled open state; omit it and pass `trigger` instead. */
  open?: boolean;
  onOpenChange?(open: boolean): void;
  /** The element that opens the dialog (rendered as the trigger). */
  trigger?: ReactNode;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    titleKey,
    bodyKey,
    vars,
    reason,
    destructive = false,
    confirmLabelKey = "action.confirm",
    cancelLabelKey = "action.cancel",
    onConfirm,
    onCancel,
    trigger,
  } = props;
  const t = useT();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = props.open ?? ownOpen;
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const reasonId = useId();
  const errorId = useId();
  const countId = useId();

  const setOpen = (next: boolean) => {
    // Each opening starts with an empty reason.
    setText("");
    setTried(false);
    if (props.open === undefined) setOwnOpen(next);
    props.onOpenChange?.(next);
  };

  const trimmed = text.trim();
  const short = reason !== undefined && trimmed.length < reason.minLength;
  const errorKey =
    trimmed.length === 0
      ? "form.error.required"
      : "form.error.reason_too_short";

  const confirm = () => {
    if (reason !== undefined && short) {
      setTried(true);
      reasonRef.current?.focus();
      return;
    }
    onConfirm(reason === undefined ? undefined : trimmed);
    setOpen(false);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel?.();
        setOpen(next);
      }}
    >
      {trigger !== undefined && (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      )}
      <AlertDialogContent
        data-destructive={destructive ? "true" : "false"}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const target =
            reason !== undefined
              ? reasonRef.current
              : destructive
                ? cancelRef.current
                : confirmRef.current;
          target?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t(titleKey, vars)}</AlertDialogTitle>
          <AlertDialogDescription>{t(bodyKey, vars)}</AlertDialogDescription>
        </AlertDialogHeader>
        {reason !== undefined && (
          <div className="grid gap-1.5">
            <Label htmlFor={reasonId}>
              {t("form.reason")}
              <span aria-hidden="true" className="text-severity-critical">
                {" *"}
              </span>
            </Label>
            <Textarea
              ref={reasonRef}
              id={reasonId}
              value={text}
              aria-required="true"
              aria-invalid={tried && short ? true : undefined}
              aria-describedby={
                tried && short ? `${countId} ${errorId}` : countId
              }
              onChange={(e) => {
                setText(e.target.value);
              }}
            />
            <p id={countId} className="m-0 text-xs text-muted-foreground">
              {t("form.reason_count", {
                count: trimmed.length,
                min: reason.minLength,
              })}
            </p>
            {tried && short && (
              <p
                id={errorId}
                role="alert"
                className="m-0 text-sm font-medium text-severity-critical"
              >
                {t(errorKey)}
              </p>
            )}
            <p className="m-0 text-xs text-muted-foreground">
              {t("form.confirm.recorded")}
            </p>
          </div>
        )}
        <AlertDialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={() => {
              onCancel?.();
              setOpen(false);
            }}
          >
            {t(cancelLabelKey)}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={destructive ? "destructive" : "default"}
            data-part="confirm"
            onClick={confirm}
          >
            {t(confirmLabelKey)}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

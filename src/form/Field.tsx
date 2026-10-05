"use client";
// Field (docs/PLAN.md §3.15): one labelled control with its required mark,
// hint and error. The unit and the datum are in the label text, always
// ("Upper limit (m, AMSL)"; LESSONS E-13, D-01): a number without them is
// never asked for. A time field's label ends with "UTC" (S-16).
import { useEffect, useId, type ReactNode } from "react";
import { get, useFormState } from "react-hook-form";

import type { Key } from "../i18n/en.js";
import { useT } from "../i18n/I18nProvider.js";
import type { Translate } from "../i18n/translate.js";
import type { VerticalRef } from "../model/index.js";
import { cn } from "../ui/cn.js";
import { Label } from "../ui/label.js";
import {
  FieldContext,
  errorText,
  useFormKit,
  useHasKey,
  type HeldError,
} from "./context.js";

/**
 * The catalogue key each vertical reference is named with in a label.
 *
 * @beta
 */
export const DATUM_KEYS: Readonly<Record<VerticalRef, Key>> = Object.freeze({
  AMSL: "form.datum.AMSL",
  AGL: "form.datum.AGL",
  WGS84: "form.datum.WGS84",
});

/**
 * Unit symbols for `Field.unit`; an app may pass its own catalogue key.
 *
 * @beta
 */
export const FORM_UNIT_KEYS = Object.freeze({
  m: "form.unit.m",
  ft: "form.unit.ft",
  ms: "form.unit.ms",
  s: "form.unit.s",
  min: "form.unit.min",
  deg: "form.unit.deg",
  kg: "form.unit.kg",
  pct: "form.unit.pct",
} as const satisfies Record<string, Key>);

/** @public */
export interface FieldLabelParts {
  labelKey: string;
  /** The catalogue key of the unit (`FORM_UNIT_KEYS`, or the app's). */
  unit?: string | undefined;
  /** The vertical reference; null while the person has not chosen one. */
  datum?: VerticalRef | null | undefined;
  /** A time in UTC: the label ends with "UTC". */
  utc?: boolean | undefined;
}

/**
 * The label text: name, then unit and datum, then UTC for a time.
 *
 * @beta
 */
export function fieldLabel(t: Translate, p: FieldLabelParts): string {
  const label = t(p.labelKey);
  const unit = p.unit === undefined ? null : t(p.unit);
  const datum =
    p.datum === undefined || p.datum === null ? null : t(DATUM_KEYS[p.datum]);
  let text = label;
  if (unit !== null && datum !== null)
    text = t("form.label_unit_datum", { label, unit, datum });
  else if (unit !== null) text = t("form.label_unit", { label, unit });
  else if (datum !== null) text = t("form.label_datum", { label, datum });
  return p.utc === true ? t("form.label_utc", { label: text }) : text;
}

/** @public */
export interface FieldProps extends FieldLabelParts {
  /** The react-hook-form name; dots for nesting (`features.0.name`). */
  name: string;
  hintKey?: string;
  required?: boolean;
  disabled?: boolean;
  /** The control sits before its label (a checkbox). */
  inline?: boolean;
  className?: string;
  children: ReactNode;
}

/** The error held for `name`, or a field array's own error under `root`. */
export function heldError(
  errors: unknown,
  name: string,
): HeldError | undefined {
  const own = get(errors, name) as
    (HeldError & { root?: HeldError }) | undefined;
  if (own === undefined) return undefined;
  if (own.root !== undefined) return own.root;
  return own.type === undefined && own.message === undefined ? undefined : own;
}

/** @public */
export function Field(props: FieldProps) {
  const {
    name,
    hintKey,
    required = false,
    disabled = false,
    inline = false,
    className,
    children,
  } = props;
  const t = useT();
  const hasKey = useHasKey();
  const kit = useFormKit();
  const { errors } = useFormState({ name, exact: false });
  const base = useId();
  const id = kit.idFor(name);
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;
  const label = fieldLabel(t, props);
  useEffect(
    () => kit.register(name, { id, label, required }),
    [kit, name, id, label, required],
  );
  const err = heldError(errors, name);
  const text = err === undefined ? null : errorText(err, t, hasKey);
  const describedBy =
    [hintKey === undefined ? null : hintId, text === null ? null : errorId]
      .filter((v) => v !== null)
      .join(" ") || undefined;
  const labelEl = (
    <Label htmlFor={id} className={cn(inline && "font-normal")}>
      {label}
      {required && (
        <span aria-hidden="true" className="text-severity-critical">
          {" *"}
        </span>
      )}
    </Label>
  );
  return (
    <div
      className={cn("grid gap-1.5", className)}
      data-field={name}
      data-invalid={text === null ? undefined : "true"}
    >
      <FieldContext.Provider
        value={{
          name,
          id,
          describedBy,
          invalid: text !== null,
          required,
          disabled,
        }}
      >
        {inline ? (
          <div className="flex items-center gap-2">
            {children}
            {labelEl}
          </div>
        ) : (
          <>
            {labelEl}
            {children}
          </>
        )}
      </FieldContext.Provider>
      {hintKey !== undefined && (
        <p id={hintId} className="m-0 text-xs text-muted-foreground">
          {t(hintKey)}
        </p>
      )}
      {text !== null && (
        <p
          id={errorId}
          className="m-0 text-sm font-medium text-severity-critical"
          data-part="field-error"
        >
          {text}
        </p>
      )}
    </div>
  );
}

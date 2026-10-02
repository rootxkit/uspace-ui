"use client";
// The form kit's fields (docs/PLAN.md §3.15, WP-10). Each is a `Field`
// (label with unit and datum, required mark, hint, error wiring) around a
// control registered with react-hook-form. They store what the API reads:
// a number or null (never 0 for an empty box), an RFC 3339 UTC time with
// `Z`, four numbers in [lng, lat] order, an enumeration value or null.
import { useEffect, useRef, useState } from "react";
import {
  useController,
  useFormContext,
  useFormState,
  useWatch,
} from "react-hook-form";

import { useLang, useT } from "../i18n/I18nProvider.js";
import { Input } from "../ui/input.js";
import { Textarea } from "../ui/textarea.js";
import { cn } from "../ui/cn.js";
import {
  errorText,
  useFieldControl,
  useFormKit,
  useHasKey,
} from "./context.js";
import { Field, heldError, type FieldProps } from "./Field.js";
import { formatLocaleNumber, parseLocaleNumber } from "./number.js";
import { inputToUtc, utcToInput } from "./utc.js";

export type FieldBaseProps = Omit<FieldProps, "children" | "inline" | "utc">;

const SELECT_CLASS =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

function TextControl(props: {
  name: string;
  type: string;
  autoComplete?: string;
}) {
  const { register } = useFormContext();
  const control = useFieldControl();
  return (
    <Input
      {...register(props.name)}
      {...control}
      type={props.type}
      autoComplete={props.autoComplete}
    />
  );
}

export interface TextFieldProps extends FieldBaseProps {
  type?: "text" | "email" | "tel" | "url";
  autoComplete?: string;
}

/** A line of text, stored as typed. */
export function TextField(props: TextFieldProps) {
  const { type = "text", autoComplete, ...field } = props;
  return (
    <Field {...field}>
      <TextControl
        name={field.name}
        type={type}
        {...(autoComplete === undefined ? {} : { autoComplete })}
      />
    </Field>
  );
}

function NumberControl(props: { name: string }) {
  const { lang } = useLang();
  const control = useFieldControl();
  const {
    field: { ref, name, onBlur, onChange, value: raw },
  } = useController({ name: props.name });
  const value = raw as number | null | undefined;
  const [text, setText] = useState(() =>
    formatLocaleNumber(value ?? null, lang),
  );
  const emitted = useRef<number | null | undefined>(value);
  // A value set from outside (a reset, the app) replaces the text; the
  // value this box emitted itself does not.
  useEffect(() => {
    if (Object.is(value, emitted.current)) return;
    emitted.current = value;
    setText(formatLocaleNumber(value ?? null, lang));
  }, [value, lang]);
  return (
    <Input
      {...control}
      ref={ref}
      name={name}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onBlur={onBlur}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseLocaleNumber(e.target.value, lang);
        emitted.current = v;
        onChange(v);
      }}
    />
  );
}

/**
 * A number typed in the person's language ("1,5" in `ka`, "1.5" in `en`),
 * stored as a number; an empty box is `null`, never `0`. Give `unit` and,
 * for a vertical value, `datum`: both go into the label.
 */
export function NumberField(props: FieldBaseProps) {
  return (
    <Field {...props}>
      <NumberControl name={props.name} />
    </Field>
  );
}

export interface SelectOption {
  value: string;
  labelKey: string;
}

function SelectControl(props: {
  name: string;
  options: readonly SelectOption[];
}) {
  const { register } = useFormContext();
  const control = useFieldControl();
  const t = useT();
  return (
    <select
      {...register(props.name, {
        setValueAs: (v: unknown) => (v === "" ? null : v),
      })}
      {...control}
      className={SELECT_CLASS}
    >
      <option value="">{t("form.choose")}</option>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {t(o.labelKey)}
        </option>
      ))}
    </select>
  );
}

export interface SelectFieldProps extends FieldBaseProps {
  options: readonly SelectOption[];
}

/** A choice among options; nothing chosen is `null`. */
export function SelectField(props: SelectFieldProps) {
  const { options, ...field } = props;
  return (
    <Field {...field}>
      <SelectControl name={field.name} options={options} />
    </Field>
  );
}

export interface EnumFieldProps<E extends string> extends FieldBaseProps {
  /** A `model` enumeration (`TRUSTS`, `ZONE_TYPES`, ...). */
  values: readonly E[];
  /** Each option is labelled `<i18nPrefix>.<value>`. */
  i18nPrefix: string;
}

/** A value of an enumeration, labelled from the catalogues. */
export function EnumField<E extends string>(props: EnumFieldProps<E>) {
  const { values, i18nPrefix, ...field } = props;
  return (
    <Field {...field}>
      <SelectControl
        name={field.name}
        options={values.map((v) => ({
          value: v,
          labelKey: `${i18nPrefix}.${v}`,
        }))}
      />
    </Field>
  );
}

function CheckboxControl(props: { name: string }) {
  const { register } = useFormContext();
  const control = useFieldControl();
  return (
    <input
      type="checkbox"
      {...register(props.name)}
      {...control}
      className="size-4 accent-primary"
    />
  );
}

/** A yes or no, stored as a boolean. */
export function CheckboxField(props: FieldBaseProps) {
  return (
    <Field {...props} inline>
      <CheckboxControl name={props.name} />
    </Field>
  );
}

function UtcControl(props: { name: string; seconds: boolean }) {
  const control = useFieldControl();
  const {
    field: { ref, name, onBlur, onChange, value: raw },
  } = useController({ name: props.name });
  const value = raw as string | null | undefined;
  const [text, setText] = useState(() => utcToInput(value ?? null));
  const emitted = useRef<string | null | undefined>(value);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setText(utcToInput(value ?? null));
  }, [value]);
  return (
    <Input
      {...control}
      ref={ref}
      name={name}
      type="datetime-local"
      step={props.seconds ? 1 : 60}
      value={text}
      onBlur={onBlur}
      onChange={(e) => {
        setText(e.target.value);
        const v = inputToUtc(e.target.value);
        emitted.current = v;
        onChange(v);
      }}
    />
  );
}

export interface UTCDateTimeFieldProps extends FieldBaseProps {
  /** Offer seconds (default: minutes). */
  seconds?: boolean;
}

/**
 * A date and time in UTC. The label ends with "UTC"; the box's wall clock
 * is read as UTC by text, so the person's own zone and its daylight-saving
 * changes never move the instant. Stored as RFC 3339 with `Z`, or null.
 */
export function UTCDateTimeField(props: UTCDateTimeFieldProps) {
  const { seconds = false, hintKey = "form.utc_hint", ...field } = props;
  return (
    <Field {...field} hintKey={hintKey} utc>
      <UtcControl name={field.name} seconds={seconds} />
    </Field>
  );
}

const BBOX_KEYS = [
  "form.bbox.min_lng",
  "form.bbox.min_lat",
  "form.bbox.max_lng",
  "form.bbox.max_lat",
] as const;

export interface BBoxFieldProps {
  /** The field; its value is `[minLng, minLat, maxLng, maxLat]`. */
  name: string;
  labelKey: string;
  hintKey?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Four numbers in GeoJSON bbox order, `[minLng, minLat, maxLng, maxLat]`
 * in WGS84 degrees, with the order in every label (spec 02 §1 `[lng,
 * lat]`). The order check is the schema's (`shapes.bbox()`); its error
 * names the pair and sits on the box.
 */
export function BBoxField(props: BBoxFieldProps) {
  const {
    name,
    labelKey,
    hintKey,
    required = false,
    disabled = false,
    className,
  } = props;
  const t = useT();
  const hasKey = useHasKey();
  const kit = useFormKit();
  const { errors } = useFormState({ name, exact: false });
  const legend = t("form.bbox.legend", { label: t(labelKey) });
  const id = kit.idFor(name);
  useEffect(
    () => kit.register(name, { id, label: legend, required }),
    [kit, name, id, legend, required],
  );
  const err = heldError(errors, name);
  const text = err === undefined ? null : errorText(err, t, hasKey);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <fieldset
      id={id}
      disabled={disabled}
      tabIndex={-1}
      className={cn(
        "grid gap-2 rounded-md border border-border p-3",
        className,
      )}
      aria-describedby={
        [hintKey === undefined ? null : hintId, text === null ? null : errorId]
          .filter((v) => v !== null)
          .join(" ") || undefined
      }
      data-field={name}
      data-invalid={text === null ? undefined : "true"}
    >
      <legend className="px-1 text-sm font-medium">
        {legend}
        {required && (
          <span aria-hidden="true" className="text-severity-critical">
            {" *"}
          </span>
        )}
      </legend>
      {hintKey !== undefined && (
        <p id={hintId} className="m-0 text-xs text-muted-foreground">
          {t(hintKey)}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {BBOX_KEYS.map((key, i) => (
          <NumberField
            key={key}
            name={`${name}.${i}`}
            labelKey={key}
            unit="form.unit.deg"
            required={required}
            disabled={disabled}
          />
        ))}
      </div>
      {text !== null && (
        <p
          id={errorId}
          className="m-0 text-sm font-medium text-severity-critical"
          data-part="field-error"
        >
          {text}
        </p>
      )}
    </fieldset>
  );
}

export interface ReasonFieldProps {
  name: string;
  /** The minimum length the caller's policy sets; no default. */
  minLength: number;
  labelKey?: string;
  hintKey?: string;
  className?: string;
}

function ReasonCount(props: { name: string; minLength: number; id: string }) {
  const t = useT();
  const value = useWatch({ name: props.name }) as unknown;
  const count = typeof value === "string" ? value.trim().length : 0;
  return (
    <p
      id={props.id}
      className="m-0 text-xs text-muted-foreground"
      data-part="reason-count"
    >
      {t("form.reason_count", { count, min: props.minLength })}
    </p>
  );
}

function ReasonControl(props: { name: string; countId: string }) {
  const { register } = useFormContext();
  const control = useFieldControl();
  return (
    <Textarea
      {...register(props.name)}
      {...control}
      aria-describedby={[control["aria-describedby"], props.countId]
        .filter((v) => v !== undefined)
        .join(" ")}
    />
  );
}

/**
 * The reason a person gives for an audited act (02 §1: "every disable is
 * an audited act by a person"; LESSONS B-09, B-11). Always required; the
 * minimum length is the caller's. Pair with `shapes.reason(minLength)`.
 */
export function ReasonField(props: ReasonFieldProps) {
  const {
    name,
    minLength,
    labelKey = "form.reason",
    hintKey,
    className,
  } = props;
  const countId = `${useFormKit().idFor(name)}-count`;
  return (
    <Field
      name={name}
      labelKey={labelKey}
      required
      {...(hintKey === undefined ? {} : { hintKey })}
      {...(className === undefined ? {} : { className })}
    >
      <ReasonControl name={name} countId={countId} />
      <ReasonCount name={name} minLength={minLength} id={countId} />
    </Field>
  );
}

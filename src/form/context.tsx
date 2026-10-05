"use client";
// The wiring between Form and its fields: each field registers its name,
// id and label so the Form can put an API field error on it and link the
// error summary to it; each control reads its ids from the Field around
// it (aria-describedby, aria-invalid, aria-required).
import { createContext, useContext } from "react";

import { en } from "../i18n/en.js";
import { useOptionalI18n } from "../i18n/I18nProvider.js";
import type { Translate } from "../i18n/translate.js";

/** @beta */
export interface RegisteredField {
  id: string;
  label: string;
  required: boolean;
}

export interface FormKit {
  /** The DOM id of the control registered as `name`. */
  idFor(name: string): string;
  /** Registers a field; returns the unregister function. */
  register(name: string, field: RegisteredField): () => void;
}

export const FormKitContext = createContext<FormKit | null>(null);

export function useFormKit(): FormKit {
  const kit = useContext(FormKitContext);
  if (kit === null) throw new Error("a form field needs an enclosing <Form>");
  return kit;
}

/** @beta */
export interface FieldControl {
  name: string;
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
}

export const FieldContext = createContext<FieldControl | null>(null);

/**
 * The accessibility attributes of the control inside a `Field`, for a
 * control the app writes itself.
 *
 * @beta
 */
export function useFieldControl(): {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
  disabled: boolean | undefined;
} {
  const f = useContext(FieldContext);
  if (f === null)
    throw new Error("useFieldControl() needs an enclosing <Field>");
  return {
    id: f.id,
    "aria-describedby": f.describedBy,
    "aria-invalid": f.invalid ? true : undefined,
    "aria-required": f.required ? true : undefined,
    disabled: f.disabled ? true : undefined,
  };
}

/**
 * An error as react-hook-form holds it.
 *
 * @beta
 */
export interface HeldError {
  type?: string | number;
  message?: string;
}

/**
 * The text of a held error. A reason the API sent (`type: "server"`) is
 * shown as the API wrote it; a message that is a catalogue key (the kit's
 * error map, an app's key) is translated; any other message is the app's
 * own text and is shown as written.
 *
 * @beta
 */
export function errorText(
  err: HeldError,
  t: Translate,
  hasKey: (k: string) => boolean,
): string {
  const m = err.message;
  if (m === undefined || m === "") return t("form.error.invalid");
  if (err.type === "server") return m;
  return hasKey(m) ? t(m) : m;
}

/** Whether a key is in the kit's or the app's catalogue. */
export function useHasKey(): (k: string) => boolean {
  const ctx = useOptionalI18n();
  return (k) =>
    Object.hasOwn(en, k) ||
    (ctx !== null &&
      (Object.hasOwn(ctx.catalogues[ctx.lang] ?? {}, k) ||
        Object.hasOwn(ctx.catalogues.en ?? {}, k)));
}

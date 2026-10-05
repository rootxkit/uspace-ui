"use client";
// Form (docs/PLAN.md §3.15, WP-10): react-hook-form with the zod resolver
// over the app's schema. The schema checks shape; the API checks meaning
// and names every field it refuses (uspace-core rule 5). The form's job is
// to put each refusal on its field, all of them, in the person's language:
//
// - `onSubmit` may return `FieldError[]`, or throw an `ApiError` whose
//   problem carries `errors[{field, reason}]` (RFC 9457, M28). Each error
//   whose JSON path normalises onto a registered field goes to that
//   field; the rest are listed with their path (LESSONS Z-02); a
//   truncated list says so.
// - An error summary at the top counts the problems, links each to its
//   field, and takes focus after a refused submit (it is a live region).
// - Submit is disabled while the request runs, and while a Retry-After
//   from the API counts down (LESSONS B-10, S-15).
// - A submit that succeeds clears every earlier error (E-02).
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
} from "react-hook-form";
import type { z } from "zod";

import { ApiError } from "../api/error.js";
import { useT } from "../i18n/I18nProvider.js";
import type { FieldError, Problem } from "../model/index.js";
import { Button } from "../ui/button.js";
import { cn } from "../ui/cn.js";
import {
  FormKitContext,
  errorText,
  useHasKey,
  type FormKit,
  type HeldError,
  type RegisteredField,
} from "./context.js";
import { countForm } from "./counters.js";
import { FieldErrors } from "./FieldErrors.js";
import { kitErrorMap } from "./messages.js";
import { toFieldName, toJsonPath } from "./paths.js";

/** Seconds between countdown ticks. A display-only constant. */
const TICK_MS = 1000;

/** @public */
export interface FormProps<Schema extends z.ZodType> {
  /** The app's schema; shape only (required, number, enum, bbox order, RFC 3339). */
  schema: Schema;
  defaults: z.input<Schema>;
  /**
   * Sends the values. Resolve with nothing on success; resolve with the
   * API's field errors, or throw its `ApiError`, when it refused.
   */
  // The plan's signature: an app's `async` handler that returns nothing
  // is a `Promise<void>`.
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onSubmit(values: z.output<Schema>): Promise<void | FieldError[]>;
  children: ReactNode;
  submitLabelKey: string;
  busyLabelKey?: string;
  /** Shown after a submit that succeeded. */
  successKey?: string;
  className?: string;
}

interface Refusal {
  unmapped: FieldError[];
  truncated: boolean;
  problem: Problem | null;
  failed: boolean;
}

const NO_REFUSAL: Refusal = {
  unmapped: [],
  truncated: false,
  problem: null,
  failed: false,
};

interface Leaf {
  name: string;
  err: HeldError;
}

const META = new Set(["type", "message", "ref", "types", "root"]);

/** Every error react-hook-form holds, with its field name. */
function leaves(errors: unknown, prefix = "", out: Leaf[] = []): Leaf[] {
  if (typeof errors !== "object" || errors === null) return out;
  const e = errors as Record<string, unknown> & HeldError;
  if (typeof e.type === "string" || typeof e.message === "string")
    out.push({ name: prefix, err: e });
  if (typeof e["root"] === "object" && e["root"] !== null)
    out.push({ name: prefix, err: e["root"] as HeldError });
  for (const k of Object.keys(e)) {
    if (META.has(k)) continue;
    leaves(e[k], prefix === "" ? k : `${prefix}.${k}`, out);
  }
  return out;
}

/** @public */
export function Form<Schema extends z.ZodType>(props: FormProps<Schema>) {
  const {
    schema,
    defaults,
    onSubmit,
    children,
    submitLabelKey,
    busyLabelKey = "form.busy",
    successKey = "form.saved",
    className,
  } = props;
  const t = useT();
  const hasKey = useHasKey();
  const resolver = useMemo(
    () =>
      zodResolver(schema as never, {
        error: kitErrorMap,
      }) as unknown as Resolver<FieldValues>,
    [schema],
  );
  const methods = useForm<FieldValues>({
    resolver,
    defaultValues: defaults as DefaultValues<FieldValues>,
    mode: "onSubmit",
    reValidateMode: "onChange",
    // The error summary takes focus instead, so every problem is read out
    // first (Z-02), and each of its links focuses its field.
    shouldFocusError: false,
  });
  const formId = useId().replace(/[^A-Za-z0-9_-]/g, "");
  // The registered fields: a ref for the submit handlers, which run after
  // a render, and the same map as state for the render itself.
  const fields = useRef(new Map<string, RegisteredField>());
  const [registry, setRegistry] = useState<
    ReadonlyMap<string, RegisteredField>
  >(() => new Map());
  const publish = useCallback(() => {
    setRegistry(new Map(fields.current));
  }, []);
  const kit = useMemo<FormKit>(
    () => ({
      idFor: (name) => `${formId}-${name.replace(/[^A-Za-z0-9_-]/g, "-")}`,
      register: (name, field) => {
        fields.current.set(name, field);
        publish();
        return () => {
          if (fields.current.get(name) === field) fields.current.delete(name);
          publish();
        };
      },
    }),
    [formId, publish],
  );
  const requiredCount = [...registry.values()].filter((f) => f.required).length;

  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<Refusal>(NO_REFUSAL);
  const [attempted, setAttempted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retryLeftS, setRetryLeftS] = useState(0);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const focusSummary = useRef(false);

  useEffect(() => {
    if (!focusSummary.current) return;
    focusSummary.current = false;
    summaryRef.current?.focus();
  });

  useEffect(() => {
    if (retryLeftS <= 0) return;
    const id = setTimeout(() => {
      setRetryLeftS((s) => s - 1);
    }, TICK_MS);
    return () => {
      clearTimeout(id);
    };
  }, [retryLeftS]);

  const refuse = (
    errors: readonly FieldError[],
    truncated: boolean,
    problem: Problem | null,
  ) => {
    const byName = new Map<string, string[]>();
    const unmapped: FieldError[] = [];
    for (const e of errors) {
      const name = toFieldName(e.field);
      if (name !== "" && fields.current.has(name)) {
        byName.set(name, [...(byName.get(name) ?? []), e.reason]);
      } else {
        unmapped.push(e);
      }
    }
    for (const [name, reasons] of byName)
      methods.setError(name, { type: "server", message: reasons.join("; ") });
    if (unmapped.length > 0) countForm("field_error_unmapped", unmapped.length);
    countForm("submit_refused");
    setRefusal({ unmapped, truncated, problem, failed: false });
    setAttempted(true);
    focusSummary.current = true;
  };

  const onValid = async (values: FieldValues) => {
    setBusy(true);
    setSaved(false);
    setRefusal(NO_REFUSAL);
    try {
      const result = await onSubmit(values as z.output<Schema>);
      if (Array.isArray(result) && result.length > 0) {
        refuse(result, false, null);
      } else {
        // The success path is read too (E-02): nothing stale remains.
        methods.clearErrors();
        setAttempted(false);
        setSaved(true);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        refuse(
          err.problem?.errors ?? [],
          err.problem?.truncated === true,
          err.problem,
        );
        if (err.retryAfterS !== null && err.retryAfterS > 0)
          setRetryLeftS(Math.ceil(err.retryAfterS));
      } else {
        countForm("submit_failed");
        setRefusal({ ...NO_REFUSAL, failed: true });
        setAttempted(true);
        focusSummary.current = true;
      }
    } finally {
      setBusy(false);
    }
  };

  const onInvalid = () => {
    setSaved(false);
    setAttempted(true);
    focusSummary.current = true;
  };

  const held = leaves(methods.formState.errors);
  const count = held.length + refusal.unmapped.length;
  const showSummary =
    attempted &&
    (count > 0 ||
      refusal.problem !== null ||
      refusal.failed ||
      refusal.truncated);
  const summaryTitleId = `${formId}-summary`;

  let submitText = t(submitLabelKey);
  if (busy) submitText = t(busyLabelKey);
  else if (retryLeftS > 0)
    submitText = t("form.retry_in", { count: retryLeftS });

  return (
    <FormProvider {...methods}>
      <FormKitContext.Provider value={kit}>
        <form
          noValidate
          aria-busy={busy ? true : undefined}
          className={cn("grid gap-4", className)}
          data-form=""
          onSubmit={(e) => {
            void methods.handleSubmit(onValid, onInvalid)(e);
          }}
        >
          {showSummary && (
            <div
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              aria-labelledby={summaryTitleId}
              className="grid gap-2 rounded-md border-2 border-severity-critical p-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              data-part="summary"
              data-count={count}
            >
              <p id={summaryTitleId} className="m-0 font-semibold">
                {count > 0
                  ? t("form.summary", { count })
                  : refusal.failed
                    ? t("form.failed")
                    : t("form.refused")}
              </p>
              {refusal.problem !== null && (
                <p className="m-0" data-part="problem">
                  {t("form.problem", {
                    title: refusal.problem.title,
                    status: refusal.problem.status,
                  })}
                  {refusal.problem.detail !== null &&
                    ` ${refusal.problem.detail}`}
                </p>
              )}
              {held.length > 0 && (
                <ul className="m-0 grid gap-1 pl-5">
                  {held.map(({ name, err }) => {
                    const f = registry.get(name);
                    const text = errorText(err, t, hasKey);
                    return (
                      <li key={name} data-error-for={name}>
                        {f === undefined ? (
                          <code className="font-mono text-xs">
                            {toJsonPath(name)}
                          </code>
                        ) : (
                          <a
                            href={`#${f.id}`}
                            className="underline"
                            onClick={(e) => {
                              e.preventDefault();
                              document.getElementById(f.id)?.focus();
                            }}
                          >
                            {f.label}
                          </a>
                        )}
                        {": "}
                        {text}
                      </li>
                    );
                  })}
                </ul>
              )}
              <FieldErrors
                errors={refusal.unmapped}
                truncated={refusal.truncated}
              />
            </div>
          )}
          {requiredCount > 0 && (
            <p className="m-0 text-xs text-muted-foreground">
              {t("form.required_note")}
            </p>
          )}
          {children}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={busy || retryLeftS > 0}
              data-part="submit"
            >
              {submitText}
            </Button>
            {saved && (
              <p role="status" className="m-0 text-sm" data-part="saved">
                {t(successKey)}
              </p>
            )}
          </div>
        </form>
      </FormKitContext.Provider>
    </FormProvider>
  );
}

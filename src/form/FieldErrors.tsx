"use client";
// FieldErrors (docs/PLAN.md §3.15): the API's field errors that land on no
// field of the form, each with its path as the API sent it, so none is lost (LESSONS Z-02:
// name every problem). When the API says it cut the list (`truncated`,
// at most 100 errors per answer, M28), the note says there are more.
import { useT } from "../i18n/I18nProvider.js";
import type { FieldError } from "../model/index.js";
import { cn } from "../ui/cn.js";

export interface FieldErrorsProps {
  errors: readonly FieldError[];
  /** The API cut the list (`Problem.truncated`). */
  truncated?: boolean;
  className?: string;
}

export function FieldErrors(props: FieldErrorsProps) {
  const { errors, truncated = false, className } = props;
  const t = useT();
  if (errors.length === 0 && !truncated) return null;
  return (
    <div
      className={cn("grid gap-1 text-sm", className)}
      data-part="field-errors"
    >
      {errors.length > 0 && (
        <>
          <p className="m-0 font-medium">{t("form.unmapped_title")}</p>
          <ul className="m-0 grid gap-1 pl-5">
            {errors.map((e, i) => (
              <li key={`${e.field}-${i}`} data-path={e.field}>
                <code className="font-mono text-xs">
                  {e.field === "" ? t("form.whole_request") : e.field}
                </code>
                {": "}
                {e.reason}
              </li>
            ))}
          </ul>
        </>
      )}
      {truncated && (
        <p className="m-0 text-muted-foreground" data-part="truncated">
          {t("form.truncated")}
        </p>
      )}
    </div>
  );
}

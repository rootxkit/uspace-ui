// The words of a refused field (docs/PLAN.md §3.15). The schema checks
// shape only; the error map below turns each zod issue into a catalogue
// key of the kit, so a person reads the refusal in their language and
// never zod's English. A message the app wrote itself (a refine) is kept;
// a reason the API sent (`FieldError.reason`) is shown as the API wrote
// it, since the API names the problem (uspace-core rule 5).
import type { $ZodErrorMap } from "zod/v4/core";

import type { Key } from "../i18n/en.js";

const empty = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/**
 * The zod error map of the form kit: every issue becomes a kit key.
 * Display words only; the checks are the schema's.
 *
 * @beta
 */
export const kitErrorMap: $ZodErrorMap = (issue) => {
  const key = ((): Key => {
    switch (issue.code) {
      case "invalid_type":
        if (empty(issue.input)) return "form.error.required";
        return issue.expected === "number"
          ? "form.error.not_a_number"
          : "form.error.invalid_type";
      case "invalid_value":
        return "form.error.not_in_list";
      case "invalid_format":
        return "form.error.invalid_format";
      case "too_small":
        if (issue.origin === "string" && issue.minimum === 1)
          return "form.error.required";
        return "form.error.too_small";
      case "too_big":
        return "form.error.too_big";
      default:
        return "form.error.invalid";
    }
  })();
  return { message: key };
};

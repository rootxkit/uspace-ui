// `@rootxkit/uspace-ui/form` (docs/PLAN.md §3.15, WP-10): the form kit.
// The app's schema checks shape; the API checks meaning and names every
// field it refuses (RFC 9457 `errors[{field, reason}]`), and the form puts
// each refusal on its field. Units and datums are in the labels, times
// are UTC, and every audited act goes through a dialog with a reason.
export {
  errorText,
  useFieldControl,
  type FieldControl,
  type HeldError,
  type RegisteredField,
} from "./context.js";
export {
  formCounters,
  resetFormCountersForTests,
  type FormCounter,
} from "./counters.js";
export { FieldErrors, type FieldErrorsProps } from "./FieldErrors.js";
export { Form, type FormProps } from "./Form.js";
export { kitErrorMap } from "./messages.js";
export { toFieldName, toJsonPath } from "./paths.js";

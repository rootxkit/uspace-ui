import type { LoginFormProps } from "../../src/auth/client/index.js";

// A BFF that never answers: the form as it stands before a submission.
const never: typeof fetch = () => new Promise<Response>(() => undefined);

/** The sign-in form's props in the tests and the golden set. */
export const LOGIN_PROPS = {
  action: "/_bff/login",
  onSuccess: () => undefined,
  fetch: never,
} satisfies LoginFormProps;

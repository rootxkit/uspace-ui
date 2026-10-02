// `@rootxkit/uspace-ui/auth/client` (docs/PLAN.md §3.16, WP-5): the
// session as the page shows it, the sign-in form, display gating and the
// CSRF cookie reader. It never imports `auth/server` and never sees the
// session token (06 §3).
export {
  BFF_API_PREFIX,
  BFF_LOGIN_PATH,
  BFF_LOGOUT_PATH,
  CSRF_COOKIE,
  CSRF_HEADER,
  type LoginResult,
} from "../contract.js";
export { csrfToken } from "./csrf.js";
export { LoginForm, type LoginFormProps } from "./LoginForm.js";
export { RequireRole, type RequireRoleProps } from "./RequireRole.js";
export {
  SessionProvider,
  useSession,
  type SessionContextValue,
  type SessionProviderProps,
} from "./SessionProvider.js";

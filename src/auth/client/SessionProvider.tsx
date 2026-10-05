"use client";
// The session as the page shows it (docs/PLAN.md §3.16, §3.1
// `SessionDisplay`). A server component reads the session cookie,
// decodes it for display with `sessionDisplay` of `auth/server`, and
// passes the result down; the page never sees the token. Display only:
// the API decides every request.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { SessionDisplay } from "../../model/index.js";
import { BFF_LOGOUT_PATH, CSRF_HEADER } from "../contract.js";
import { csrfToken } from "./csrf.js";

/** @public */
export interface SessionContextValue {
  /** The signed-in session's display claims, or `null` when signed out. */
  session: SessionDisplay | null;
  /**
   * Signs out through the BFF's logout route (both cookies cleared, the
   * API told). Resolves when the BFF agreed; rejects otherwise, and the
   * session is still shown.
   */
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** @public */
export interface SessionProviderProps {
  session: SessionDisplay | null;
  /** The BFF's logout route; `/_bff/logout` (the contract's) by default. */
  logoutAction?: string;
  /** The fetch to use; the platform's by default. */
  fetch?: typeof fetch;
  children?: ReactNode;
}

/** @public */
export function SessionProvider(props: SessionProviderProps): ReactNode {
  const { logoutAction = BFF_LOGOUT_PATH, children } = props;
  const fetchImpl = props.fetch;
  // The server's session holds until signOut or a new prop replaces it.
  const [signedOut, setSignedOut] = useState<SessionDisplay | null>(null);
  const session =
    signedOut !== null && signedOut === props.session ? null : props.session;
  const signOut = useCallback(async () => {
    const token = csrfToken();
    const res = await (fetchImpl ?? fetch)(logoutAction, {
      method: "POST",
      credentials: "same-origin",
      headers: token === null ? {} : { [CSRF_HEADER]: token },
    });
    if (!res.ok) throw new Error(`sign-out refused with status ${res.status}`);
    setSignedOut(props.session);
  }, [fetchImpl, logoutAction, props.session]);
  const value = useMemo(() => ({ session, signOut }), [session, signOut]);
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/**
 * The session and `signOut`; needs a `SessionProvider`.
 *
 * @public
 */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (ctx === null) throw new Error("useSession() needs a <SessionProvider>");
  return ctx;
}

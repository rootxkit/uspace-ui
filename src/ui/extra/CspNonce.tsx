"use client";
// The request's CSP nonce for the components that inject a <style>
// element (docs/PLAN.md §7; src/ui/UPGRADING.md). The root layout reads it
// from the request header the app's middleware set
// (`CSP_NONCE_HEADER` of `@rootxkit/uspace-ui/auth/server`) and wraps the
// page in this provider; `ScrollArea` reads it. Without a provider the
// nonce is `undefined` and the browser refuses the injected style under
// the policy, as before: the content still scrolls.
import { createContext, useContext, type ReactNode } from "react";

const CspNonceContext = createContext<string | undefined>(undefined);

export function CspNonceProvider(props: {
  nonce: string | undefined;
  children?: ReactNode;
}): ReactNode {
  return (
    <CspNonceContext.Provider value={props.nonce}>
      {props.children}
    </CspNonceContext.Provider>
  );
}

/** The nonce of the nearest `CspNonceProvider`, or `undefined`. */
export function useCspNonce(): string | undefined {
  return useContext(CspNonceContext);
}

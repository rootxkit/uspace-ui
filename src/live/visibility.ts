"use client";
// Whether the page is visible (the Page Visibility API): what `usePolling`
// and `useNowMs` pause on. A document that is not there (server rendering)
// counts as visible, so the first client render matches the server's.
import { useSyncExternalStore } from "react";

/**
 * True unless the document says it is hidden (`visibilityState`); true
 * where there is no document.
 */
export function pageVisible(): boolean {
  return typeof document === "undefined"
    ? true
    : document.visibilityState !== "hidden";
}

/**
 * Calls `fn` on every `visibilitychange`; returns the unsubscribe. Does
 * nothing where there is no document.
 */
export function subscribePageVisible(fn: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  document.addEventListener("visibilitychange", fn);
  return () => {
    document.removeEventListener("visibilitychange", fn);
  };
}

const serverVisible = (): boolean => true;

/**
 * Whether the page is visible (`document.visibilityState` is not
 * `hidden`), re-rendering when it changes (`useSyncExternalStore`). True
 * during server rendering and hydration.
 *
 * @public
 */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribePageVisible, pageVisible, serverVisible);
}

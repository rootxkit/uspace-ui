"use client";
// ThemeProvider and useTheme (docs/PLAN.md §3.2). Sets `data-theme` on
// <html> from the chosen scheme, following `prefers-color-scheme` live for
// `system`; writes the brand accent to `--us-brand-accent`; exposes the
// brand. Both are restored when the provider unmounts.
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { Brand } from "./brand.js";
import {
  DARK_QUERY,
  schemeFromCookie,
  type ColorScheme,
  type ResolvedScheme,
} from "./scheme.js";
import { tokens } from "./tokens.js";

export interface ThemeContextValue {
  scheme: ColorScheme;
  resolved: ResolvedScheme;
  setScheme(s: ColorScheme): void;
  brand: Brand;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  brand: Brand;
  /**
   * The scheme to start with, usually read from the `uspace_scheme` cookie
   * on the server. Absent: the cookie as the browser sees it, else
   * `system`. A change of this prop is followed.
   */
  scheme?: ColorScheme;
  /**
   * Called by `setScheme`, so the app can persist the choice (its server
   * action writes the cookie; the kit never does).
   */
  onSchemeChange?(s: ColorScheme): void;
  children?: ReactNode;
}

function mediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return null;
  return window.matchMedia(DARK_QUERY);
}

function subscribeDark(onChange: () => void): () => void {
  const mq = mediaQuery();
  if (mq === null) return () => {};
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const prefersDark = (): boolean => mediaQuery()?.matches ?? false;
// The server has no preference to read; `system` renders light there and
// the client corrects it before paint.
const prefersDarkOnServer = (): boolean => false;

function initialScheme(prop: ColorScheme | undefined): ColorScheme {
  if (prop !== undefined) return prop;
  if (typeof document === "undefined") return "system";
  return schemeFromCookie(document.cookie) ?? "system";
}

export function ThemeProvider(props: ThemeProviderProps): ReactNode {
  const { brand, onSchemeChange, children } = props;
  const [scheme, setState] = useState<ColorScheme>(() =>
    initialScheme(props.scheme),
  );
  const [lastProp, setLastProp] = useState(props.scheme);
  if (props.scheme !== lastProp) {
    setLastProp(props.scheme);
    if (props.scheme !== undefined) setState(props.scheme);
  }

  const dark = useSyncExternalStore(
    subscribeDark,
    prefersDark,
    prefersDarkOnServer,
  );
  const resolved: ResolvedScheme =
    scheme === "system" ? (dark ? "dark" : "light") : scheme;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const before = root.getAttribute("data-theme");
    root.setAttribute("data-theme", resolved);
    return () => {
      if (before === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", before);
    };
  }, [resolved]);

  useLayoutEffect(() => {
    if (brand.accent === null) return;
    const style = document.documentElement.style;
    const before = style.getPropertyValue(tokens.brandAccent);
    style.setProperty(tokens.brandAccent, brand.accent);
    return () => {
      if (before === "") style.removeProperty(tokens.brandAccent);
      else style.setProperty(tokens.brandAccent, before);
    };
  }, [brand.accent]);

  const setScheme = useCallback(
    (s: ColorScheme) => {
      setState(s);
      onSchemeChange?.(s);
    },
    [onSchemeChange],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, resolved, setScheme, brand }),
    [scheme, resolved, setScheme, brand],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** The theme of the enclosing ThemeProvider; throws outside one. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return ctx;
}

/** Like `useTheme`, but null outside a ThemeProvider. */
export function useOptionalTheme(): ThemeContextValue | null {
  return useContext(ThemeContext);
}

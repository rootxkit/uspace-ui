import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";

import { I18nProvider } from "../i18n/I18nProvider.js";

// The signature is final (PLAN §3.18). The language is the kit's
// I18nProvider (WP-2); the theme is still a stub wrapper carrying the
// options as attributes so a test can see them, until ThemeProvider
// replaces it without changing a caller.

export type KitLang = "ka" | "en";
export type KitScheme = "light" | "dark" | "system";

/** The shape of theme's `Brand` (PLAN §3.2). */
export interface KitBrand {
  name: string;
  shortName: string;
  logoUrl: string | null;
  contact: string | null;
  accent: string | null;
}

export interface RenderWithKitOptions {
  lang?: KitLang;
  scheme?: KitScheme;
  brand?: KitBrand;
  /** The clock the components are given, in ms since the epoch. */
  now?: number;
}

// The role, never an organisation (PLAN §3.2 brandFromEnv, §14 Q10).
export const TEST_BRAND: KitBrand = {
  name: "U-space",
  shortName: "U-space",
  logoUrl: null,
  contact: null,
  accent: null,
};

/**
 * Renders `ui` inside the kit's providers. Defaults: `en`, the light
 * scheme (`system` resolves to light: tests have no colour preference),
 * the role brand. It starts no timer and reads no clock, so it is safe
 * under fake timers; `now` is passed to the providers, not to the timers.
 */
export function renderWithKit(
  ui: ReactNode,
  opts: RenderWithKitOptions = {},
): RenderResult {
  const lang = opts.lang ?? "en";
  const scheme = opts.scheme ?? "light";
  const resolved = scheme === "dark" ? "dark" : "light";
  const brand = opts.brand ?? TEST_BRAND;
  return render(
    <div
      lang={lang}
      data-theme={resolved}
      data-scheme={scheme}
      data-brand={brand.shortName}
      data-now-ms={opts.now === undefined ? undefined : String(opts.now)}
      data-testid="kit-root"
    >
      <I18nProvider lang={lang}>{ui}</I18nProvider>
    </div>,
  );
}

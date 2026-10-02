// The browser tests' harness (docs/PLAN.md §9): every component renders
// inside the kit's ThemeProvider, I18nProvider and TooltipProvider, in a
// chosen scheme and language, the way a consuming app mounts it. The setup
// (browser/setup.ts) runs axe on the page after every test and fails a
// test whose rendering showed a key or fell back to English.
import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
// The DOM matchers vitest's browser mode registers on `expect`.
import type {} from "vitest/browser";

import { I18nProvider } from "../src/i18n/index.js";
import { ThemeProvider, type Brand } from "../src/theme/index.js";
import { TooltipProvider } from "../src/ui/index.js";

export type Lang = "en" | "ka";
export type Scheme = "light" | "dark";

/** A language and a colour scheme to render in. */
export interface Look {
  lang: Lang;
  scheme: Scheme;
}

export const EN_LIGHT: Look = { lang: "en", scheme: "light" };
export const EN_DARK: Look = { lang: "en", scheme: "dark" };
export const KA_LIGHT: Look = { lang: "ka", scheme: "light" };
export const KA_DARK: Look = { lang: "ka", scheme: "dark" };

/**
 * The two looks every component is tested in (WP-1): light in English and
 * dark in Georgian, so both schemes and both languages run axe.
 */
export const LOOKS: readonly Look[] = [EN_LIGHT, KA_DARK];

/** "en light", "ka dark": the suffix of a test name. */
export const lookName = (look: Look): string => `${look.lang} ${look.scheme}`;

// The role brand, never an organisation (PLAN §3.2).
const BRAND: Brand = {
  name: "U-space",
  shortName: "U-space",
  logoUrl: null,
  contact: null,
  accent: null,
};

/**
 * Renders `ui` in the kit's providers, in a container of its own on the
 * page. The container's first child is the themed wrapper, so its
 * `innerHTML` is what a golden snapshot records.
 */
export function renderKit(ui: ReactNode, look: Look = EN_LIGHT): RenderResult {
  const container = document.createElement("div");
  document.body.append(container);
  return render(
    <ThemeProvider brand={BRAND} scheme={look.scheme}>
      <I18nProvider lang={look.lang}>
        <TooltipProvider>
          <div lang={look.lang} className="bg-background p-4 text-foreground">
            {ui}
          </div>
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>,
    { container },
  );
}

/** The page's body, for what a component portals out of its container. */
export const pageBody = (): HTMLElement => document.body;

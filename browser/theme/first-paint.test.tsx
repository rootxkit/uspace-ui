import { afterEach, expect, it } from "vitest";
import { commands } from "vitest/browser";

import { Button } from "../../src/ui/index.js";
import { EN_LIGHT, KA_DARK, renderKit } from "../kit.js";

// docs/ACCESSIBILITY.md A5: before ThemeProvider has run, a page the
// server rendered without data-theme is painted from styles/tokens.css
// alone. Under a dark system preference that paint is dark at once; it no
// longer starts light and turns dark after hydration.

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateColorScheme(scheme: "light" | "dark" | null): Promise<void>;
  }
}

const DARK_SURFACE = "#111418";
const LIGHT_SURFACE = "#f6f7f9";

const surface = (el: Element = document.documentElement): string =>
  getComputedStyle(el).getPropertyValue("--us-surface").trim().toLowerCase();

const root = document.documentElement;
const before = root.getAttribute("data-theme");

afterEach(async () => {
  await commands.emulateColorScheme(null);
  if (before === null) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", before);
});

it("paints dark before hydration under a dark preference", async () => {
  await commands.emulateColorScheme("dark");
  root.removeAttribute("data-theme");
  expect(surface()).toBe(DARK_SURFACE);
  expect(getComputedStyle(root).colorScheme).toBe("dark");
});

it("paints light before hydration under a light preference (the twin)", async () => {
  await commands.emulateColorScheme("light");
  root.removeAttribute("data-theme");
  expect(surface()).toBe(LIGHT_SURFACE);
});

it("keeps an explicit light scheme the server rendered under a dark preference", async () => {
  await commands.emulateColorScheme("dark");
  root.setAttribute("data-theme", "light");
  expect(surface()).toBe(LIGHT_SURFACE);
});

it("stays dark when ThemeProvider takes over (ka dark), and passes axe", async () => {
  await commands.emulateColorScheme("dark");
  root.removeAttribute("data-theme");
  renderKit(<Button>OK</Button>, KA_DARK);
  expect(root.getAttribute("data-theme")).toBe("dark");
  expect(surface()).toBe(DARK_SURFACE);
});

it("follows the explicit scheme over the preference (en light)", async () => {
  await commands.emulateColorScheme("dark");
  root.removeAttribute("data-theme");
  renderKit(<Button>OK</Button>, EN_LIGHT);
  expect(root.getAttribute("data-theme")).toBe("light");
  expect(surface()).toBe(LIGHT_SURFACE);
});

import { afterEach, expect, it } from "vitest";
import { commands } from "vitest/browser";

import { EN_DARK, EN_LIGHT, renderKit } from "../kit.js";

// 1.1.2: native controls (a <select> list, the date picker, scrollbars)
// are drawn by the browser from the `color-scheme` property. It must
// follow the kit's scheme, in dark as well as in light, and a select's
// options must not fall back to the platform's white.

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateColorScheme(scheme: "light" | "dark" | null): Promise<void>;
  }
}

const root = document.documentElement;
const before = root.getAttribute("data-theme");

afterEach(async () => {
  await commands.emulateColorScheme(null);
  if (before === null) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", before);
});

function Native() {
  return (
    <select aria-label="Upper limit reference" data-testid="native">
      <optgroup label="Group">
        <option value="agl">AGL</option>
        <option value="amsl">AMSL</option>
      </optgroup>
    </select>
  );
}

const channels = (css: string): number[] => {
  const m = /rgba?\(([^)]+)\)/.exec(css);
  if (m === null) throw new Error(`not an rgb colour: ${css}`);
  return (m[1] ?? "")
    .split(/[ ,/]+/)
    .slice(0, 3)
    .map(Number);
};

const option = (): HTMLOptionElement => {
  const el = document.querySelector("option");
  if (el === null) throw new Error("no option");
  return el;
};

it("color-scheme is dark under ThemeProvider dark, on <html> and the select", () => {
  renderKit(<Native />, EN_DARK);
  expect(getComputedStyle(root).colorScheme).toBe("dark");
  const select = document.querySelector("select");
  expect(getComputedStyle(select as Element).colorScheme).toBe("dark");
});

it("color-scheme is light under ThemeProvider light (the twin)", () => {
  renderKit(<Native />, EN_LIGHT);
  expect(getComputedStyle(root).colorScheme).toBe("light");
});

it("color-scheme follows a dark preference before ThemeProvider runs", async () => {
  await commands.emulateColorScheme("dark");
  root.removeAttribute("data-theme");
  expect(getComputedStyle(root).colorScheme).toBe("dark");
});

it("a select's option background in dark is not white", () => {
  renderKit(<Native />, EN_DARK);
  const bg = channels(getComputedStyle(option()).backgroundColor);
  expect(bg).not.toEqual([255, 255, 255]);
  // Dark surface: every channel well below mid-grey.
  expect(Math.max(...bg)).toBeLessThan(80);
  const fg = channels(getComputedStyle(option()).color);
  expect(Math.min(...fg)).toBeGreaterThan(150);
});

it("a select's option background in light is light (the twin)", () => {
  renderKit(<Native />, EN_LIGHT);
  const bg = channels(getComputedStyle(option()).backgroundColor);
  expect(Math.min(...bg)).toBeGreaterThan(200);
});

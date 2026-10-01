import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import { ThemeProvider, type Brand } from "../../src/theme/index.js";
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../src/ui/index.js";

// Components under the Content Security Policy every `web/` sets
// (docs/PLAN.md §7): no 'unsafe-inline' for styles, no 'unsafe-eval'.
// The policy arrives as a <meta> element inserted before the story
// renders, so it governs everything the story adds to the page: React's
// `style` props (set through the CSSOM, which CSP allows), Radix
// positioning, ThemeProvider's accent property, and any <style> element a
// component injects (which CSP refuses). It cannot judge what was loaded
// before it, such as the stylesheets of the Storybook page itself or a
// library that injects a <style> element at import time (sonner does:
// src/ui/UPGRADING.md).
//
// A CSP set by <meta> cannot be removed: in the Storybook UI, stories
// opened after these in the same tab run under it until a reload. The
// test runner gives each story file its own page.
const POLICY = [
  // 'report-sample' puts the first characters of a refused style into the
  // violation, so a story can tell whose style was refused.
  "style-src 'self' 'report-sample'",
  "font-src 'self'",
  "img-src 'self' data:",
  "worker-src blob:",
  "connect-src 'self'",
].join("; ");

const violations: SecurityPolicyViolationEvent[] = [];
const consoleErrors: unknown[][] = [];

function installPolicy(): void {
  if (document.querySelector('meta[data-story-csp="true"]') !== null) return;
  document.addEventListener("securitypolicyviolation", (e) => {
    violations.push(e);
  });
  const meta = document.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = POLICY;
  meta.dataset["storyCsp"] = "true";
  document.head.prepend(meta);
}

const BRAND: Brand = {
  name: "U-space",
  shortName: "U-space",
  logoUrl: null,
  contact: null,
  // A story-only accent, written by ThemeProvider as a style property.
  accent: "#0a6e4f",
};

function InlineStyles() {
  const [open] = useState(true);
  return (
    <ThemeProvider brand={BRAND} scheme="light">
      <div className="flex flex-col gap-6 pt-12">
        <div
          data-testid="inline"
          className="rounded-sm p-2"
          style={{ borderLeft: "6px solid var(--us-severity-critical)" }}
        >
          <Badge>TEST-0001</Badge>
        </div>
        <Tooltip open={open}>
          <TooltipTrigger asChild>
            <Button variant="outline">Tooltip</Button>
          </TooltipTrigger>
          <TooltipContent>Positioned with inline styles</TooltipContent>
        </Tooltip>
        <Popover open={open}>
          <PopoverTrigger asChild>
            <Button variant="outline">Popover</Button>
          </PopoverTrigger>
          <PopoverContent>Positioned with inline styles</PopoverContent>
        </Popover>
      </div>
    </ThemeProvider>
  );
}

function ScrollAreaUnderCsp() {
  return (
    <ScrollArea className="h-32 w-64 rounded-md border">
      <ul className="p-3" aria-label="Rows">
        {Array.from({ length: 12 }, (_, i) => (
          <li key={i} className="py-1 text-sm">
            <a href={`#row-${i + 1}`}>Row {i + 1}</a>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}

const meta = {
  title: "csp/Content Security Policy",
  beforeEach: () => {
    installPolicy();
    violations.length = 0;
    consoleErrors.length = 0;
    const error = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args);
      error(...args);
    };
    return () => {
      console.error = error;
    };
  },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

const settle = (): Promise<void> =>
  new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));

/** Inline styles render and nothing is refused; the console stays clean. */
export const InlineStylesRender: Story = {
  render: () => <InlineStyles />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      canvasElement.ownerDocument.querySelector('meta[data-story-csp="true"]'),
    ).not.toBeNull();
    await expect(await page.findByRole("tooltip")).toBeTruthy();
    const popover = await page.findByRole("dialog");
    // The style props took effect.
    const inline = page.getByTestId("inline");
    await expect(getComputedStyle(inline).borderLeftWidth).toBe("6px");
    await waitFor(() =>
      expect(
        popover.style.getPropertyValue(
          "--radix-popover-content-transform-origin",
        ),
      ).not.toBe(""),
    );
    await expect(
      document.documentElement.style.getPropertyValue("--us-brand-accent"),
    ).toBe("#0a6e4f");
    await settle();
    await expect(violations.map((v) => v.violatedDirective)).toEqual([]);
    await expect(consoleErrors).toEqual([]);
  },
};

/**
 * Presence twin: the listener does see a refusal. A <style> element added
 * under the policy is refused and reported.
 */
export const InjectedStyleIsRefused: Story = {
  render: () => <p>An injected style element is refused.</p>,
  play: async () => {
    const style = document.createElement("style");
    style.textContent = "p { outline: 1px solid red; }";
    document.head.append(style);
    try {
      await waitFor(() =>
        expect(violations.map((v) => v.sample)).toContain(
          "p { outline: 1px solid red; }",
        ),
      );
      await expect(violations[0]?.violatedDirective).toMatch(/^style-src/);
    } finally {
      style.remove();
    }
  },
};

/**
 * Radix ScrollArea injects a <style> element to hide the native scrollbar;
 * the policy refuses it (src/ui/UPGRADING.md) and the content still
 * renders and scrolls.
 */
export const ScrollAreaStyleIsRefused: Story = {
  render: () => <ScrollAreaUnderCsp />,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        violations.some((v) =>
          v.sample.startsWith("[data-radix-scroll-area-viewport]"),
        ),
      ).toBe(true),
    );
    await expect(violations[0]?.violatedDirective).toMatch(/^style-src/);
    const links = within(canvasElement).getAllByRole("link");
    await expect(links).toHaveLength(12);
    await expect(links[0]).toBeVisible();
  },
};

import { waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";

import { ThemeProvider, type Brand } from "../../src/theme/index.js";
import {
  Badge,
  Button,
  CspNonceProvider,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../src/ui/index.js";
import { renderKit } from "../kit.js";

// Components under the Content Security Policy every `web/` sets
// (docs/PLAN.md §7): no 'unsafe-inline' for styles, no 'unsafe-eval'.
// The policy arrives as a <meta> element inserted before each test
// renders, so it governs everything the test adds to the page: React's
// `style` props (set through the CSSOM, which CSP allows), Radix
// positioning, ThemeProvider's accent property, and any <style> element a
// component injects (which CSP refuses). It cannot judge what was loaded
// before it, such as the stylesheets of the test page itself or a
// library that injects a <style> element at import time (sonner does:
// src/ui/UPGRADING.md).
//
// A CSP set by <meta> cannot be removed: every test after the first in
// this file runs under it, and vitest gives each test file its own page.
// A test fixture, not a secret: a real nonce is fresh per request.
const TEST_NONCE = "VEVTVC1zdG9yeS1ub25jZQ==";

const POLICY = [
  // 'report-sample' puts the first characters of a refused style into the
  // violation, so a test can tell whose style was refused.
  // The request's nonce (auth/server issueCspNonce); only the test that
  // passes it through CspNonceProvider uses it.
  `style-src 'self' 'nonce-${TEST_NONCE}' 'report-sample'`,
  "font-src 'self'",
  "img-src 'self' data:",
  "worker-src blob:",
  "connect-src 'self'",
].join("; ");

const violations: SecurityPolicyViolationEvent[] = [];
const consoleErrors: unknown[][] = [];

function installPolicy(): void {
  if (document.querySelector('meta[data-test-csp="true"]') !== null) return;
  document.addEventListener("securitypolicyviolation", (e) => {
    violations.push(e);
  });
  const meta = document.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = POLICY;
  meta.dataset["testCsp"] = "true";
  document.head.prepend(meta);
}

const BRAND: Brand = {
  name: "U-space",
  shortName: "U-space",
  logoUrl: null,
  contact: null,
  // A test-only accent, written by ThemeProvider as a style property.
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

function ScrollAreaWithNonce() {
  return (
    <CspNonceProvider nonce={TEST_NONCE}>
      <ScrollAreaUnderCsp />
    </CspNonceProvider>
  );
}

let restoreConsole: (() => void) | null = null;

beforeEach(() => {
  installPolicy();
  violations.length = 0;
  consoleErrors.length = 0;
  const error = console.error;
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args);
    error(...args);
  };
  restoreConsole = () => {
    console.error = error;
  };
});

afterEach(() => {
  restoreConsole?.();
  restoreConsole = null;
});

const settle = (): Promise<void> =>
  new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));

/** Inline styles render and nothing is refused; the console stays clean. */
it("inline styles render", async () => {
  const canvasElement = renderKit(<InlineStyles />).container;
  const page = within(canvasElement.ownerDocument.body);
  expect(
    canvasElement.ownerDocument.querySelector('meta[data-test-csp="true"]'),
  ).not.toBeNull();
  expect(await page.findByRole("tooltip")).toBeTruthy();
  const popover = await page.findByRole("dialog");
  // The style props took effect.
  const inline = page.getByTestId("inline");
  expect(getComputedStyle(inline).borderLeftWidth).toBe("6px");
  await waitFor(() =>
    expect(
      popover.style.getPropertyValue(
        "--radix-popover-content-transform-origin",
      ),
    ).not.toBe(""),
  );
  expect(
    document.documentElement.style.getPropertyValue("--us-brand-accent"),
  ).toBe("#0a6e4f");
  await settle();
  expect(violations.map((v) => v.violatedDirective)).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

/**
 * Presence twin: the listener does see a refusal. A <style> element added
 * under the policy is refused and reported.
 */
it("an injected style element is refused", async () => {
  renderKit(<p>An injected style element is refused.</p>);
  const style = document.createElement("style");
  style.textContent = "p { outline: 1px solid red; }";
  document.head.append(style);
  try {
    await waitFor(() =>
      expect(violations.map((v) => v.sample)).toContain(
        "p { outline: 1px solid red; }",
      ),
    );
    expect(violations[0]?.violatedDirective).toMatch(/^style-src/);
  } finally {
    style.remove();
  }
});

/**
 * Radix ScrollArea injects a <style> element to hide the native scrollbar;
 * the policy refuses it (src/ui/UPGRADING.md) and the content still
 * renders and scrolls.
 */
it("ScrollArea's style element is refused", async () => {
  const canvasElement = renderKit(<ScrollAreaUnderCsp />).container;
  await waitFor(() =>
    expect(
      violations.some((v) =>
        v.sample.startsWith("[data-radix-scroll-area-viewport]"),
      ),
    ).toBe(true),
  );
  expect(violations[0]?.violatedDirective).toMatch(/^style-src/);
  const links = within(canvasElement).getAllByRole("link");
  expect(links).toHaveLength(12);
  expect(links[0]).toBeVisible();
});

/**
 * The fix for the test above: with the request's nonce passed through
 * CspNonceProvider, ScrollArea's <style> element is allowed and nothing is
 * refused.
 */
it("ScrollArea with the nonce renders", async () => {
  const canvasElement = renderKit(<ScrollAreaWithNonce />).container;
  const style = canvasElement.querySelector("style");
  expect(style).not.toBeNull();
  expect(style?.nonce).toBe(TEST_NONCE);
  await settle();
  expect(violations.map((v) => v.violatedDirective)).toEqual([]);
  const links = within(canvasElement).getAllByRole("link");
  expect(links).toHaveLength(12);
});

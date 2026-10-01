import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { axeCheck } from "../test/axe.js";
import { renderWithKit } from "../test/render.js";
import { ZoneLegend } from "./ZoneLegend.js";

afterEach(() => {
  cleanup();
});

const ORDER = [
  "PROHIBITED",
  "REQ_AUTHORIZATION",
  "CONDITIONAL",
  "USPACE",
  "NO_RESTRICTION",
];

function items(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("li[data-zone-type]")];
}

describe("ZoneLegend", () => {
  it("lists the five types in the fixed order with names and pattern names", () => {
    renderWithKit(<ZoneLegend />);
    expect(items().map((li) => li.dataset["zoneType"])).toEqual(ORDER);
    const text = items().map((li) => li.textContent);
    expect(text[0]).toContain("Prohibited");
    expect(text[0]).toContain("solid fill");
    expect(text[1]).toContain("Authorisation required");
    expect(text[1]).toContain("hatched");
    expect(text[2]).toContain("dotted");
    expect(text[3]).toContain("U-space airspace");
    expect(text[4]).toContain("outline only");
  });

  it("draws each swatch with its pattern", () => {
    renderWithKit(<ZoneLegend />);
    const patterns = items().map((li) =>
      li.querySelector("svg")?.getAttribute("data-pattern"),
    );
    expect(patterns).toEqual(["solid", "hatched", "dotted", "none", "none"]);
    const hatched = items()[1]?.querySelector("pattern");
    expect(hatched).not.toBeNull();
    expect(
      items()[1]?.querySelector("rect[stroke]")?.getAttribute("fill"),
    ).toBe(`url(#${hatched?.id ?? ""})`);
  });

  it("fills the solid swatch and leaves the outline-only ones empty, as the map does", () => {
    renderWithKit(<ZoneLegend />);
    const fillOf = (i: number) =>
      items()[i]?.querySelector("rect[stroke]")?.getAttribute("fill");
    expect(fillOf(0)).toBe("var(--us-zone-PROHIBITED)");
    expect(fillOf(3)).toBe("none");
    expect(fillOf(4)).toBe("none");
  });

  it("shows counts when given, with a dash for a type the app did not count", () => {
    renderWithKit(<ZoneLegend counts={{ PROHIBITED: 3, USPACE: 1 }} />);
    const [prohibited, req, , uspace] = items();
    expect(prohibited?.textContent).toContain("3 zones");
    expect(uspace?.textContent).toContain("1 zone");
    expect(uspace?.textContent).not.toContain("1 zones");
    const absent = req?.querySelector('[data-count="absent"]');
    expect(absent?.textContent).toContain("—");
    expect(absent?.textContent).toContain("not provided");
    expect(req?.textContent).not.toMatch(/\b0\b/);
  });

  it("shows no count at all without counts (the twin)", () => {
    renderWithKit(<ZoneLegend />);
    expect(document.querySelectorAll("[data-count]")).toHaveLength(0);
  });

  it("says what dimmed means and that unstated is drawn in full", () => {
    renderWithKit(<ZoneLegend />);
    expect(screen.getByText(/Dimmed: the server reports/)).toBeTruthy();
    expect(
      screen.getByText(/Drawn in full when the server does not say/),
    ).toBeTruthy();
  });

  it("is a labelled region with a keyboard-reachable toggle", () => {
    renderWithKit(<ZoneLegend />);
    const region = screen.getByRole("region", { name: "Zone types" });
    const toggle = within(region).getByRole("button", { name: "Zone types" });
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const list = document.getElementById(
      toggle.getAttribute("aria-controls") ?? "",
    );
    expect(list?.hidden).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(list?.hidden).toBe(true);
    fireEvent.click(toggle);
    expect(list?.hidden).toBe(false);
  });

  it("starts collapsed when asked", () => {
    renderWithKit(<ZoneLegend defaultCollapsed />);
    expect(
      screen
        .getByRole("button", { name: "Zone types" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("speaks Georgian", () => {
    renderWithKit(<ZoneLegend counts={{ PROHIBITED: 2 }} />, { lang: "ka" });
    expect(screen.getByRole("region", { name: "ზონების ტიპები" })).toBeTruthy();
    expect(items()[0]?.textContent).toContain("აკრძალული");
    expect(items()[0]?.textContent).toContain("2 ზონა");
  });

  it.each(["en", "ka"] as const)("passes axe in %s", async (lang) => {
    const { container } = renderWithKit(
      <ZoneLegend counts={{ PROHIBITED: 2 }} />,
      { lang },
    );
    await axeCheck(container);
  });
});

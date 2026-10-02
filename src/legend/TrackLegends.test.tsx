// The track legends (WP-7, PLAN §3.10): order, counts with the dash for an
// uncounted row, the hollow and dashed cues, the age ranges under a chosen
// threshold and without one, the R-05 caveat present in the
// identification legend and absent from the severity legend, Georgian, and
// axe in both languages.
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IDENT_STATUSES, SEVERITIES, TRUSTS } from "../model/index.js";
import { identOrder } from "../symbology/ident.js";
import { AGE_BUCKETS } from "../theme/tokens.js";
import { axeCheck } from "../test/axe.js";
import { renderWithKit } from "../test/render.js";
import { AgeLegend } from "./AgeLegend.js";
import { IdentificationLegend } from "./IdentificationLegend.js";
import { SeverityLegend } from "./SeverityLegend.js";
import { TrackLegend } from "./TrackLegend.js";

afterEach(() => {
  cleanup();
});

// A chosen policy value for the test, not a default of the kit.
const STALE_AFTER_S = 30;

const rows = (attr: string): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(`li[data-${attr}]`),
];
const BROADCAST_CAVEAT = /Broadcast and unverified/;

describe("TrackLegend", () => {
  it("lists the six trust classes, each with its own shape", () => {
    renderWithKit(<TrackLegend />);
    expect(rows("trust").map((li) => li.dataset["trust"])).toEqual([...TRUSTS]);
    const shapes = rows("trust").map((li) =>
      li.querySelector("svg")?.getAttribute("data-shape"),
    );
    expect(new Set(shapes).size).toBe(6);
  });

  it("draws broadcast hollow and simulated dashed, the rest solid", () => {
    renderWithKit(<TrackLegend />);
    const fill = (t: string) =>
      document
        .querySelector(`li[data-trust="${t}"] svg`)
        ?.getAttribute("data-fill");
    expect(fill("broadcast")).toBe("hollow");
    expect(fill("simulated")).toBe("dashed");
    for (const t of ["authenticated", "provider", "surveillance", "sensor"]) {
      expect(fill(t)).toBe("solid");
    }
    const broadcastPaths = document.querySelectorAll(
      'li[data-trust="broadcast"] path',
    );
    expect([...broadcastPaths].map((p) => p.getAttribute("fill"))).toEqual([
      "none",
    ]);
    expect(
      document
        .querySelector('li[data-trust="simulated"] path[stroke-dasharray]')
        ?.getAttribute("stroke-dasharray"),
    ).toBeTruthy();
  });

  it("gives each class its meaning; broadcast says broadcast and unverified (R-05)", () => {
    renderWithKit(<TrackLegend />);
    const text = (t: string) =>
      document.querySelector(`li[data-trust="${t}"]`)?.textContent ?? "";
    expect(text("broadcast")).toMatch(BROADCAST_CAVEAT);
    expect(text("provider")).toMatch(/unverified/);
    expect(text("authenticated")).not.toMatch(/unverified/);
    expect(text("simulated")).toContain("lab only");
  });

  it("explains colour, arrow and rings", () => {
    renderWithKit(<TrackLegend />);
    for (const note of ["shape", "arrow", "emergency", "selected"]) {
      expect(document.querySelector(`[data-note="${note}"]`)).not.toBeNull();
    }
    expect(
      document.querySelectorAll('[data-note="arrow"] path').length,
    ).toBeGreaterThan(1);
  });

  it("shows counts, a dash for a class the app did not count, and plurals", () => {
    renderWithKit(<TrackLegend counts={{ broadcast: 3, sensor: 1 }} />);
    const row = (t: string) =>
      document.querySelector(`li[data-trust="${t}"]`) as HTMLElement;
    expect(row("broadcast").textContent).toContain("3 tracks");
    expect(row("sensor").textContent).toContain("1 track");
    expect(row("sensor").textContent).not.toContain("1 tracks");
    const absent = row("provider").querySelector('[data-count="absent"]');
    expect(absent?.textContent).toContain("—");
    expect(row("provider").textContent).not.toMatch(/\b0\b/);
  });

  it("shows no count at all without counts (the twin)", () => {
    renderWithKit(<TrackLegend />);
    expect(document.querySelectorAll("[data-count]")).toHaveLength(0);
  });

  it("is a labelled region with a keyboard-reachable toggle", () => {
    renderWithKit(<TrackLegend />);
    const region = screen.getByRole("region", { name: "Track symbols" });
    const toggle = within(region).getByRole("button", {
      name: "Track symbols",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const body = document.getElementById(
      toggle.getAttribute("aria-controls") ?? "",
    );
    expect(body?.hidden).toBe(true);
  });

  it("starts collapsed when asked", () => {
    renderWithKit(<TrackLegend defaultCollapsed />);
    expect(
      screen
        .getByRole("button", { name: "Track symbols" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });
});

describe("IdentificationLegend", () => {
  it("lists the statuses in identOrder(), none last", () => {
    renderWithKit(<IdentificationLegend />);
    expect(rows("ident").map((li) => li.dataset["ident"])).toEqual([
      ...identOrder(),
    ]);
    expect(rows("ident")).toHaveLength(IDENT_STATUSES.length + 1);
  });

  it("flags the attention statuses, and only them (G-03)", () => {
    renderWithKit(<IdentificationLegend />);
    const flagged = rows("ident")
      .filter((li) => li.dataset["attention"] === "true")
      .map((li) => li.dataset["ident"]);
    expect(flagged).toEqual(["unknown_operator", "unidentified"]);
    expect(document.querySelector('[data-note="attention"]')).not.toBeNull();
  });

  it("draws each status's colour and its mark; registered alone has none", () => {
    renderWithKit(<IdentificationLegend />);
    const marks = rows("ident").map(
      (li) =>
        li.querySelector("[data-mark]")?.getAttribute("data-mark") ?? null,
    );
    expect(marks[0]).toBe("");
    expect(marks.slice(1).every((m) => m !== "" && m !== null)).toBe(true);
    const tokens = rows("ident").map((li) =>
      li.querySelector("svg")?.getAttribute("data-token"),
    );
    expect(tokens.at(-1)).toBe("--us-ident-none");
    expect(new Set(tokens).size).toBe(5);
  });

  it("gives each status its hint", () => {
    renderWithKit(<IdentificationLegend />);
    const text = (s: string) =>
      document.querySelector(`li[data-ident="${s}"]`)?.textContent ?? "";
    expect(text("unidentified")).toContain("nobody can say what aircraft");
    expect(text("suspended")).toContain("suspended or revoked");
  });

  it("carries the broadcast caveat (R-05), the provider caveat and the mismatch note", () => {
    renderWithKit(<IdentificationLegend />);
    expect(
      document.querySelector('[data-note="broadcast"]')?.textContent,
    ).toMatch(BROADCAST_CAVEAT);
    expect(
      document.querySelector('[data-note="provider"]')?.textContent,
    ).toMatch(/reported by a provider, unverified/i);
    expect(
      document.querySelector('[data-note="mismatch"]')?.textContent,
    ).toContain("never as registered");
  });

  it("shows counts with a dash for an uncounted status", () => {
    renderWithKit(<IdentificationLegend counts={{ registered: 4, none: 2 }} />);
    const row = (s: string) =>
      document.querySelector(`li[data-ident="${s}"]`) as HTMLElement;
    expect(row("registered").textContent).toContain("4 tracks");
    expect(row("none").textContent).toContain("2 tracks");
    expect(
      row("unidentified").querySelector('[data-count="absent"]'),
    ).not.toBeNull();
  });
});

describe("AgeLegend", () => {
  it("lists the four buckets with the ranges under the server's threshold", () => {
    renderWithKit(<AgeLegend staleAfterS={STALE_AFTER_S} />);
    expect(rows("age").map((li) => li.dataset["age"])).toEqual([
      ...AGE_BUCKETS,
    ]);
    const text = (b: string) =>
      document.querySelector(`li[data-age="${b}"]`)?.textContent ?? "";
    expect(text("live")).toContain("under 10 s");
    expect(text("aging")).toContain("10 s to under 30 s");
    expect(text("stale")).toContain("30 s or more");
    expect(text("stale")).toContain("never removed");
    expect(text("unknown")).toContain("drawn in full");
    expect(
      document.querySelector('[data-note="basis"]')?.textContent,
    ).toContain("(30 s)");
  });

  it("draws each bucket at the map's opacity, stale faintest", () => {
    renderWithKit(<AgeLegend staleAfterS={STALE_AFTER_S} />);
    const o = (b: string) =>
      Number(
        document
          .querySelector(`li[data-age="${b}"] svg`)
          ?.getAttribute("data-opacity"),
      );
    expect(o("stale")).toBeLessThan(o("aging"));
    expect(o("aging")).toBeLessThan(o("live"));
    expect(o("unknown")).toBe(1);
  });

  it("shows a third that is not whole with one decimal", () => {
    renderWithKit(<AgeLegend staleAfterS={20} />);
    expect(
      document.querySelector('li[data-age="live"]')?.textContent,
    ).toContain("under 6.7 s");
  });

  it("without a usable threshold says ages are not bucketed and invents no range", () => {
    renderWithKit(<AgeLegend staleAfterS={Number.NaN} />);
    expect(document.querySelector('[data-note="no-threshold"]')).not.toBeNull();
    expect(document.querySelector('[data-note="basis"]')).toBeNull();
    expect(
      document.querySelector('li[data-age="live"]')?.textContent,
    ).not.toMatch(/under/);
  });
});

describe("SeverityLegend", () => {
  it("lists the severities gravest first, each with its own glyph", () => {
    renderWithKit(<SeverityLegend />);
    expect(rows("severity").map((li) => li.dataset["severity"])).toEqual([
      "critical",
      "warning",
      "info",
    ]);
    const glyphs = rows("severity").map((li) =>
      li.querySelector("svg")?.getAttribute("data-glyph"),
    );
    expect(new Set(glyphs).size).toBe(SEVERITIES.length);
  });

  it("does not carry the broadcast caveat (the twin of IdentificationLegend)", () => {
    const { container } = renderWithKit(<SeverityLegend />);
    expect(container.textContent).not.toMatch(BROADCAST_CAVEAT);
    expect(container.textContent).not.toMatch(/unverified/);
  });
});

describe("both languages", () => {
  it("speaks Georgian", () => {
    renderWithKit(
      <>
        <TrackLegend counts={{ broadcast: 2 }} />
        <IdentificationLegend />
        <AgeLegend staleAfterS={STALE_AFTER_S} />
        <SeverityLegend />
      </>,
      { lang: "ka" },
    );
    expect(
      screen.getByRole("region", { name: "ტრეკების სიმბოლოები" }),
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "იდენტიფიკაცია" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "ტრეკის ასაკი" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "სიმძიმე" })).toBeTruthy();
    expect(
      document.querySelector('li[data-trust="broadcast"]')?.textContent,
    ).toContain("დაუდასტურებელი");
    expect(
      document.querySelector('[data-note="broadcast"]')?.textContent,
    ).toContain("დაუდასტურებელი");
  });

  it.each(["en", "ka"] as const)("passes axe in %s", async (lang) => {
    const { container } = renderWithKit(
      <>
        <TrackLegend counts={{ broadcast: 2 }} />
        <IdentificationLegend counts={{ registered: 1 }} />
        <AgeLegend staleAfterS={STALE_AFTER_S} />
        <SeverityLegend />
      </>,
      { lang },
    );
    await axeCheck(container);
  });
});

// ThresholdsPanel (1.0.0; uspace-ussp Q28 gap 2): the thresholds a status
// frame carries, shown with their units and policy version in both
// languages; a frame without them says so and shows no number (INV-03,
// E-01 twin); an unknown name is shown as the system spells it.
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { axeCheck } from "../test/axe.js";
import { renderWithKit } from "../test/render.js";
import { ThresholdsPanel } from "./ThresholdsPanel.js";

afterEach(() => {
  cleanup();
});

// The USSP's traffic stream (uspace-ussp internal/app/trafficws).
const USSP = {
  traffic_radius_m: 5000,
  cpa_clear_after_s: 10,
  cpa_tcpa_max_s: 60,
  cpa_horizontal_min_m: 60,
  cpa_vertical_min_m: 20,
  cpa_neighbour_radius_m: 800,
};

const rows = (container: HTMLElement): string[][] =>
  [...container.querySelectorAll("[data-threshold]")].map((r) => [
    r.getAttribute("data-threshold") ?? "",
    r.querySelector("dt")?.textContent ?? "",
    r.querySelector("dd")?.textContent ?? "",
  ]);

describe("ThresholdsPanel", () => {
  it("shows every threshold with its unit, in the kit's order, and the policy (en)", async () => {
    const { container } = renderWithKit(
      <ThresholdsPanel
        thresholds={USSP}
        evaluationPeriodS={0.4}
        policyVersion="7"
      />,
    );
    expect(rows(container)).toEqual([
      ["cpa_tcpa_max_s", "Look-ahead to the closest approach", "60 s"],
      ["cpa_horizontal_min_m", "Horizontal separation minimum", "60 m"],
      ["cpa_vertical_min_m", "Vertical separation minimum", "20 m"],
      ["cpa_neighbour_radius_m", "Radius searched for neighbours", "800 m"],
      ["cpa_clear_after_s", "A proximity alert clears after", "10 s"],
      ["traffic_radius_m", "Traffic information radius", "5,000 m"],
      [
        "evaluation_period_s",
        "Proximity evaluation period (newest proximity alert)",
        "0.4 s",
      ],
    ]);
    expect(screen.getByText("Policy version 7")).toBeTruthy();
    expect(
      container.querySelector("[data-panel]")?.getAttribute("data-thresholds"),
    ).toBe("present");
    expect(container.querySelector("[data-thresholds-none]")).toBeNull();
    await axeCheck(container);
  });

  it("says in Georgian, with Georgian units", () => {
    const { container } = renderWithKit(
      <ThresholdsPanel
        thresholds={{ cpa_horizontal_min_m: 60 }}
        policyVersion="7"
      />,
      { lang: "ka" },
    );
    expect(rows(container)).toEqual([
      ["cpa_horizontal_min_m", "ჰორიზონტალური განცალკევების მინიმუმი", "60 მ"],
    ]);
    expect(screen.getByText("მოქმედი ზღვრები")).toBeTruthy();
  });

  it("says the frame carries none and shows no number (the twin; INV-03)", async () => {
    const { container } = renderWithKit(
      <ThresholdsPanel thresholds={null} policyVersion={null} />,
    );
    expect(rows(container)).toEqual([]);
    expect(container.querySelector("[data-thresholds-none]")?.textContent).toBe(
      "The system sends no thresholds in its status; none is assumed.",
    );
    expect(screen.getByText("No policy version received yet")).toBeTruthy();
    expect(
      container.querySelector("[data-panel]")?.getAttribute("data-thresholds"),
    ).toBe("absent");
    expect(container.textContent).not.toMatch(/\d/);
    await axeCheck(container);
  });

  it("an empty thresholds object is none too, and the evaluation period alone still shows", () => {
    const { container } = renderWithKit(
      <ThresholdsPanel
        thresholds={{}}
        evaluationPeriodS={1}
        policyVersion="7"
      />,
    );
    expect(rows(container)).toEqual([
      [
        "evaluation_period_s",
        "Proximity evaluation period (newest proximity alert)",
        "1 s",
      ],
    ]);
  });

  it("shows a name the kit has no words for as the system spells it, after the known ones", () => {
    const { container } = renderWithKit(
      <ThresholdsPanel
        thresholds={{ zz_hold_s: 5, cpa_vertical_min_m: 20, aa_gap_m: 1.5 }}
        policyVersion="7"
      />,
    );
    expect(rows(container)).toEqual([
      ["cpa_vertical_min_m", "Vertical separation minimum", "20 m"],
      ["aa_gap_m", "aa_gap_m (as the system names it)", "1.5 m"],
      ["zz_hold_s", "zz_hold_s (as the system names it)", "5 s"],
    ]);
  });
});

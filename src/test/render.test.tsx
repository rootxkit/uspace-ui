import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useT } from "../i18n/I18nProvider.js";
import { axeCheck, formatViolations } from "./axe.js";
import { renderWithKit, TEST_BRAND } from "./render.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("renderWithKit", () => {
  it("renders the ui inside the kit wrapper with the defaults", () => {
    renderWithKit(<p>content</p>);
    const root = screen.getByTestId("kit-root");
    expect(screen.getByText("content").parentElement).toBe(root);
    expect(root.getAttribute("lang")).toBe("en");
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.getAttribute("data-brand")).toBe(TEST_BRAND.shortName);
    expect(root.hasAttribute("data-now-ms")).toBe(false);
  });

  it("passes language, scheme, brand and clock through", () => {
    renderWithKit(<p>x</p>, {
      lang: "ka",
      scheme: "dark",
      brand: { ...TEST_BRAND, shortName: "TEST" },
      now: 1_000,
    });
    const root = screen.getByTestId("kit-root");
    expect(root.getAttribute("lang")).toBe("ka");
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.getAttribute("data-brand")).toBe("TEST");
    expect(root.getAttribute("data-now-ms")).toBe("1000");
  });

  it("provides the kit's i18n in the chosen language", () => {
    function Label() {
      return <p>{useT()("map.layers")}</p>;
    }
    renderWithKit(<Label />, { lang: "ka" });
    expect(screen.getByText("ფენები")).toBeDefined();
    cleanup();
    renderWithKit(<Label />);
    expect(screen.getByText("Layers")).toBeDefined();
  });

  it("resolves the system scheme to light", () => {
    renderWithKit(<p>x</p>, { scheme: "system" });
    const root = screen.getByTestId("kit-root");
    expect(root.getAttribute("data-scheme")).toBe("system");
    expect(root.getAttribute("data-theme")).toBe("light");
  });

  it("works under fake timers and leaves them pending-free", () => {
    vi.useFakeTimers();
    renderWithKit(<p>x</p>, { now: 5 });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("axeCheck", () => {
  it("resolves on an accessible container", async () => {
    const { container } = renderWithKit(
      <main>
        <h1>Title</h1>
        <img src="data:," alt="Test logo" />
        <button type="button">Act</button>
      </main>,
    );
    await expect(axeCheck(container)).resolves.toBeUndefined();
  });

  it("rejects with the violations listed", async () => {
    const { container } = renderWithKit(
      <main>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- the violation under test */}
        <img src="data:," />
        <button type="button" />
      </main>,
    );
    await expect(axeCheck(container)).rejects.toThrow(
      /image-alt[\s\S]*button-name|button-name[\s\S]*image-alt/,
    );
  });

  it("formats each violation on its own line", () => {
    expect(
      formatViolations([
        {
          id: "image-alt",
          impact: "critical",
          help: "Images must have alternative text",
          nodes: [{ target: ["img"] }],
        },
        { id: "x", impact: null, help: "h", nodes: [] },
      ] as unknown as Parameters<typeof formatViolations>[0]),
    ).toBe(
      "image-alt (critical): Images must have alternative text [img]\nx (unknown): h []",
    );
  });
});

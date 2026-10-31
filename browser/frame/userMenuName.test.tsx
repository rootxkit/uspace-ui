// The user menu's trigger and WCAG 2.5.3 (label in name), the axe rule
// label-content-name-mismatch, which axe-core 4.14 runs as a WCAG 2.1 A
// rule: every word of the trigger's visible text must be in its
// accessible name, "Account menu: {user}". The initials of the avatar are
// drawn by CSS from data-initials, so the visible text is the name alone.
// The pair: the same markup with the initials written as text fails. At
// a desktop width, where the name is shown beside the avatar (on a narrow
// screen only the avatar is, and the rule has no visible text to judge).
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { UserMenu } from "../../src/ui/extra/index.js";
import { LOOKS, lookName, renderKit } from "../kit.js";

async function mismatches(root: Element): Promise<string[]> {
  const r = await axe.run(root, {
    runOnly: { type: "rule", values: ["label-content-name-mismatch"] },
    resultTypes: ["violations"],
  });
  return r.violations.flatMap((v) => v.nodes.map((n) => n.target.join(" ")));
}

describe("UserMenu trigger: label in name (WCAG 2.5.3)", () => {
  for (const look of LOOKS) {
    it(`has its visible text in its accessible name (${lookName(look)})`, async () => {
      await page.viewport(1280, 900);
      const view = renderKit(<UserMenu name="TEST-account-0001" />, look);
      const trigger = view.container.querySelector('[data-slot="user-menu"]');
      expect(trigger).not.toBeNull();
      // The initials are shown (CSS), and are not text of the trigger.
      const avatar = trigger?.querySelector("[data-initials]");
      expect(avatar?.getAttribute("data-initials")).toBe("T");
      expect(getComputedStyle(avatar as Element, "::before").content).toBe(
        '"T"',
      );
      // The name is visible text of the trigger, so the rule has a label
      // to judge.
      expect((trigger as HTMLElement).innerText).toContain("TEST-account-0001");
      expect(await mismatches(view.container)).toEqual([]);
    });
  }

  it("fails the rule when the initials are written as text (the pair)", async () => {
    await page.viewport(1280, 900);
    const view = renderKit(<UserMenu name="TEST-account-0001" />);
    const avatar = view.container.querySelector("[data-initials]");
    expect(avatar).not.toBeNull();
    (avatar as Element).textContent = "T";
    const found = await mismatches(view.container);
    expect(found).toHaveLength(1);
    // Leave the page as the component draws it for the after-each axe run.
    (avatar as Element).textContent = "";
  });
});

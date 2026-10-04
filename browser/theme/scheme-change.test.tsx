import { useLayoutEffect, useRef } from "react";
import { expect, it } from "vitest";

import { axeCheck } from "../../src/test/axe.js";
import { Input } from "../../src/ui/index.js";
import { EN_LIGHT, KA_DARK, renderKit } from "../kit.js";

// A scheme change must not fade a control's text from the old scheme's
// colour into the new one: in dark that is near-black text on a dark field
// for the length of the transition, which a user sees and axe reports
// (DataTable "empty (ka dark)" failed on it in CI). ThemeProvider switches
// with transitions off (data-scheme-changing, styles/tokens.css).

/** Reads layout in a layout effect, as a measured table does, so the page
 * is styled before ThemeProvider's own layout effect sets the scheme. */
function Measured() {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    void ref.current?.offsetWidth;
  });
  return <Input ref={ref} aria-label="filter" data-testid="field" />;
}

const field = (): HTMLInputElement => {
  const el = document.querySelector<HTMLInputElement>('[data-testid="field"]');
  if (el === null) throw new Error("no field");
  return el;
};

/** The colour transitions running on `el`. */
const colourTransitions = (el: Element): Animation[] =>
  el
    .getAnimations()
    .filter(
      (a) =>
        a instanceof CSSTransition &&
        a.transitionProperty === "color" &&
        a.playState === "running",
    );

it("mounting in dark after a styled pass starts no colour transition", async () => {
  // The previous scheme is light, as after an en light test or a server
  // rendering in light.
  document.documentElement.setAttribute("data-theme", "light");
  renderKit(<Measured />, KA_DARK);
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  expect(colourTransitions(field())).toEqual([]);
  // Judged at once, without waiting for anything to settle.
  await axeCheck(document.body);
});

it("changing data-theme without ThemeProvider does fade the text", () => {
  // The hazard ThemeProvider avoids, and proof the probe above sees it.
  const { container } = renderKit(<Measured />, EN_LIGHT);
  void field().offsetWidth;
  container.ownerDocument.documentElement.setAttribute("data-theme", "dark");
  expect(colourTransitions(field())).toHaveLength(1);
  // Leave the page in the scheme it was rendered in, for the axe check
  // after the test.
  container.ownerDocument.documentElement.setAttribute("data-theme", "light");
});

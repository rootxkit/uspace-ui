// The CSP nonce reaches the <style> element Radix ScrollArea injects
// (docs/PLAN.md §7; PR #4 finding), and without a provider there is none.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ScrollArea } from "../scroll-area.js";
import { CspNonceProvider, useCspNonce } from "./CspNonce.js";

afterEach(() => {
  cleanup();
});

describe("CspNonceProvider", () => {
  it("gives ScrollArea's injected style the request's nonce", () => {
    const view = render(
      <CspNonceProvider nonce="TESTNONCE0000000">
        <ScrollArea>
          <p>rows</p>
        </ScrollArea>
      </CspNonceProvider>,
    );
    const style = view.container.querySelector("style");
    expect(style).not.toBeNull();
    expect(style?.getAttribute("nonce")).toBe("TESTNONCE0000000");
  });

  it("without a provider the style carries no nonce (the twin)", () => {
    const view = render(
      <ScrollArea>
        <p>rows</p>
      </ScrollArea>,
    );
    const style = view.container.querySelector("style");
    expect(style).not.toBeNull();
    expect(style?.hasAttribute("nonce")).toBe(false);
  });

  it("useCspNonce is undefined outside a provider", () => {
    let seen: string | undefined = "unset";
    function Probe() {
      seen = useCspNonce();
      return null;
    }
    render(<Probe />);
    expect(seen).toBeUndefined();
  });
});

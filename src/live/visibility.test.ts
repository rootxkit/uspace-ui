// The visibility readers where there is no document (the node project
// has none, like a server render): visible, and nothing to listen to. The
// document's side is in polling.test.tsx.
import { describe, expect, it, vi } from "vitest";

import { pageVisible, subscribePageVisible } from "./visibility.js";

describe("visibility without a document", () => {
  it("counts as visible", () => {
    expect(typeof document).toBe("undefined");
    expect(pageVisible()).toBe(true);
  });

  it("subscribes to nothing and unsubscribes without an error", () => {
    const fn = vi.fn();
    const unsubscribe = subscribePageVisible(fn);
    expect(() => {
      unsubscribe();
    }).not.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });
});

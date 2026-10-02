// APG "Data Grid" keyboard movement, key by key, as a pure function: each
// key moves where the pattern says, stops at the edges without wrapping,
// and a key that is not a movement key moves nothing (the twin).
import { describe, expect, it } from "vitest";

import { PAGE_STEP_ROWS, nextGridPos, type GridKey } from "./keyboard.js";

const key = (k: string, mods: Partial<GridKey> = {}): GridKey => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

// A header row and 30 body rows, 4 columns.
const SIZE = { rows: 31, cols: 4 };
const MID = { row: 15, col: 2 };

describe("nextGridPos", () => {
  it.each([
    ["ArrowRight", { row: 15, col: 3 }],
    ["ArrowLeft", { row: 15, col: 1 }],
    ["ArrowDown", { row: 16, col: 2 }],
    ["ArrowUp", { row: 14, col: 2 }],
    ["Home", { row: 15, col: 0 }],
    ["End", { row: 15, col: 3 }],
    ["PageDown", { row: 25, col: 2 }],
    ["PageUp", { row: 5, col: 2 }],
  ])("%s from the middle", (k, to) => {
    expect(nextGridPos(key(k), MID, SIZE)).toEqual(to);
  });

  it("Ctrl+Home and Ctrl+End go to the first and last cell of the grid (and Cmd on a Mac)", () => {
    expect(nextGridPos(key("Home", { ctrlKey: true }), MID, SIZE)).toEqual({
      row: 0,
      col: 0,
    });
    expect(nextGridPos(key("End", { ctrlKey: true }), MID, SIZE)).toEqual({
      row: 30,
      col: 3,
    });
    expect(nextGridPos(key("End", { metaKey: true }), MID, SIZE)).toEqual({
      row: 30,
      col: 3,
    });
  });

  it("stops at every edge and never wraps", () => {
    const corner = { row: 0, col: 0 };
    expect(nextGridPos(key("ArrowLeft"), corner, SIZE)).toEqual(corner);
    expect(nextGridPos(key("ArrowUp"), corner, SIZE)).toEqual(corner);
    const last = { row: 30, col: 3 };
    expect(nextGridPos(key("ArrowRight"), last, SIZE)).toEqual(last);
    expect(nextGridPos(key("ArrowDown"), last, SIZE)).toEqual(last);
    expect(nextGridPos(key("PageDown"), { row: 28, col: 1 }, SIZE)).toEqual({
      row: 30,
      col: 1,
    });
  });

  it("PageUp from the body stops at the first body row, from the header stays", () => {
    expect(nextGridPos(key("PageUp"), { row: 3, col: 1 }, SIZE)).toEqual({
      row: 1,
      col: 1,
    });
    expect(nextGridPos(key("PageUp"), { row: 0, col: 1 }, SIZE)).toEqual({
      row: 0,
      col: 1,
    });
    expect(PAGE_STEP_ROWS).toBe(10);
  });

  it("returns null for a key that is not a movement key, and for an empty grid", () => {
    for (const k of ["Enter", " ", "a", "Tab", "Escape"])
      expect(nextGridPos(key(k), MID, SIZE)).toBeNull();
    expect(nextGridPos(key("ArrowDown"), MID, { rows: 0, cols: 4 })).toBeNull();
    expect(nextGridPos(key("ArrowDown"), MID, { rows: 4, cols: 0 })).toBeNull();
  });
});

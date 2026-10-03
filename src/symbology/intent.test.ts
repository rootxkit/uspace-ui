// Intent symbology (WP-12): the four DSS states pinned to uspace-core
// v1.3.0, a look for each state and for `peer` (loops over every key),
// Nonconforming and Contingent drawn unlike Activated, an unknown or
// absent state never drawn as Activated (with its twin), and the peer
// diamond tile.
import { featureFilter } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";

import { en } from "../i18n/en.js";
import { ka } from "../i18n/ka.js";
import { tokens } from "../theme/tokens.js";
import {
  DSS_STATES,
  INTENT_PATTERN_TILE_PX,
  INTENT_STATE_KEYS,
  INTENT_STATE_KEYS_ORDER,
  intentLook,
  intentPeerPatternImage,
  intentStateDrawn,
  intentStateFilter,
  isDssState,
  type IntentKey,
} from "./intent.js";

describe("DSS states", () => {
  it("are uspace-core v1.3.0 f3548.OperationalIntentState, string for string", () => {
    // f3548/types.gen.go at v1.3.0: Accepted, Activated, Contingent,
    // Nonconforming (E-03: read, cite, pin).
    expect([...DSS_STATES].sort()).toEqual(
      ["Accepted", "Activated", "Contingent", "Nonconforming"].sort(),
    );
  });

  it("isDssState accepts the four and nothing else", () => {
    for (const s of DSS_STATES) expect(isDssState(s)).toBe(true);
    for (const v of ["activated", "Ended", "", null, 3]) {
      expect(isDssState(v)).toBe(false);
    }
  });

  it("a known state is drawn as sent", () => {
    for (const s of DSS_STATES) expect(intentStateDrawn(s)).toBe(s);
  });

  it("null and an unknown value are drawn as unstated (the twin)", () => {
    expect(intentStateDrawn(null)).toBe("unstated");
    expect(intentStateDrawn("Ended")).toBe("unstated");
  });
});

describe("looks, total over the four states and peer", () => {
  const keys: readonly IntentKey[] = [...DSS_STATES, "peer"];
  for (const k of keys) {
    it(`${k} has a token and a look`, () => {
      const l = intentLook(k);
      expect(l.token).toMatch(/^--us-/);
      expect(l.fillOpacity).toBeGreaterThanOrEqual(0);
      expect(l.lineWidthPx).toBeGreaterThanOrEqual(0);
    });
  }

  it("each state and unstated has a name in both catalogues", () => {
    for (const k of INTENT_STATE_KEYS_ORDER) {
      expect(en[INTENT_STATE_KEYS[k]]).not.toBe("");
      expect(ka[INTENT_STATE_KEYS[k]]).not.toBe("");
    }
  });

  it("Accepted is thinner and lighter than Activated", () => {
    expect(intentLook("Accepted").lineWidthPx).toBeLessThan(
      intentLook("Activated").lineWidthPx,
    );
    expect(intentLook("Accepted").fillOpacity).toBeLessThan(
      intentLook("Activated").fillOpacity,
    );
  });

  it("Nonconforming is the warning colour and Contingent the critical one, neither like Activated", () => {
    expect(intentLook("Nonconforming").token).toBe(tokens.severity.warning);
    expect(intentLook("Contingent").token).toBe(tokens.severity.critical);
    for (const k of ["Nonconforming", "Contingent"] as const) {
      expect(intentLook(k)).not.toEqual(intentLook("Activated"));
      expect(intentLook(k).token).not.toBe(intentLook("Activated").token);
    }
  });

  it("unstated is dashed and muted, never Activated's look", () => {
    expect(intentLook("unstated").dash).not.toBeNull();
    expect(intentLook("unstated")).not.toEqual(intentLook("Activated"));
    for (const s of DSS_STATES) expect(intentLook(s).dash).toBeNull();
  });

  it("peer is the diamond pattern in the provider colour; no state is patterned", () => {
    expect(intentLook("peer").pattern).toBe("diamond");
    expect(intentLook("peer").token).toBe(tokens.trust.provider);
    for (const s of DSS_STATES) expect(intentLook(s).pattern).toBe("none");
  });
});

describe("filters and the peer tile", () => {
  it("each state's line filter matches its own features only", () => {
    for (const k of INTENT_STATE_KEYS_ORDER) {
      for (const other of INTENT_STATE_KEYS_ORDER) {
        const hit = featureFilter(intentStateFilter(k) as never).filter(
          { zoom: 12 },
          { type: 3, properties: { state: other } },
        );
        expect(hit, `${k} on ${other}`).toBe(k === other);
      }
    }
  });

  it("the diamond tile has ink on its edge midpoints and none in its centre", () => {
    const img = intentPeerPatternImage([10, 20, 30]);
    const size = INTENT_PATTERN_TILE_PX;
    expect(img.data).toHaveLength(size * size * 4);
    const alpha = (x: number, y: number): number =>
      img.data[(y * size + x) * 4 + 3] ?? 0;
    expect(alpha(size / 2, 0)).toBe(255);
    expect(alpha(0, size / 2)).toBe(255);
    expect(alpha(size / 2, size / 2)).toBe(0);
    expect(img.data[(0 * size + size / 2) * 4]).toBe(10);
  });
});

// Severity symbology (WP-7): total over the enumeration, gravest first,
// a glyph per severity so the three read without colour.
import { describe, expect, it } from "vitest";

import { en } from "../i18n/en.js";
import { ka } from "../i18n/ka.js";
import { SEVERITIES } from "../model/index.js";
import { tokens } from "../theme/tokens.js";
import {
  SEVERITY_HINT_KEYS,
  SEVERITY_KEYS,
  severityGlyph,
  severityOrder,
  severityToken,
} from "./severity.js";

describe("severity", () => {
  it.each(SEVERITIES)("%s has a token, a glyph, a name and a hint", (s) => {
    expect(severityToken(s)).toBe(tokens.severity[s]);
    expect(["octagon", "triangle", "circle"]).toContain(severityGlyph(s));
    for (const k of [SEVERITY_KEYS[s], SEVERITY_HINT_KEYS[s]]) {
      expect(en[k]).not.toBe("");
      expect(ka[k]).not.toBe("");
    }
  });

  it("orders gravest first, each severity once", () => {
    expect(severityOrder()).toEqual(["critical", "warning", "info"]);
    expect([...severityOrder()].sort()).toEqual([...SEVERITIES].sort());
  });

  it("every severity has its own glyph, not only its own colour", () => {
    expect(new Set(SEVERITIES.map(severityGlyph)).size).toBe(SEVERITIES.length);
  });
});

// Identification symbology (WP-7; spec 04 §3.2; LESSONS G-01, G-02,
// G-03, R-05; PLAN §14 Q18): total over every status, reason and basis,
// the legend order, the caveat triple, and the mismatch line whatever the
// status, each with its twin (E-01).
import { describe, expect, it } from "vitest";

import { en, type Key } from "../i18n/en.js";
import { ka } from "../i18n/ka.js";
import {
  IDENT_BASES,
  IDENT_REASONS,
  IDENT_STATUSES,
  type Identification,
} from "../model/index.js";
import { tokens } from "../theme/tokens.js";
import {
  IDENT_BASIS_KEYS,
  IDENT_ORDER,
  IDENT_STATUS_HINT_KEYS,
  IDENT_STATUS_KEYS,
  identDrawn,
  identHintKey,
  identMark,
  identOrder,
  identToken,
  needsAttention,
} from "./ident.js";

const UNVERIFIED = { en: /unverified/, ka: /დაუდასტურებ/ };

function inBoth(k: Key): void {
  expect(en[k], k).toBeTruthy();
  expect(ka[k], k).toBeTruthy();
}

function ident(over: Partial<Identification> = {}): Identification {
  return {
    status: "registered",
    reason: "matched",
    serial: "TEST-SN-0001",
    operatorReg: "GEO-TEST-OP-0001",
    registeredOperatorReg: null,
    mismatch: false,
    basis: "authenticated",
    ...over,
  };
}

describe("identToken and the order", () => {
  it.each(IDENT_STATUSES)("%s has its token, a name and a hint", (s) => {
    expect(identToken(s)).toBe(tokens.ident[s]);
    inBoth(IDENT_STATUS_KEYS[s]);
    inBoth(IDENT_STATUS_HINT_KEYS[s]);
  });

  it("no identification is the grey of none, not a status's colour", () => {
    expect(identToken(null)).toBe(tokens.identNone);
    for (const s of IDENT_STATUSES)
      expect(identToken(s)).not.toBe(tokens.identNone);
    inBoth(IDENT_STATUS_KEYS.none);
  });

  it("lists every status once and none last, registered first", () => {
    expect([...identOrder()].sort()).toEqual(
      [...IDENT_STATUSES, "none"].sort(),
    );
    expect(identOrder()[0]).toBe("registered");
    expect(identOrder().at(-1)).toBe("none");
    expect(identOrder()).toBe(IDENT_ORDER);
  });

  it("lists the statuses needing attention after the others (G-03)", () => {
    const statuses = identOrder().filter((s) => s !== "none");
    const flags = statuses.map((s) => needsAttention(s));
    expect(flags).toEqual([...flags].sort((a, b) => Number(a) - Number(b)));
  });
});

describe("needsAttention", () => {
  it("is exactly unknown_operator and unidentified (core IncidentStatus)", () => {
    expect(IDENT_STATUSES.filter((s) => needsAttention(s))).toEqual([
      "unknown_operator",
      "unidentified",
    ]);
  });

  it("is false for registered, suspended and no block (the twins)", () => {
    expect(needsAttention("registered")).toBe(false);
    expect(needsAttention("suspended")).toBe(false);
    expect(needsAttention(null)).toBe(false);
  });
});

describe("identDrawn (G-02: never upgrade)", () => {
  it("no block draws as none", () => {
    expect(identDrawn(null)).toBe("none");
  });

  it.each(IDENT_STATUSES)("%s without a mismatch draws as given", (status) => {
    expect(identDrawn(ident({ status }))).toBe(status);
  });

  it("registered with a mismatch never draws as registered", () => {
    expect(identDrawn(ident({ status: "registered", mismatch: true }))).toBe(
      "unknown_operator",
    );
  });

  it("suspended with a mismatch stays suspended (G-01: suspension outranks)", () => {
    expect(identDrawn(ident({ status: "suspended", mismatch: true }))).toBe(
      "suspended",
    );
  });
});

describe("identMark (a cue beside colour)", () => {
  it("registered alone has no mark; every other status has its own", () => {
    expect(identMark("registered")).toBe("");
    const others = IDENT_ORDER.filter((s) => s !== "registered").map(identMark);
    expect(others.every((m) => m !== "")).toBe(true);
    expect(new Set(others).size).toBe(others.length);
  });

  it("every mark is in the basemap's Latin or punctuation glyph range", () => {
    for (const s of IDENT_ORDER) {
      for (const ch of identMark(s)) {
        const cp = ch.codePointAt(0) ?? 0;
        expect(cp <= 0xff || (cp >= 0x2000 && cp <= 0x206f), s).toBe(true);
      }
    }
  });
});

describe("identHintKey", () => {
  it("is total over every status, reason, basis and mismatch, with keys in both catalogues", () => {
    let n = 0;
    for (const status of IDENT_STATUSES) {
      for (const reason of IDENT_REASONS) {
        for (const basis of IDENT_BASES) {
          for (const mismatch of [false, true]) {
            const h = identHintKey(status, reason, basis, mismatch);
            inBoth(h.status);
            inBoth(h.reason);
            if (h.caveat !== null) inBoth(h.caveat);
            if (h.mismatch !== null) inBoth(h.mismatch);
            n += 1;
          }
        }
      }
    }
    expect(n).toBe(
      IDENT_STATUSES.length * IDENT_REASONS.length * IDENT_BASES.length * 2,
    );
  });

  it("every reason has its own text", () => {
    const keys = IDENT_REASONS.map(
      (r) => identHintKey("registered", r, "authenticated").reason,
    );
    expect(new Set(keys).size).toBe(IDENT_REASONS.length);
  });

  it("registered + as_broadcast says 'as broadcast and unverified' (R-05)", () => {
    const h = identHintKey("registered", "matched", "as_broadcast");
    expect(h.caveat).toBe("ident.registered_as_broadcast");
    expect(en[h.caveat as Key]).toContain("as broadcast and unverified");
    expect(ka[h.caveat as Key]).toMatch(UNVERIFIED.ka);
  });

  it("registered + provider says the provider caveat (PLAN §14 Q18)", () => {
    const h = identHintKey("registered", "matched", "provider");
    expect(h.caveat).toBe("ident.caveat.provider");
    expect(en[h.caveat as Key]).toMatch(UNVERIFIED.en);
    expect(ka[h.caveat as Key]).toMatch(UNVERIFIED.ka);
  });

  it("registered + authenticated carries neither caveat", () => {
    const h = identHintKey("registered", "session_binding", "authenticated");
    expect(h.caveat).toBeNull();
  });

  it("every status on a non-authenticated basis says unverified", () => {
    for (const status of IDENT_STATUSES) {
      for (const basis of ["as_broadcast", "provider"] as const) {
        const k = identHintKey(status, "no_serial", basis).caveat;
        expect(k, `${status}/${basis}`).not.toBeNull();
        expect(en[k as Key]).toMatch(UNVERIFIED.en);
        expect(ka[k as Key]).toMatch(UNVERIFIED.ka);
      }
    }
  });

  it("mismatch: true yields the mismatch line whatever the status", () => {
    for (const status of IDENT_STATUSES) {
      expect(
        identHintKey(status, "operator_mismatch", "as_broadcast", true)
          .mismatch,
      ).toBe("ident.mismatch");
    }
  });

  it("mismatch: false yields no mismatch line (the twin)", () => {
    for (const status of IDENT_STATUSES) {
      expect(
        identHintKey(status, "matched", "as_broadcast").mismatch,
      ).toBeNull();
    }
  });

  it("every basis has a name in both catalogues", () => {
    for (const b of IDENT_BASES) inBoth(IDENT_BASIS_KEYS[b]);
  });
});

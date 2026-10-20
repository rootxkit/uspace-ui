// Identification symbology (WP-7; spec 04 §3.2; LESSONS G-01, G-02,
// G-03, G-13, R-05; PLAN §14 Q18): total over every status, reason and
// basis, the legend order, the caveat triple, the mismatch line whatever
// the status, and a block that was not judged drawn as pending, each with
// its twin (E-01).
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
  IDENT_PENDING_KEYS,
  IDENT_STATUS_HINT_KEYS,
  IDENT_STATUS_KEYS,
  identDrawn,
  identHintKey,
  identKeyNeedsAttention,
  identKeyToken,
  identMark,
  identOrder,
  identToken,
  isJudged,
  needsAttention,
  unjudgedReason,
  type UnjudgedReason,
} from "./ident.js";

/** core v1.8.0 `IdentReason.Judged()` false (core/ident.go). */
const UNJUDGED: readonly UnjudgedReason[] = [
  "registry_unavailable",
  "details_unavailable",
];

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

  it("lists every status once, then pending, then none; registered first", () => {
    expect([...identOrder()].sort()).toEqual(
      [...IDENT_STATUSES, "pending", "none"].sort(),
    );
    expect(identOrder()[0]).toBe("registered");
    expect(identOrder().slice(-2)).toEqual(["pending", "none"]);
    expect(identOrder()).toBe(IDENT_ORDER);
  });

  it("lists the statuses needing attention after the expected ones (G-03)", () => {
    const statuses = identOrder().filter(
      (s) => s !== "none" && s !== "pending",
    );
    const flags = statuses.map((s) => identKeyNeedsAttention(s));
    expect(flags).toEqual([...flags].sort((a, b) => Number(a) - Number(b)));
    expect(flags).toContain(true);
  });
});

describe("identKeyToken (every drawn key, pending included)", () => {
  it("pending has its own muted token, apart from none and every status", () => {
    expect(identKeyToken("pending")).toBe(tokens.identPending);
    expect(tokens.identPending).toBe("--us-ident-pending");
    expect(identKeyToken("pending")).not.toBe(tokens.identNone);
    for (const s of IDENT_STATUSES)
      expect(identKeyToken("pending")).not.toBe(tokens.ident[s]);
    inBoth(IDENT_STATUS_KEYS.pending);
    inBoth(IDENT_STATUS_HINT_KEYS.pending);
  });

  it("none and the statuses keep identToken's tokens (the twins)", () => {
    expect(identKeyToken("none")).toBe(identToken(null));
    for (const s of IDENT_STATUSES)
      expect(identKeyToken(s)).toBe(identToken(s));
  });
});

describe("isJudged (core v1.8.0 Judged(), 04 §3.2, G-13)", () => {
  it("details_unavailable and registry_unavailable are not judged", () => {
    expect(IDENT_REASONS.filter((r) => unjudgedReason(r) !== null)).toEqual(
      UNJUDGED,
    );
    for (const r of UNJUDGED) {
      expect(unjudgedReason(r)).toBe(r);
      for (const status of IDENT_STATUSES)
        expect(isJudged(ident({ status, reason: r })), `${status}/${r}`).toBe(
          false,
        );
    }
  });

  it("every other reason is judged, whatever the status (the twin)", () => {
    const judged = IDENT_REASONS.filter(
      (r) => !(UNJUDGED as readonly string[]).includes(r),
    );
    expect(judged).toHaveLength(IDENT_REASONS.length - UNJUDGED.length);
    for (const r of judged) {
      expect(unjudgedReason(r), r).toBeNull();
      for (const status of IDENT_STATUSES)
        expect(isJudged(ident({ status, reason: r })), `${status}/${r}`).toBe(
          true,
        );
    }
  });

  it("no block is not judged (core: a nil identification is not)", () => {
    expect(isJudged(null)).toBe(false);
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

// What an app counts: the drawn key's flag (identKeyNeedsAttention of
// identDrawn), so a block that was not judged is never an attention row.
const attention = (i: Identification | null): boolean =>
  identKeyNeedsAttention(identDrawn(i));

describe("identKeyNeedsAttention of identDrawn (judged first)", () => {
  it("a judged unidentified or unknown operator needs attention", () => {
    for (const reason of ["no_serial", "serial_unknown"] as const)
      expect(attention(ident({ status: "unidentified", reason })), reason).toBe(
        true,
      );
    expect(
      attention(
        ident({ status: "unknown_operator", reason: "serial_unknown" }),
      ),
    ).toBe(true);
    expect(identKeyNeedsAttention("unidentified")).toBe(true);
    expect(identKeyNeedsAttention("unknown_operator")).toBe(true);
  });

  it("a block that was not judged never does, whatever its status (the twin)", () => {
    for (const reason of UNJUDGED)
      for (const status of IDENT_STATUSES)
        expect(
          attention(ident({ status, reason })),
          `${status}/${reason}`,
        ).toBe(false);
    expect(identKeyNeedsAttention("pending")).toBe(false);
    expect(identKeyNeedsAttention("none")).toBe(false);
    expect(attention(null)).toBe(false);
  });
});

describe("identDrawn (G-02: never upgrade)", () => {
  it("no block draws as none", () => {
    expect(identDrawn(null)).toBe("none");
  });

  it.each(IDENT_STATUSES)("%s without a mismatch draws as given", (status) => {
    expect(identDrawn(ident({ status }))).toBe(status);
  });

  it.each(UNJUDGED)(
    "%s draws as pending, whatever the status or mismatch (G-13)",
    (reason) => {
      for (const status of IDENT_STATUSES)
        for (const mismatch of [false, true])
          expect(
            identDrawn(ident({ status, reason, mismatch })),
            `${status}/${String(mismatch)}`,
          ).toBe("pending");
      // The case the staging finding was about: no serial, no operator.
      expect(
        identDrawn(
          ident({
            status: "unidentified",
            reason,
            serial: null,
            operatorReg: null,
            basis: "provider",
          }),
        ),
      ).toBe("pending");
    },
  );

  it.each(["no_serial", "serial_unknown"] as const)(
    "judged unidentified (%s) still draws as unidentified (the presence twin)",
    (reason) => {
      expect(
        identDrawn(
          ident({
            status: "unidentified",
            reason,
            serial: null,
            operatorReg: null,
          }),
        ),
      ).toBe("unidentified");
    },
  );

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

  it("pending has the ellipsis, unidentified keeps the cross", () => {
    expect(identMark("pending")).toBe("…");
    expect(identMark("unidentified")).toBe("×");
    expect(identMark("none")).toBe("–");
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

  it.each(UNJUDGED)(
    "%s gives the pending hint naming its input, never unidentified's (G-13)",
    (reason) => {
      for (const status of IDENT_STATUSES) {
        const h = identHintKey(status, reason, "provider");
        expect(h.status, status).toBe(IDENT_PENDING_KEYS[reason].hint);
        expect(h.status).not.toBe(IDENT_STATUS_HINT_KEYS.unidentified);
        expect(h.reason).toBe(`ident.reason.${reason}`);
      }
      inBoth(IDENT_PENDING_KEYS[reason].hint);
      inBoth(IDENT_PENDING_KEYS[reason].short);
    },
  );

  it("names the missing input in each pending hint", () => {
    const d = IDENT_PENDING_KEYS.details_unavailable;
    const r = IDENT_PENDING_KEYS.registry_unavailable;
    expect(en[d.hint]).toMatch(/details have not been fetched/);
    expect(en[d.short]).toBe("pending: details not yet fetched");
    expect(en[r.hint]).toMatch(/registry could not be reached/);
    expect(en[r.short]).toBe("pending: registry unreachable");
    expect(ka[d.short]).toMatch(/^მოლოდინში: /);
    expect(ka[r.short]).toMatch(/^მოლოდინში: /);
    for (const k of [d.hint, d.short, r.hint, r.short])
      expect(en[k]).not.toMatch(/unidentified|lost|alarm/i);
  });

  it("judged unidentified keeps its hint (the presence twin)", () => {
    for (const reason of ["no_serial", "serial_unknown"] as const)
      expect(identHintKey("unidentified", reason, "as_broadcast").status).toBe(
        "ident.hint.unidentified",
      );
  });

  it("a registered block that was not judged never says 'registered, as broadcast'", () => {
    for (const reason of UNJUDGED)
      expect(identHintKey("registered", reason, "as_broadcast").caveat).toBe(
        "ident.caveat.as_broadcast",
      );
  });

  it("every basis has a name in both catalogues", () => {
    for (const b of IDENT_BASES) inBoth(IDENT_BASIS_KEYS[b]);
  });
});

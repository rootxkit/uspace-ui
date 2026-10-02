// Age buckets (WP-7, PLAN §3.8): the thirds rule at its boundaries with a
// chosen `staleAfterS`, every bucket hit, and no default threshold: a
// threshold that is not a positive number buckets nothing as live.
import { describe, expect, it } from "vitest";

import { en } from "../i18n/en.js";
import { ka } from "../i18n/ka.js";
import { AGE_BUCKETS, tokens } from "../theme/tokens.js";
import { AGE_BUCKET_KEYS, ageBucket, ageOpacity, ageToken } from "./age.js";

// A chosen policy value for the test, not a default of the kit.
const STALE_AFTER_S = 30;

describe("ageBucket", () => {
  it.each([
    [0, "live"],
    [9.999, "live"],
    [10, "aging"],
    [29.999, "aging"],
    [30, "stale"],
    [86_400, "stale"],
  ] as const)("%s s of %s s is %s", (ageS, bucket) => {
    expect(ageBucket(ageS, STALE_AFTER_S)).toBe(bucket);
  });

  it("puts the thirds boundary where a third falls, not on a whole second", () => {
    expect(ageBucket(6.66, 20)).toBe("live");
    expect(ageBucket(6.67, 20)).toBe("aging");
  });

  it("an unknown age is unknown, never live", () => {
    expect(ageBucket(null, STALE_AFTER_S)).toBe("unknown");
    expect(ageBucket(Number.NaN, STALE_AFTER_S)).toBe("unknown");
    expect(ageBucket(Number.POSITIVE_INFINITY, STALE_AFTER_S)).toBe("unknown");
  });

  it("without a usable threshold nothing is bucketed (no default, INV-03)", () => {
    for (const s of [0, -30, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(ageBucket(0, s)).toBe("unknown");
      expect(ageBucket(1000, s)).toBe("unknown");
    }
  });

  it("a negative age (the browser clock stepped back) is live, not unknown", () => {
    expect(ageBucket(-2, STALE_AFTER_S)).toBe("live");
  });

  it("hits every bucket", () => {
    const hit = new Set(
      [0, 15, 45, null].map((a) => ageBucket(a, STALE_AFTER_S)),
    );
    expect([...hit].sort()).toEqual([...AGE_BUCKETS].sort());
  });
});

describe("bucket symbology", () => {
  it.each(AGE_BUCKETS.map((b, i) => [b, i] as const))(
    "%s has the token of tokens.age and a name in both catalogues",
    (b, i) => {
      expect(ageToken(b)).toBe(tokens.age[i]);
      expect(en[AGE_BUCKET_KEYS[b]]).not.toBe("");
      expect(ka[AGE_BUCKET_KEYS[b]]).not.toBe("");
    },
  );

  it("fades with age: live full, aging less, stale least", () => {
    expect(ageOpacity("live")).toBe(1);
    expect(ageOpacity("aging")).toBeLessThan(ageOpacity("live"));
    expect(ageOpacity("stale")).toBeLessThan(ageOpacity("aging"));
    expect(ageOpacity("stale")).toBeGreaterThan(0);
  });

  it("an unknown age is drawn in full, not dimmed as if known to be old (rule 6)", () => {
    expect(ageOpacity("unknown")).toBe(1);
  });
});

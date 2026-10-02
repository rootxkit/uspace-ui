// freshnessOf (docs/PLAN.md §3.7; 02 F3, F5; M15): the ETag header and the
// body fields the app points at, nothing guessed, an absent field null.
import { describe, expect, it } from "vitest";

import { DEFAULT_FRESHNESS_PICK, freshnessOf } from "./freshness.js";

function res(headers: Record<string, string> = {}): Response {
  return new Response(null, { headers });
}

const NONE = {
  etag: null,
  version: null,
  updatedAt: null,
  ageS: null,
  stale: false,
};

const CISP_BODY = {
  cis_dataset: "zones",
  cis_version: 42,
  cis_updated_at: "2026-10-02T09:59:00Z",
  cis_age_s: 60,
  features: [],
};

describe("freshnessOf", () => {
  it("reads the ETag header alone", () => {
    expect(freshnessOf(res({ ETag: '"42"' }), {})).toEqual({
      ...NONE,
      etag: '"42"',
    });
  });

  it("reads the body alone with the default CISP pick (cis_updated_at)", () => {
    expect(freshnessOf(res(), CISP_BODY)).toEqual({
      etag: null,
      version: "42",
      updatedAt: "2026-10-02T09:59:00Z",
      ageS: 60,
      stale: false,
    });
  });

  it("reads both", () => {
    expect(
      freshnessOf(res({ ETag: 'W/"42"' }), {
        ...CISP_BODY,
        cis_version: "v42",
      }),
    ).toEqual({
      etag: 'W/"42"',
      version: "v42",
      updatedAt: "2026-10-02T09:59:00Z",
      ageS: 60,
      stale: false,
    });
  });

  it("reads neither: every field null and not stale", () => {
    expect(freshnessOf(res(), {})).toEqual(NONE);
    expect(freshnessOf(res(), null)).toEqual(NONE);
    expect(freshnessOf(res(), "text")).toEqual(NONE);
  });

  it("marks stale on a stale: true marker (02 F5), and only on true", () => {
    expect(freshnessOf(res(), { ...CISP_BODY, stale: true }).stale).toBe(true);
    expect(freshnessOf(res(), { ...CISP_BODY, stale: false }).stale).toBe(
      false,
    );
    expect(freshnessOf(res(), { ...CISP_BODY, stale: "true" }).stale).toBe(
      false,
    );
  });

  it("follows a dotted path into metadata.issued (the authority's export)", () => {
    const body = {
      metadata: { issued: "2026-10-01T08:00:00Z", provider: "TEST" },
      features: [],
    };
    expect(freshnessOf(res(), body, { updatedAt: "metadata.issued" })).toEqual({
      ...NONE,
      updatedAt: "2026-10-01T08:00:00Z",
    });
  });

  it("gives null, never 0 or an empty string, for a pick at an absent field", () => {
    const f = freshnessOf(
      res(),
      {},
      { version: "v", updatedAt: "metadata.issued", ageS: "age_s" },
    );
    expect(f.version).toBeNull();
    expect(f.updatedAt).toBeNull();
    expect(f.ageS).toBeNull();
    // A path through a value that is not an object stops there.
    expect(
      freshnessOf(res(), { metadata: "x" }, { updatedAt: "metadata.issued" })
        .updatedAt,
    ).toBeNull();
    expect(
      freshnessOf(res(), { metadata: ["x"] }, { updatedAt: "metadata.0" })
        .updatedAt,
    ).toBeNull();
  });

  it("gives null for a field of the wrong type", () => {
    const f = freshnessOf(res(), {
      cis_version: { v: 1 },
      cis_updated_at: 1696240000,
      cis_age_s: "60",
    });
    expect(f).toEqual(NONE);
    expect(
      freshnessOf(res(), {
        cis_version: Number.NaN,
        cis_age_s: Number.POSITIVE_INFINITY,
      }),
    ).toEqual(NONE);
  });

  it("does not read a field it was not pointed at", () => {
    const f = freshnessOf(res(), CISP_BODY, { updatedAt: "cis_updated_at" });
    expect(f).toEqual({ ...NONE, updatedAt: "2026-10-02T09:59:00Z" });
  });

  it("reads own members only, never the prototype", () => {
    expect(
      freshnessOf(res(), {}, { version: "constructor.name" }).version,
    ).toBeNull();
  });

  it("keeps a zero age as zero: a value the API sent is not an absence", () => {
    expect(freshnessOf(res(), { ...CISP_BODY, cis_age_s: 0 }).ageS).toBe(0);
  });

  it("names the CISP members as its default pick", () => {
    expect(DEFAULT_FRESHNESS_PICK).toEqual({
      version: "cis_version",
      ageS: "cis_age_s",
      stale: "stale",
      updatedAt: "cis_updated_at",
    });
  });
});

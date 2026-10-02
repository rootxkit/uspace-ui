// The table state in the URL (PLAN §3.14, §7; spec 06 §5): the PII
// deny-list pinned, a PII filter never written and never read back, the
// non-PII twin written, malformed state ignored and counted, and a round
// trip that keeps the other search parameters.
import { afterEach, describe, expect, it } from "vitest";

import { resetTableCountersForTests, tableCounters } from "./counters.js";
import {
  DEFAULT_PAGE_SIZE,
  PII_FILTER_DENY_LIST,
  checkStateKey,
  initialTableState,
  isPiiColumn,
  readTableState,
  writeTableState,
  type TableState,
} from "./state.js";

afterEach(() => {
  resetTableCountersForTests();
});

const base = initialTableState();

describe("the PII deny-list", () => {
  it("is exactly the list of the brief", () => {
    expect([...PII_FILTER_DENY_LIST]).toEqual([
      "name",
      "legal_name",
      "email",
      "phone",
      "address",
      "date_of_birth",
      "person_ref",
      "reporter",
    ]);
    expect(Object.isFrozen(PII_FILTER_DENY_LIST)).toBe(true);
  });

  it.each(PII_FILTER_DENY_LIST)("%s is PII", (id) => {
    expect(isPiiColumn(id)).toBe(true);
  });

  it.each([
    "legalName",
    "dateOfBirth",
    "operator.email",
    "operatorEmail",
    "contact-phone",
    "person.ref",
    "pilot_legal_name",
    "Reporter",
  ])("%s, a spelling of a PII column, is PII", (id) => {
    expect(isPiiColumn(id)).toBe(true);
  });

  it.each([
    "status",
    "registration_number",
    "serial",
    "severity",
    "updatedAt",
    "names_count_x",
  ])("%s is not PII (the twin)", (id) => {
    expect(isPiiColumn(id)).toBe(false);
  });
});

describe("writeTableState", () => {
  const state: TableState = {
    sorting: [
      { id: "updatedAt", desc: true },
      { id: "status", desc: false },
    ],
    columnFilters: [
      { id: "status", value: "active" },
      { id: "email", value: "pilot@example.test" },
      { id: "legalName", value: "TEST Operator" },
      { id: "flags", value: ["a", "b"] },
    ],
    pagination: { pageIndex: 2, pageSize: 50 },
    columnVisibility: { serial: false, status: true },
  };

  it("writes sort, page, size, hidden columns and a non-PII filter", () => {
    const out = writeTableState(new URLSearchParams(), "reg", state);
    expect(out.get("reg.sort")).toBe("updatedAt:desc,status:asc");
    expect(out.get("reg.filter.status")).toBe("active");
    expect(out.get("reg.page")).toBe("3");
    expect(out.get("reg.size")).toBe("50");
    expect(out.get("reg.hidden")).toBe("serial");
  });

  it("never writes a PII filter, and counts each one kept in memory", () => {
    const out = writeTableState(new URLSearchParams(), "reg", state);
    const text = out.toString();
    expect(text).not.toMatch(/email|legalName|example\.test|TEST\+Operator/);
    expect(tableCounters().pii_filter_in_memory).toBe(2);
  });

  it("leaves a non-string filter in memory and defaults out of the URL", () => {
    const out = writeTableState(new URLSearchParams(), "reg", base);
    expect(out.toString()).toBe("");
    expect(
      writeTableState(new URLSearchParams(), "reg", state).has(
        "reg.filter.flags",
      ),
    ).toBe(false);
  });

  it("keeps other parameters and replaces only its own prefix", () => {
    const params = new URLSearchParams(
      "tab=2&reg.page=9&other.page=4&reg.filter.old=x",
    );
    const out = writeTableState(params, "reg", base);
    expect(out.toString()).toBe("tab=2&other.page=4");
  });
});

describe("readTableState", () => {
  it("round-trips what it wrote, without the PII filters", () => {
    const state: TableState = {
      sorting: [{ id: "status", desc: true }],
      columnFilters: [
        { id: "status", value: "suspended" },
        { id: "email", value: "x@example.test" },
      ],
      pagination: { pageIndex: 1, pageSize: 10 },
      columnVisibility: { serial: false },
    };
    const read = readTableState(
      writeTableState(new URLSearchParams(), "reg", state),
      "reg",
      base,
    );
    expect(read).toEqual({
      ...state,
      columnFilters: [{ id: "status", value: "suspended" }],
    });
  });

  it("refuses a PII filter found in a URL and counts it; applies the non-PII twin", () => {
    const read = readTableState(
      new URLSearchParams(
        "reg.filter.email=a%40example.test&reg.filter.status=active",
      ),
      "reg",
      base,
    );
    expect(read.columnFilters).toEqual([{ id: "status", value: "active" }]);
    expect(tableCounters().url_pii_refused).toBe(1);
    expect(tableCounters().url_state_malformed).toBe(0);
  });

  it("ignores and counts malformed entries, keeping the base state", () => {
    const read = readTableState(
      new URLSearchParams(
        "reg.page=abc&reg.size=0&reg.size=5000&reg.sort=status:sideways&reg.filter.status=&reg.bogus=1&reg.filter.=x",
      ),
      "reg",
      base,
    );
    expect(read).toEqual(base);
    expect(tableCounters().url_state_malformed).toBe(7);
  });

  it("reads only its own key", () => {
    const read = readTableState(
      new URLSearchParams("other.sort=a:asc&regx.page=2"),
      "reg",
      base,
    );
    expect(read).toEqual(base);
    expect(tableCounters().url_state_malformed).toBe(0);
  });

  it("drops a repeated sort column and keeps the first", () => {
    const read = readTableState(
      new URLSearchParams("reg.sort=a:asc,a:desc,b:desc"),
      "reg",
      base,
    );
    expect(read.sorting).toEqual([
      { id: "a", desc: false },
      { id: "b", desc: true },
    ]);
  });

  it("has a default page size", () => {
    expect(base.pagination).toEqual({
      pageIndex: 0,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });
});

describe("checkStateKey", () => {
  it("accepts a plain key and refuses one that would blur the prefix", () => {
    expect(() => {
      checkStateKey("registry_1");
    }).not.toThrow();
    for (const bad of ["", "1reg", "reg.x", "a b", "reg="])
      expect(() => {
        checkStateKey(bad);
      }).toThrow(/table state key/);
  });
});

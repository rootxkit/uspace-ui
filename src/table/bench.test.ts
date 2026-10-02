// Benchmark (PLAN §8: sort of 10 000 rows <= 50 ms): the sorted row model
// of 10 000 registry rows through the kit's column helpers, by a number
// with nulls, by a time and by an enumeration. Reported, not gated (PLAN
// §9); the test checks the order is right.
import { appendFileSync } from "node:fs";
import {
  createTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type TableState as TanState,
} from "@tanstack/react-table";
import { expect, it } from "vitest";

import { UNIT_KEYS, columnsFor } from "./columns.js";
import {
  REG_STATUSES,
  registrationRows,
  type RegistrationRow,
} from "./fixtures.testing.js";

const ROWS = 10_000;
const BUDGET_MS = 50;

const c = columnsFor<RegistrationRow>();
const columns = [
  c.num("maxAltAmslM", UNIT_KEYS.m_amsl, 0),
  c.utc("updatedAt"),
  c.enum("status", "reg.status", { values: REG_STATUSES }),
];

// `ms` is the first sort of a fresh table (it also reads every row's
// value once); `resortMs` is the next click, the direction flipped, with
// the values cached.
function sortedBy(sorting: SortingState): {
  ms: number;
  resortMs: number;
  values: unknown[];
} {
  const data = registrationRows(ROWS);
  let state = { sorting } as Partial<TanState> as TanState;
  const table = createTable<RegistrationRow>({
    data,
    columns,
    state,
    onStateChange: (u) => {
      state = typeof u === "function" ? u(state) : u;
    },
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    sortDescFirst: false,
  });
  table.getCoreRowModel();
  const t0 = performance.now();
  const rows = table.getSortedRowModel().rows;
  const ms = performance.now() - t0;
  const id = sorting[0]?.id ?? "";
  const values = rows.map((r) => r.getValue(id));
  table.setOptions((prev) => ({
    ...prev,
    state: {
      ...prev.state,
      sorting: sorting.map((x) => ({ ...x, desc: !x.desc })),
    },
  }));
  const t1 = performance.now();
  table.getSortedRowModel();
  const resortMs = performance.now() - t1;
  return { ms, resortMs, values };
}

it(`sorts ${ROWS} rows and reports the time`, () => {
  const results = [
    ["altitude ascending", sortedBy([{ id: "maxAltAmslM", desc: false }])],
    ["altitude descending", sortedBy([{ id: "maxAltAmslM", desc: true }])],
    ["time descending", sortedBy([{ id: "updatedAt", desc: true }])],
    ["status ascending", sortedBy([{ id: "status", desc: false }])],
  ] as const;
  const line = `table bench: sort of ${ROWS} rows (budget ${BUDGET_MS} ms): ${results
    .map(
      ([name, r]) =>
        `${name} ${r.ms.toFixed(1)} ms (re-sort ${r.resortMs.toFixed(1)} ms)`,
    )
    .join(", ")}`;
  process.stdout.write(`${line}\n`);
  const summary = process.env["GITHUB_STEP_SUMMARY"];
  if (summary !== undefined && summary !== "")
    appendFileSync(summary, `${line}\n`);

  const asc = results[0][1].values;
  const known = asc.filter((v): v is number => typeof v === "number");
  expect(known).toEqual([...known].sort((a, b) => a - b));
  // Every unknown altitude is at the end, in both directions.
  expect(asc.slice(known.length).every((v) => v === undefined)).toBe(true);
  const desc = results[1][1].values;
  const knownDesc = desc.filter((v): v is number => typeof v === "number");
  expect(knownDesc).toEqual([...known].reverse());
  expect(desc.slice(knownDesc.length).every((v) => v === undefined)).toBe(true);
  for (const [, r] of results) {
    expect(Number.isFinite(r.ms)).toBe(true);
    expect(Number.isFinite(r.resortMs)).toBe(true);
  }
});

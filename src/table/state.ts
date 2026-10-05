// The state of a DataTable (docs/PLAN.md §3.14) and its form in the URL.
//
// A view is shareable, so sorting, filters, the page and the hidden
// columns go into the search parameters under `<key>.*`. A filter value in
// a URL is a value in a browser history, a proxy log and a screenshot
// (spec 06 §5), so a filter on a column named like personal data is kept
// in memory only: it still filters, and it never reaches the URL. The
// deny-list is exported and pinned by a test.
import type {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";

import { countTable } from "./counters.js";

/** @public */
export interface TableState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  pagination: { pageIndex: number; pageSize: number };
  columnVisibility: VisibilityState;
}

/**
 * Rows per page when the app gives none. A display-only constant.
 *
 * @beta
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * The page sizes the footer offers. Display-only constants.
 *
 * @beta
 */
export const PAGE_SIZES: readonly number[] = Object.freeze([10, 25, 50, 100]);

/**
 * The largest page size a URL may ask for; larger is malformed.
 *
 * @beta
 */
export const MAX_PAGE_SIZE = 1000;

/** @beta */
export function initialTableState(
  pageSize: number = DEFAULT_PAGE_SIZE,
): TableState {
  return {
    sorting: [],
    columnFilters: [],
    pagination: { pageIndex: 0, pageSize },
    columnVisibility: {},
  };
}

/**
 * Column ids whose filter values are personal data (spec 06 §5): the
 * registry's people, their contacts and an incident's reporter. Matched on
 * the last words of a column id in any of `snake_case`, `camelCase`,
 * `kebab-case` or a dotted path (`operator.email`, `contactPhone`,
 * `dateOfBirth`), so a column named for its owner is caught too. A
 * non-personal column that ends in `name` (a zone's name) is kept in
 * memory as well: over-matching costs a shareable link, under-matching a
 * leak.
 *
 * @beta
 */
export const PII_FILTER_DENY_LIST: readonly string[] = Object.freeze([
  "name",
  "legal_name",
  "email",
  "phone",
  "address",
  "date_of_birth",
  "person_ref",
  "reporter",
]);

function words(id: string): string[] {
  return id
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== "");
}

/**
 * True when a filter on column `id` must never be written to a URL.
 *
 * @beta
 */
export function isPiiColumn(id: string): boolean {
  const w = words(id);
  for (let n = 1; n <= 3 && n <= w.length; n++) {
    if (PII_FILTER_DENY_LIST.includes(w.slice(-n).join("_"))) return true;
  }
  return false;
}

const KEY = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Throws on a key that cannot prefix search parameters unambiguously. */
export function checkStateKey(key: string): void {
  if (!KEY.test(key))
    throw new Error(
      `table state key ${JSON.stringify(key)}: use letters, digits, "_" or "-", starting with a letter`,
    );
}

const POSITIVE_INT = /^[1-9]\d{0,6}$/;

function splitList(v: string): string[] {
  return v.split(",").filter((s) => s !== "");
}

/**
 * The table state in `params` under `<key>.*`, over `base`. Every value
 * that does not parse is ignored and counted (`url_state_malformed`), and
 * a filter on a PII column is dropped and counted (`url_pii_refused`):
 * whoever wrote it, it is not applied from a URL.
 *
 * @beta
 */
export function readTableState(
  params: URLSearchParams,
  key: string,
  base: TableState,
): TableState {
  const prefix = `${key}.`;
  const state: TableState = {
    sorting: base.sorting,
    columnFilters: base.columnFilters,
    pagination: { ...base.pagination },
    columnVisibility: base.columnVisibility,
  };
  const filters: ColumnFiltersState = [];
  for (const [name, value] of params) {
    if (!name.startsWith(prefix)) continue;
    const field = name.slice(prefix.length);
    if (field === "sort") {
      const sorting: SortingState = [];
      let ok = true;
      for (const part of splitList(value)) {
        const at = part.lastIndexOf(":");
        const id = part.slice(0, at);
        const dir = part.slice(at + 1);
        if (at <= 0 || (dir !== "asc" && dir !== "desc")) ok = false;
        else if (!sorting.some((s) => s.id === id))
          sorting.push({ id, desc: dir === "desc" });
      }
      if (ok) state.sorting = sorting;
      else countTable("url_state_malformed");
    } else if (field === "page") {
      if (POSITIVE_INT.test(value))
        state.pagination.pageIndex = Number(value) - 1;
      else countTable("url_state_malformed");
    } else if (field === "size") {
      const n = Number(value);
      if (POSITIVE_INT.test(value) && n <= MAX_PAGE_SIZE)
        state.pagination.pageSize = n;
      else countTable("url_state_malformed");
    } else if (field === "hidden") {
      const hidden: VisibilityState = {};
      for (const id of splitList(value)) hidden[id] = false;
      state.columnVisibility = hidden;
    } else if (field.startsWith("filter.") && field.length > 7) {
      const id = field.slice(7);
      if (isPiiColumn(id)) countTable("url_pii_refused");
      else if (value === "") countTable("url_state_malformed");
      else filters.push({ id, value });
    } else {
      countTable("url_state_malformed");
    }
  }
  if (filters.length > 0) state.columnFilters = filters;
  return state;
}

/**
 * `params` with the `<key>.*` entries replaced by `state`. Defaults are
 * left out (page 1, the default page size, no sort), a PII filter is left
 * out, and so is a filter whose value is not a string (the URL carries
 * text; anything else stays in memory). Other parameters are untouched.
 *
 * @beta
 */
export function writeTableState(
  params: URLSearchParams,
  key: string,
  state: TableState,
  defaultPageSize: number = DEFAULT_PAGE_SIZE,
): URLSearchParams {
  const prefix = `${key}.`;
  const out = new URLSearchParams();
  for (const [name, value] of params)
    if (!name.startsWith(prefix)) out.append(name, value);
  if (state.sorting.length > 0)
    out.set(
      `${prefix}sort`,
      state.sorting.map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(","),
    );
  for (const f of state.columnFilters) {
    if (isPiiColumn(f.id)) {
      countTable("pii_filter_in_memory");
      continue;
    }
    if (typeof f.value === "string" && f.value !== "")
      out.set(`${prefix}filter.${f.id}`, f.value);
  }
  if (state.pagination.pageIndex > 0)
    out.set(`${prefix}page`, String(state.pagination.pageIndex + 1));
  if (state.pagination.pageSize !== defaultPageSize)
    out.set(`${prefix}size`, String(state.pagination.pageSize));
  const hidden = Object.entries(state.columnVisibility)
    .filter(([, visible]) => !visible)
    .map(([id]) => id);
  if (hidden.length > 0) out.set(`${prefix}hidden`, hidden.join(","));
  return out;
}

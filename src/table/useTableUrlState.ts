"use client";
// useTableUrlState (docs/PLAN.md §3.14, §7): a DataTable's state kept in
// the page's search parameters under `<key>.*`, so a view can be shared
// and survives a reload. The state the hook returns is the whole state,
// PII filters included; the URL gets everything except those (state.ts).
// The URL is rewritten with `history.replaceState`, which the Next.js App
// Router follows, so the kit needs no router of its own and adds no
// history entry per keystroke.
import { useCallback, useState } from "react";

import {
  DEFAULT_PAGE_SIZE,
  checkStateKey,
  initialTableState,
  readTableState,
  writeTableState,
  type TableState,
} from "./state.js";

/** @public */
export interface TableUrlStateOptions {
  /** Rows per page when the URL says nothing. */
  pageSize?: number;
}

function currentParams(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search);
}

/**
 * `[state, setState]` for a DataTable, read once from the URL on mount and
 * written back on every change. Malformed URL state is ignored and
 * counted, never thrown; a filter on a PII column is never written, and
 * one found in a URL is never applied.
 *
 * @public
 */
export function useTableUrlState(
  key: string,
  opts: TableUrlStateOptions = {},
): [TableState, (s: TableState) => void] {
  checkStateKey(key);
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const [state, setState] = useState<TableState>(() => {
    const base = initialTableState(pageSize);
    const params = currentParams();
    return params === null ? base : readTableState(params, key, base);
  });
  const set = useCallback(
    (next: TableState) => {
      setState(next);
      const params = currentParams();
      if (params === null) return;
      const written = writeTableState(params, key, next, pageSize).toString();
      const { pathname, hash } = window.location;
      const url = `${pathname}${written === "" ? "" : `?${written}`}${hash}`;
      window.history.replaceState(window.history.state, "", url);
    },
    [key, pageSize],
  );
  return [state, set];
}

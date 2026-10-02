"use client";
// DataTable (docs/PLAN.md §3.14, WP-9): the one table every console lists
// its registry, certificates, publications, deliveries, violations,
// intents and records with. TanStack Table is headless; the markup, the
// keyboard and the words are ours:
//
// - a native <table role="grid"> with a required caption, `aria-sort` on
//   sorted headers, `aria-rowcount`/`aria-rowindex` for paged and
//   virtualised rows, and roving tabindex (WAI-ARIA APG "Data Grid"):
//   arrows, Home/End, Ctrl+Home/End, PageUp/PageDown move focus, Enter
//   selects a row (or sorts on a header), Space toggles a checkbox cell,
//   Alt+Left/Right resizes a column;
// - sorting (multi with Shift), column filters, pagination or
//   virtualisation (automatic above VIRTUALIZE_ABOVE_ROWS rows), column
//   visibility, resizable columns, a sticky header, dense mode;
// - an empty table says why (LESSONS E-02): no rows, filtered out,
//   loading, an error with its detail and Retry-After, and the freshness
//   the API reported (an AgeChip and "as of version V").
//
// There is no export button: an export is an audited act at the API
// (spec 01 A10, F10), and a client-side one would bypass the audit
// (table/README.md).
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  useReactTable,
  type Column,
  type Header,
  type Row as TanRow,
  type RowSelectionState,
  type Updater,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import type { Freshness } from "../api/freshness.js";
import { fmtNum, fmtTimeUTC } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import type { Translate } from "../i18n/translate.js";
import type { Problem } from "../model/index.js";
import { AgeChip } from "../status/AgeChip.js";
import { Button } from "../ui/button.js";
import { Checkbox } from "../ui/checkbox.js";
import { cn } from "../ui/cn.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import { Skeleton } from "../ui/skeleton.js";
import { columnLabel, kitMetaOf, type TableColumn } from "./columns.js";
import { countTable } from "./counters.js";
import { nextGridPos, type GridPos } from "./keyboard.js";
import { PAGE_SIZES, initialTableState, type TableState } from "./state.js";

/** Above this many rows the table virtualises (PLAN §8). */
export const VIRTUALIZE_ABOVE_ROWS = 200;

/** Height of the scrolling viewport when virtualised. Display-only. */
export const VIRTUAL_VIEWPORT_PX = 480;

/** Pixels Alt+Left/Right resizes a column by. Display-only. */
export const RESIZE_STEP_PX = 16;

/** Skeleton rows while the first load runs. Display-only. */
const SKELETON_ROWS = 5;

/** Rows the virtualiser renders beyond the viewport. Display-only. */
const OVERSCAN_ROWS = 8;

// Estimated row heights for the virtualiser; measured rows replace them.
const ROW_PX = { dense: 33, normal: 41 } as const;

export interface DataTableProps<Row> {
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  /** A stable id per row: selection, focus and keys follow it. */
  getRowId(r: Row): string;
  /** What the table lists; required (a table without a name is unusable to a screen reader). */
  caption: string;
  /** Hide the caption visually; it stays the table's accessible name. */
  captionHidden?: boolean;
  /** Shown when the API returned no rows at all (not when filtered out). */
  empty: ReactNode;
  /** Controlled state (`useTableUrlState`); uncontrolled without it. */
  state?: TableState;
  onStateChange?(s: TableState): void;
  /** The row shown as selected (`aria-selected`). */
  selectedId?: string | null;
  /** Enter on a row, or a click on it. */
  onSelect?(r: Row): void;
  /** Checkbox selection by row id (`columns.select`). */
  rowSelection?: RowSelectionState;
  onRowSelectionChange?(s: RowSelectionState): void;
  /** A request is running; the first load shows skeleton rows. */
  loading?: boolean;
  /** The API's refusal, rendered with its title, detail and status. */
  error?: Problem | null;
  /** Seconds the API asked to wait (`ApiError.retryAfterS`, B-10). */
  retryAfterS?: number | null;
  /** What the API said about the freshness of the rows. */
  freshness?: Freshness | null;
  /** The policy's stale bound for the freshness chip; none, no bucket. */
  staleAfterS?: number | null;
  dense?: boolean;
  /** Force virtualisation on or off; automatic by row count otherwise. */
  virtualize?: boolean;
  /** Show the filter and column bar (default true). */
  toolbar?: boolean;
  className?: string;
}

function resolve<T>(u: Updater<T>, old: T): T {
  return typeof u === "function" ? (u as (o: T) => T)(old) : u;
}

function leafIds<Row>(defs: readonly TableColumn<Row>[]): string[] {
  const out: string[] = [];
  for (const d of defs) {
    const group = (d as { columns?: TableColumn<Row>[] }).columns;
    if (group !== undefined) {
      out.push(...leafIds(group));
      continue;
    }
    const id = d.id ?? (d as { accessorKey?: unknown }).accessorKey ?? d.header;
    if (typeof id === "string") out.push(id);
  }
  return out;
}

/** The state with every entry for an unknown column dropped and counted. */
function sanitise(state: TableState, ids: ReadonlySet<string>): TableState {
  let unknown = 0;
  const sorting = state.sorting.filter((s) => ids.has(s.id) || !++unknown);
  const columnFilters = state.columnFilters.filter(
    (f) => ids.has(f.id) || !++unknown,
  );
  const columnVisibility = Object.fromEntries(
    Object.entries(state.columnVisibility).filter(
      ([id]) => ids.has(id) || !++unknown,
    ),
  );
  if (unknown === 0) return state;
  countTable("state_unknown_column", unknown);
  return { ...state, sorting, columnFilters, columnVisibility };
}

const INTERACTIVE = "button, a, input, select, textarea, [role='checkbox']";

function SortIcon(props: { dir: false | "asc" | "desc" }) {
  const cls = "size-3.5 shrink-0";
  if (props.dir === "asc") return <ArrowUp aria-hidden className={cls} />;
  if (props.dir === "desc") return <ArrowDown aria-hidden className={cls} />;
  return <ArrowUpDown aria-hidden className={cn(cls, "opacity-50")} />;
}

function Filters<Row>(props: {
  columns: Column<Row, unknown>[];
  t: Translate;
}) {
  const { columns, t } = props;
  const base = useId();
  const filterable = columns.filter(
    (c) => c.getCanFilter() && kitMetaOf(c)?.filter !== undefined,
  );
  if (filterable.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={t("table.filters")}
      className="flex flex-wrap items-end gap-3"
      data-part="filters"
    >
      {filterable.map((c) => {
        const filter = kitMetaOf(c)?.filter;
        const id = `${base}-${c.id}`;
        const label = t("table.filter_label", { label: columnLabel(c, t) });
        const v = c.getFilterValue();
        const value = typeof v === "string" ? v : "";
        const set = (s: string) => {
          c.setFilterValue(s === "" ? undefined : s);
        };
        return (
          <div key={c.id} className="grid gap-1">
            <Label htmlFor={id} className="text-xs">
              {label}
            </Label>
            {filter?.kind === "enum" ? (
              <select
                id={id}
                value={value}
                data-filter={c.id}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                onChange={(e) => {
                  set(e.target.value);
                }}
              >
                <option value="">{t("table.filter_all")}</option>
                {filter.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={id}
                type="search"
                value={value}
                data-filter={c.id}
                className="h-9 w-44"
                onChange={(e) => {
                  set(e.target.value);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ColumnToggles<Row>(props: {
  columns: Column<Row, unknown>[];
  t: Translate;
}) {
  const { columns, t } = props;
  const hideable = columns.filter((c) => c.getCanHide());
  if (hideable.length < 2) return null;
  return (
    <details className="relative text-sm" data-part="columns">
      <summary className="cursor-pointer rounded-md border border-input px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-ring">
        {t("table.columns")}
      </summary>
      <fieldset className="absolute z-20 mt-1 grid min-w-48 gap-1 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md">
        <legend className="sr-only">{t("table.columns_legend")}</legend>
        {hideable.map((c) => (
          <label key={c.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={c.getIsVisible()}
              data-column-toggle={c.id}
              onChange={(e) => {
                c.toggleVisibility(e.target.checked);
              }}
            />
            {columnLabel(c, t)}
          </label>
        ))}
      </fieldset>
    </details>
  );
}

function ErrorNotice(props: {
  error: Problem;
  retryAfterS: number | null;
  t: Translate;
}) {
  const { error, retryAfterS, t } = props;
  return (
    <div
      role="alert"
      className="grid gap-1 rounded-md border-2 border-severity-critical p-3 text-sm"
      data-part="error"
    >
      <p className="m-0 font-medium">
        {t("table.error_title", { title: error.title, status: error.status })}
      </p>
      {error.detail !== null && <p className="m-0">{error.detail}</p>}
      {retryAfterS !== null && (
        <p className="m-0 text-muted-foreground" data-part="retry-after">
          {t("table.retry_after", { count: retryAfterS })}
        </p>
      )}
    </div>
  );
}

function FreshnessFooter(props: {
  freshness: Freshness;
  staleAfterS: number | null;
  t: Translate;
}) {
  const { freshness, staleAfterS, t } = props;
  const { lang } = useLang();
  const version = freshness.version ?? freshness.etag;
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      data-part="freshness"
      data-stale={freshness.stale ? "true" : "false"}
    >
      <AgeChip ageS={freshness.ageS} staleAfterS={staleAfterS} />
      {version !== null && (
        <span data-part="version">{t("table.as_of_version", { version })}</span>
      )}
      {freshness.updatedAt !== null && (
        <span>
          {t("table.updated_at", {
            time: fmtTimeUTC(freshness.updatedAt, lang),
          })}
        </span>
      )}
      {freshness.stale && (
        <span
          className="rounded-full border-2 border-age-stale px-2 py-0.5 font-medium text-foreground"
          data-part="stale"
        >
          {t("table.stale")}
        </span>
      )}
    </div>
  );
}

function HeaderCell<Row>(props: {
  header: Header<Row, unknown>;
  pos: GridPos;
  active: boolean;
  t: Translate;
  dense: boolean;
  multiSorted: boolean;
  allSelected: boolean | "indeterminate";
  onToggleAll(v: boolean): void;
}) {
  const {
    header,
    pos,
    active,
    t,
    dense,
    multiSorted,
    allSelected,
    onToggleAll,
  } = props;
  const column = header.column;
  const meta = kitMetaOf(column);
  const label = columnLabel(column, t);
  const sorted = column.getIsSorted();
  const canSort = column.getCanSort();
  const sortIndex = column.getSortIndex();
  const cellKey = `${pos.row}:${pos.col}`;
  const tabIndex = active ? 0 : -1;
  const isSelect = meta?.select === true;
  const focusOnCell = !canSort && !isSelect;
  return (
    <th
      scope="col"
      colSpan={header.colSpan}
      aria-sort={
        sorted === "asc"
          ? "ascending"
          : sorted === "desc"
            ? "descending"
            : canSort
              ? "none"
              : undefined
      }
      data-column={column.id}
      data-grid-cell={focusOnCell ? cellKey : undefined}
      tabIndex={focusOnCell ? tabIndex : undefined}
      style={{ width: header.getSize() }}
      className={cn(
        "sticky top-0 z-10 border-b border-border bg-background px-2 text-left align-middle font-medium whitespace-nowrap text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        dense ? "h-8" : "h-10",
        // `sticky` is also the positioning context of the resize handle.
        meta?.align === "end" && "text-right",
      )}
    >
      {isSelect ? (
        <Checkbox
          checked={allSelected}
          aria-label={t("table.select_page")}
          data-grid-cell={cellKey}
          tabIndex={tabIndex}
          onCheckedChange={(v) => {
            onToggleAll(v === true);
          }}
        />
      ) : canSort ? (
        <button
          type="button"
          data-grid-cell={cellKey}
          tabIndex={tabIndex}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
            meta?.align === "end" && "flex-row-reverse",
          )}
          onClick={column.getToggleSortingHandler()}
        >
          <span>
            {meta === undefined
              ? flexRender(column.columnDef.header, header.getContext())
              : label}
          </span>
          <SortIcon dir={sorted} />
          {sorted !== false && multiSorted && (
            // The order of a multi-column sort, for the eye; aria-sort on
            // each sorted header carries the direction.
            <span
              aria-hidden="true"
              className="text-xs text-muted-foreground"
              data-part="sort-index"
            >
              {sortIndex + 1}
            </span>
          )}
        </button>
      ) : meta === undefined ? (
        flexRender(column.columnDef.header, header.getContext())
      ) : (
        label
      )}
      {column.getCanResize() && (
        // A mouse affordance; the keyboard resizes with Alt+Left/Right on
        // the header cell (described to screen readers by the table).
        <span
          aria-hidden="true"
          data-part="resize"
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={cn(
            "absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-border",
            column.getIsResizing() && "bg-ring",
          )}
        />
      )}
    </th>
  );
}

export function DataTable<Row>(props: DataTableProps<Row>) {
  const {
    rows,
    getRowId,
    caption,
    captionHidden = false,
    empty,
    selectedId = null,
    onSelect,
    rowSelection,
    onRowSelectionChange,
    loading = false,
    error = null,
    retryAfterS = null,
    freshness = null,
    staleAfterS = null,
    dense = false,
    toolbar = true,
    className,
  } = props;
  const t = useT();
  const { lang } = useLang();
  const hintId = useId();
  const [own, setOwn] = useState<TableState>(
    () => props.state ?? initialTableState(),
  );
  const raw = props.state ?? own;
  const ids = useMemo(() => new Set(leafIds(props.columns)), [props.columns]);
  const state = useMemo(() => sanitise(raw, ids), [raw, ids]);
  const setState = (s: TableState) => {
    if (props.state === undefined) setOwn(s);
    props.onStateChange?.(s);
  };
  const firstPage = (s: TableState): TableState["pagination"] => ({
    ...s.pagination,
    pageIndex: 0,
  });
  const selectable = onRowSelectionChange !== undefined;
  const selection = rowSelection ?? {};

  // TanStack Table returns functions the React Compiler cannot memoise;
  // the kit does not run the compiler, and the table is rebuilt from
  // props on every render, so nothing stale is passed down.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<Row>({
    data: rows as Row[],
    columns: props.columns as TableColumn<Row>[],
    getRowId: (r) => getRowId(r),
    state: {
      sorting: state.sorting,
      columnFilters: state.columnFilters,
      columnVisibility: state.columnVisibility,
      rowSelection: selection,
    },
    onSortingChange: (u) => {
      setState({
        ...state,
        sorting: resolve(u, state.sorting),
        pagination: firstPage(state),
      });
    },
    onColumnFiltersChange: (u) => {
      setState({
        ...state,
        columnFilters: resolve(u, state.columnFilters),
        pagination: firstPage(state),
      });
    },
    onColumnVisibilityChange: (u) => {
      setState({
        ...state,
        columnVisibility: resolve(u, state.columnVisibility),
      });
    },
    onRowSelectionChange: (u) => {
      onRowSelectionChange?.(resolve(u, selection));
    },
    enableRowSelection: selectable,
    enableMultiSort: true,
    isMultiSortEvent: (e) => (e as { shiftKey?: boolean }).shiftKey === true,
    sortDescFirst: false,
    enableSortingRemoval: true,
    columnResizeMode: "onChange",
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const allRows = table.getRowModel().rows;
  const total = allRows.length;
  const virtual = props.virtualize ?? total > VIRTUALIZE_ABOVE_ROWS;
  const { pageSize } = state.pagination;
  const pageCount = virtual ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const pageIndex = virtual
    ? 0
    : Math.min(Math.max(0, state.pagination.pageIndex), pageCount - 1);
  const pageRows = virtual
    ? allRows
    : allRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const virtualizer = useVirtualizer({
    count: virtual ? total : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (dense ? ROW_PX.dense : ROW_PX.normal),
    overscan: OVERSCAN_ROWS,
  });

  const leafHeaders = table.getHeaderGroups().at(-1)?.headers ?? [];
  const cols = leafHeaders.length;
  const bodyCount = virtual ? total : pageRows.length;
  const [active, setActive] = useState<GridPos>({ row: 0, col: 0 });
  const pos: GridPos = {
    row: Math.min(active.row, bodyCount),
    col: Math.min(active.col, Math.max(0, cols - 1)),
  };
  const wantFocus = useRef(false);

  useEffect(() => {
    if (!wantFocus.current) return;
    const el = tableRef.current?.querySelector<HTMLElement>(
      `[data-grid-cell="${pos.row}:${pos.col}"]`,
    );
    if (el === null || el === undefined) return;
    wantFocus.current = false;
    el.focus();
  });

  const bodyRowAt = (gridRow: number): TanRow<Row> | undefined =>
    virtual ? allRows[gridRow - 1] : pageRows[gridRow - 1];

  const moveTo = (next: GridPos) => {
    setActive(next);
    wantFocus.current = true;
    if (virtual && next.row >= 1) virtualizer.scrollToIndex(next.row - 1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-grid-cell]",
    );
    if (target === null) return;
    const header = leafHeaders[pos.col];
    if (
      e.altKey &&
      pos.row === 0 &&
      header !== undefined &&
      header.column.getCanResize() &&
      (e.key === "ArrowLeft" || e.key === "ArrowRight")
    ) {
      e.preventDefault();
      const column = header.column;
      const by = e.key === "ArrowLeft" ? -RESIZE_STEP_PX : RESIZE_STEP_PX;
      const min = column.columnDef.minSize ?? 20;
      table.setColumnSizing((old) => ({
        ...old,
        [column.id]: Math.max(min, column.getSize() + by),
      }));
      return;
    }
    const next = nextGridPos(e, pos, { rows: bodyCount + 1, cols });
    if (next !== null) {
      e.preventDefault();
      moveTo(next);
      return;
    }
    if (e.key === "Enter") {
      if (pos.row === 0) {
        if (header?.column.getCanSort() === true) {
          e.preventDefault();
          header.column.toggleSorting(undefined, e.shiftKey);
        }
        return;
      }
      const row = bodyRowAt(pos.row);
      if (row !== undefined && onSelect !== undefined) {
        e.preventDefault();
        onSelect(row.original);
      }
      return;
    }
    if (e.key === " " && (target.tagName === "TD" || target.tagName === "TH")) {
      // Space on a plain cell: toggles the row's checkbox when there is
      // one, and never scrolls the page.
      e.preventDefault();
      const row = pos.row === 0 ? undefined : bodyRowAt(pos.row);
      if (row !== undefined && selectable) row.toggleSelected();
    }
  };

  const onFocus = (e: { target: EventTarget }) => {
    const cell = (e.target as HTMLElement).getAttribute?.("data-grid-cell");
    if (cell === null || cell === undefined) return;
    const [r, c] = cell.split(":").map(Number);
    if (r === undefined || c === undefined) return;
    if (r !== active.row || c !== active.col) setActive({ row: r, col: c });
  };

  const onClick = (e: MouseEvent<HTMLTableElement>) => {
    if (onSelect === undefined) return;
    const el = e.target as HTMLElement;
    if (el.closest(INTERACTIVE) !== null) return;
    const tr = el.closest<HTMLElement>("tr[data-row-id]");
    if (tr === null) return;
    const row = table.getRow(tr.dataset["rowId"] ?? "");
    onSelect(row.original);
  };

  const visibleCols = Math.max(1, cols);
  const rowsGiven = rows.length;
  const filteredOut = rowsGiven > 0 && total === 0;
  const firstLoad = loading && rowsGiven === 0;

  let notice: ReactNode = null;
  let noticeKind = "";
  if (firstLoad) {
    noticeKind = "loading";
  } else if (error !== null && rowsGiven === 0) {
    noticeKind = "error";
    notice = <ErrorNotice error={error} retryAfterS={retryAfterS} t={t} />;
  } else if (rowsGiven === 0) {
    noticeKind = "empty";
    notice = empty;
  } else if (filteredOut) {
    noticeKind = "filtered";
    notice = (
      <div role="status" className="grid justify-items-start gap-2 p-2">
        <p className="m-0">{t("table.empty_filtered")}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            table.resetColumnFilters(true);
          }}
        >
          {t("table.clear_filters")}
        </Button>
      </div>
    );
  }

  const pageSelected = pageRows.filter((r) => r.getIsSelected()).length;
  const allSelected: boolean | "indeterminate" =
    pageSelected === 0
      ? false
      : pageSelected === pageRows.length
        ? true
        : "indeterminate";
  const toggleAll = (v: boolean) => {
    const page = new Set(pageRows.map((r) => r.id));
    const next: RowSelectionState = Object.fromEntries(
      Object.entries(selection).filter(([id]) => !page.has(id)),
    );
    if (v) for (const id of page) next[id] = true;
    onRowSelectionChange?.(next);
  };

  const virtualItems = virtual ? virtualizer.getVirtualItems() : [];
  const padTop = virtualItems[0]?.start ?? 0;
  const padBottom = virtual
    ? virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0)
    : 0;
  const shown: { row: TanRow<Row>; gridRow: number; index: number }[] = virtual
    ? virtualItems.flatMap((v) => {
        const row = allRows[v.index];
        return row === undefined
          ? []
          : [{ row, gridRow: v.index + 1, index: v.index }];
      })
    : pageRows.map((row, i) => ({ row, gridRow: i + 1, index: i }));
  const rowOffset = virtual ? 0 : pageIndex * pageSize;
  const cellPad = dense ? "px-2 py-1" : "px-2 py-2";
  const selectableRows = onSelect !== undefined || selectable;
  const from = total === 0 ? 0 : rowOffset + 1;
  const to = virtual ? total : rowOffset + pageRows.length;

  return (
    <div
      className={cn("grid gap-2 text-sm", className)}
      data-table=""
      data-virtual={virtual ? "true" : "false"}
      data-state-kind={noticeKind === "" ? "rows" : noticeKind}
    >
      {toolbar && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Filters columns={table.getAllLeafColumns()} t={t} />
          <ColumnToggles columns={table.getAllLeafColumns()} t={t} />
        </div>
      )}
      {error !== null && rowsGiven > 0 && (
        <ErrorNotice error={error} retryAfterS={retryAfterS} t={t} />
      )}
      <div
        ref={scrollRef}
        className="relative w-full overflow-auto rounded-md border border-border"
        style={virtual ? { maxHeight: VIRTUAL_VIEWPORT_PX } : undefined}
        data-part="scroll"
      >
        <p id={hintId} className="sr-only">
          {t("table.keyboard_hint")}
        </p>
        <table
          ref={tableRef}
          role="grid"
          aria-rowcount={total + 1}
          aria-colcount={cols}
          aria-busy={loading ? true : undefined}
          aria-describedby={hintId}
          aria-multiselectable={selectable ? true : undefined}
          tabIndex={-1}
          className={cn(
            "w-full caption-top border-collapse",
            error !== null && rowsGiven > 0 && "opacity-60",
          )}
          style={{ minWidth: table.getTotalSize() }}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onClick={onClick}
        >
          <caption
            className={cn(
              captionHidden
                ? "sr-only"
                : "px-2 py-2 text-left text-sm font-semibold text-foreground",
            )}
          >
            {caption}
          </caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} aria-rowindex={1}>
                {group.headers.map((h, c) => (
                  <HeaderCell
                    key={h.id}
                    header={h}
                    pos={{ row: 0, col: c }}
                    active={pos.row === 0 && pos.col === c}
                    t={t}
                    dense={dense}
                    multiSorted={state.sorting.length > 1}
                    allSelected={allSelected}
                    onToggleAll={toggleAll}
                  />
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {firstLoad &&
              Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr
                  key={`skeleton-${i}`}
                  data-part="skeleton"
                  aria-hidden="true"
                >
                  {Array.from({ length: visibleCols }, (_, c) => (
                    <td key={c} className={cellPad}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            {firstLoad && (
              <tr>
                <td colSpan={visibleCols} className="p-0">
                  <span role="status" className="sr-only">
                    {t("common.loading")}
                  </span>
                </td>
              </tr>
            )}
            {notice !== null && (
              <tr data-part="notice">
                <td colSpan={visibleCols} className="p-3">
                  {notice}
                </td>
              </tr>
            )}
            {padTop > 0 && (
              <tr aria-hidden="true" data-part="pad">
                <td
                  colSpan={visibleCols}
                  style={{ height: padTop, padding: 0 }}
                />
              </tr>
            )}
            {shown.map(({ row, gridRow, index }) => {
              const id = row.id;
              const isSelected =
                selectedId === id || (selectable && row.getIsSelected());
              return (
                <tr
                  key={id}
                  data-row-id={id}
                  data-index={virtual ? index : undefined}
                  ref={virtual ? virtualizer.measureElement : undefined}
                  aria-rowindex={rowOffset + gridRow + 1}
                  aria-selected={selectableRows ? isSelected : undefined}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(
                    "border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
                    onSelect !== undefined && "cursor-pointer",
                  )}
                >
                  {row.getVisibleCells().map((cell, c) => {
                    const meta = kitMetaOf(cell.column);
                    const key = `${gridRow}:${c}`;
                    const isActive = pos.row === gridRow && pos.col === c;
                    if (meta?.select === true)
                      return (
                        <td key={cell.id} className={cellPad}>
                          <Checkbox
                            checked={row.getIsSelected()}
                            disabled={!row.getCanSelect()}
                            aria-label={t("table.select_row", { id })}
                            data-grid-cell={key}
                            tabIndex={isActive ? 0 : -1}
                            onCheckedChange={(v) => {
                              row.toggleSelected(v === true);
                            }}
                          />
                        </td>
                      );
                    return (
                      <td
                        key={cell.id}
                        data-grid-cell={key}
                        tabIndex={isActive ? 0 : -1}
                        data-column={cell.column.id}
                        className={cn(
                          cellPad,
                          "align-middle whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                          meta?.align === "end" && "text-right tabular-nums",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {padBottom > 0 && (
              <tr aria-hidden="true" data-part="pad">
                <td
                  colSpan={visibleCols}
                  style={{ height: padBottom, padding: 0 }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          {total > 0 && (
            <span data-part="range">
              {t("table.range", {
                from: fmtNum(from, 0, undefined, lang),
                to: fmtNum(to, 0, undefined, lang),
                total: fmtNum(total, 0, undefined, lang),
              })}
            </span>
          )}
          {loading && !firstLoad && (
            <span role="status" data-part="refreshing">
              {t("table.refreshing")}
            </span>
          )}
          {freshness !== null && (
            <FreshnessFooter
              freshness={freshness}
              staleAfterS={staleAfterS}
              t={t}
            />
          )}
        </div>
        {!virtual && total > 0 && (
          <Pager
            t={t}
            pageIndex={pageIndex}
            pageCount={pageCount}
            pageSize={pageSize}
            onPage={(p) => {
              setState({
                ...state,
                pagination: { ...state.pagination, pageIndex: p },
              });
            }}
            onPageSize={(n) => {
              setState({ ...state, pagination: { pageIndex: 0, pageSize: n } });
            }}
          />
        )}
      </div>
    </div>
  );
}

function Pager(props: {
  t: Translate;
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  onPage(p: number): void;
  onPageSize(n: number): void;
}) {
  const { t, pageIndex, pageCount, pageSize, onPage, onPageSize } = props;
  const sizeId = useId();
  const sizes = PAGE_SIZES.includes(pageSize)
    ? PAGE_SIZES
    : [...PAGE_SIZES, pageSize].sort((a, b) => a - b);
  return (
    <nav
      aria-label={t("ui.pagination")}
      className="flex flex-wrap items-center gap-2"
      data-part="pager"
    >
      <label htmlFor={sizeId}>{t("table.page_size")}</label>
      <select
        id={sizeId}
        value={pageSize}
        className="h-8 rounded-md border border-input bg-background px-1 text-foreground"
        onChange={(e) => {
          onPageSize(Number(e.target.value));
        }}
      >
        {sizes.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={t("ui.previous_page")}
        disabled={pageIndex === 0}
        onClick={() => {
          onPage(pageIndex - 1);
        }}
      >
        {t("ui.previous")}
      </Button>
      <span data-part="page" aria-live="polite">
        {t("table.page_of", { page: pageIndex + 1, pages: pageCount })}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={t("ui.next_page")}
        disabled={pageIndex >= pageCount - 1}
        onClick={() => {
          onPage(pageIndex + 1);
        }}
      >
        {t("ui.next")}
      </Button>
    </nav>
  );
}

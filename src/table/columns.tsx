"use client";
// The typed column helpers of docs/PLAN.md §3.14 (WP-9). Each one reads a
// field of the app's row view model and renders it with the kit's words
// and tokens; none computes anything a server decides (CLAUDE.md rule 2).
// The unit and the datum are in the column header (LESSONS E-13), a time
// says UTC (S-16), an unknown is a dash and sorts last in both directions
// (rule 6), and a threshold is the caller's (rule 3).
import type {
  CellContext,
  Column,
  ColumnDef,
  FilterFn,
  SortingFn,
} from "@tanstack/react-table";
import type { ReactNode } from "react";

import type { Key } from "../i18n/en.js";
import { fmtNum, fmtTimeUTC } from "../i18n/format.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import type { Translate } from "../i18n/translate.js";
import type { Identification, Severity, Trust } from "../model/index.js";
import { AgeChip } from "../status/AgeChip.js";
import {
  IDENT_ORDER,
  IDENT_STATUS_KEYS,
  identDrawn,
  identHintKey,
  type IdentKey,
} from "../symbology/ident.js";
import { SEVERITY_KEYS } from "../symbology/severity.js";
import { TRUST_KEYS, TRUST_ORDER } from "../symbology/track.js";
import { cn } from "../ui/cn.js";

/**
 * A column of a DataTable, its value type erased. TanStack's `ColumnDef`
 * is invariant in the value type, so columns of different value types
 * cannot share one array without erasing it; `tableColumn` does that for
 * a column the app writes itself, and every helper here returns one.
 */
export type TableColumn<Row> = ColumnDef<Row, unknown>;

/** Erases a column's value type so it can join a `TableColumn[]`. */
export function tableColumn<Row, V>(def: ColumnDef<Row, V>): TableColumn<Row> {
  return def as unknown as TableColumn<Row>;
}

/** One option of an enumeration filter, with its catalogue key. */
export interface FilterOption {
  value: string;
  labelKey: string;
}

/** The filter a column offers in the table's filter bar. */
export type ColumnFilterKind =
  { kind: "text" } | { kind: "enum"; options: readonly FilterOption[] };

/**
 * What the kit knows about a column: how to name it and how to filter it.
 * Set by the helpers under `meta.uspace`; a column the app writes may set
 * it too (`kitColumnMeta`).
 */
export interface KitColumnMeta {
  /** The catalogue key of the column's name (the app's or the kit's). */
  headerKey: string;
  /** The catalogue key of the unit (and datum) the header names. */
  unitKey?: string;
  /** The column holds times; the header says UTC. */
  utc?: boolean;
  filter?: ColumnFilterKind;
  /** Numbers align to the end of the cell. */
  align?: "start" | "end";
  /** The row-selection column (`columns.select`). */
  select?: boolean;
}

/** `meta` for a column the app writes, so the kit can name and filter it. */
export function kitColumnMeta(meta: KitColumnMeta): { uspace: KitColumnMeta } {
  return { uspace: meta };
}

/** The kit's meta of a column, when it has one. */
export function kitMetaOf<Row>(
  column: Column<Row, unknown>,
): KitColumnMeta | undefined {
  const meta = column.columnDef.meta as { uspace?: KitColumnMeta } | undefined;
  return meta?.uspace;
}

/**
 * The column's name as text, with its unit or "UTC" when it has one
 * ("Speed (m/s)", "Raised (UTC)"); the column id for a column the kit
 * cannot name (a string header is used as given).
 */
export function columnLabel<Row>(
  column: Column<Row, unknown>,
  t: Translate,
): string {
  const meta = kitMetaOf(column);
  if (meta === undefined) {
    const header = column.columnDef.header;
    return typeof header === "string" ? header : column.id;
  }
  const label = t(meta.headerKey);
  if (meta.unitKey !== undefined)
    return t("table.header_unit", { label, unit: t(meta.unitKey) });
  if (meta.utc === true) return t("table.header_utc", { label });
  return label;
}

/**
 * Unit and datum symbols for `columns.num` headers. An altitude names its
 * datum (D-01, E-13); height over take-off is not "above ground" (R-12).
 */
export const UNIT_KEYS = Object.freeze({
  m: "unit.symbol.m",
  m_amsl: "unit.symbol.m_amsl",
  m_agl: "unit.symbol.m_agl",
  m_wgs84: "unit.symbol.m_wgs84",
  m_takeoff: "unit.symbol.m_takeoff",
  ms: "unit.symbol.ms",
  s: "unit.symbol.s",
  min: "unit.symbol.min",
  deg: "unit.symbol.deg",
  pct: "unit.symbol.pct",
  kg: "unit.symbol.kg",
  wh: "unit.symbol.wh",
} as const satisfies Record<string, Key>);

/** The keys of `Row` whose values are assignable to `V`. */
export type KeyOf<Row, V> = {
  [K in keyof Row]-?: Row[K] extends V ? K : never;
}[keyof Row] &
  string;

export interface ColumnOptions {
  /** The column id; the field key by default. */
  id?: string;
  /** The catalogue key of the header; the field key by default. */
  headerKey?: string;
}

const known = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const equalsFilter: FilterFn<unknown> = (row, id, value) =>
  value === undefined || value === "" || row.getValue(id) === value;

function rankSort(order: readonly string[]): SortingFn<unknown> {
  return (a, b, id) =>
    order.indexOf(String(a.getValue(id))) -
    order.indexOf(String(b.getValue(id)));
}

function Dash() {
  return <span aria-label={useT()("common.unknown")}>—</span>;
}

function NumCell(props: { v: unknown; digits: number }) {
  const { lang } = useLang();
  if (!known(props.v)) return <Dash />;
  return <>{fmtNum(props.v, props.digits, undefined, lang)}</>;
}

function UtcCell(props: { iso: string | null }) {
  const { lang } = useLang();
  if (props.iso === null) return <Dash />;
  return <time dateTime={props.iso}>{fmtTimeUTC(props.iso, lang)}</time>;
}

function KeyCell(props: { k: string | null }) {
  const t = useT();
  if (props.k === null) return <Dash />;
  return <>{t(props.k)}</>;
}

const SEVERITY_BORDER: Readonly<Record<Severity, string>> = {
  info: "border-severity-info",
  warning: "border-severity-warning",
  critical: "border-severity-critical",
};

const TRUST_BORDER: Readonly<Record<Trust, string>> = {
  authenticated: "border-trust-authenticated",
  provider: "border-trust-provider",
  surveillance: "border-trust-surveillance",
  broadcast: "border-trust-broadcast border-dashed",
  sensor: "border-trust-sensor",
  simulated: "border-trust-simulated border-dotted",
};

const IDENT_BORDER: Readonly<Record<IdentKey, string>> = {
  registered: "border-ident-registered",
  suspended: "border-ident-suspended",
  unknown_operator: "border-ident-unknown_operator",
  unidentified: "border-ident-unidentified",
  none: "border-ident-none border-dotted",
};

function TokenBadge(props: {
  border: string;
  children: ReactNode;
  data: Record<string, string>;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border-2 px-2 py-0.5 text-xs font-medium",
        props.border,
      )}
      {...props.data}
    >
      {props.children}
    </span>
  );
}

function SeverityCell(props: { s: Severity | null }) {
  const t = useT();
  if (props.s === null) return <Dash />;
  return (
    <TokenBadge
      border={SEVERITY_BORDER[props.s]}
      data={{ "data-severity": props.s }}
    >
      {t(SEVERITY_KEYS[props.s])}
    </TokenBadge>
  );
}

function TrustCell(props: { trust: Trust | null }) {
  const t = useT();
  if (props.trust === null) return <Dash />;
  // Every broadcast track says "broadcast and unverified" (R-05).
  const key: Key =
    props.trust === "broadcast" ? "track.broadcast" : TRUST_KEYS[props.trust];
  return (
    <TokenBadge
      border={TRUST_BORDER[props.trust]}
      data={{ "data-trust": props.trust }}
    >
      {t(key)}
    </TokenBadge>
  );
}

function IdentCell(props: { ident: Identification | null }) {
  const t = useT();
  const drawn = identDrawn(props.ident);
  const hint =
    props.ident === null || drawn === "none"
      ? null
      : identHintKey(
          drawn,
          props.ident.reason,
          props.ident.basis,
          props.ident.mismatch,
        );
  // "registered, as broadcast and unverified" replaces "registered" (R-05).
  const label =
    hint?.caveat === "ident.registered_as_broadcast"
      ? t(hint.caveat)
      : t(IDENT_STATUS_KEYS[drawn]);
  const caveat =
    hint !== null &&
    hint.caveat !== null &&
    hint.caveat !== "ident.registered_as_broadcast"
      ? t(hint.caveat)
      : null;
  return (
    <span className="inline-flex flex-col gap-0.5" data-ident={drawn}>
      <TokenBadge border={IDENT_BORDER[drawn]} data={{}}>
        {label}
      </TokenBadge>
      {caveat !== null && (
        <span className="text-xs text-muted-foreground">{caveat}</span>
      )}
      {hint !== null && hint.mismatch !== null && (
        <span className="text-xs text-muted-foreground">
          {t(hint.mismatch)}
        </span>
      )}
    </span>
  );
}

function value<Row>(r: Row, key: string): unknown {
  return (r as Record<string, unknown>)[key];
}

/**
 * A number with its unit and datum in the header (`unitKey` from
 * `UNIT_KEYS`, or the app's own key); null, NaN and Infinity are a dash
 * and sort last in both directions.
 */
function num<Row>(
  key: KeyOf<Row, number | null | undefined>,
  unitKey: string,
  digits: number,
  opts: ColumnOptions = {},
): TableColumn<Row> {
  return tableColumn<Row, number | undefined>({
    id: opts.id ?? key,
    accessorFn: (r) => {
      const v = value(r, key);
      return known(v) ? v : undefined;
    },
    sortUndefined: "last",
    sortingFn: "basic",
    enableColumnFilter: false,
    meta: kitColumnMeta({
      headerKey: opts.headerKey ?? key,
      unitKey,
      align: "end",
    }),
    cell: (c: CellContext<Row, number | undefined>) => (
      <NumCell v={c.getValue()} digits={digits} />
    ),
  });
}

/**
 * An RFC 3339 time shown in UTC ("2026-10-02 14:03 UTC"), the header
 * saying UTC. Sorted by instant for display; an absent or unreadable time
 * is a dash and sorts last.
 */
function utc<Row>(
  key: KeyOf<Row, string | null | undefined>,
  opts: ColumnOptions = {},
): TableColumn<Row> {
  return tableColumn<Row, number | undefined>({
    id: opts.id ?? key,
    // Ordering for display only: the instant is compared, not judged.
    accessorFn: (r) => {
      const v = value(r, key);
      const ms = typeof v === "string" ? Date.parse(v) : Number.NaN;
      return Number.isNaN(ms) ? undefined : ms;
    },
    sortUndefined: "last",
    sortingFn: "basic",
    enableColumnFilter: false,
    meta: kitColumnMeta({ headerKey: opts.headerKey ?? key, utc: true }),
    cell: (c: CellContext<Row, number | undefined>) => {
      const v = value(c.row.original, key);
      return <UtcCell iso={typeof v === "string" ? v : null} />;
    },
  });
}

export interface AgeColumnOptions<Row> extends ColumnOptions {
  /** The row's display age at `nowMs`, in seconds; null when unknown. */
  ageS(row: Row, nowMs: number): number | null;
  /** The policy's `stale_after_s`; null until the server sends one. */
  staleAfterS: number | null;
}

/** An `AgeChip`: the age and its bucket under the caller's threshold. */
function age<Row>(
  nowMs: number,
  opts: AgeColumnOptions<Row>,
): TableColumn<Row> {
  return tableColumn<Row, number | undefined>({
    id: opts.id ?? "age",
    accessorFn: (r) => {
      const v = opts.ageS(r, nowMs);
      return known(v) ? v : undefined;
    },
    sortUndefined: "last",
    sortingFn: "basic",
    enableColumnFilter: false,
    meta: kitColumnMeta({
      headerKey: opts.headerKey ?? "table.column.age",
      align: "end",
    }),
    cell: (c: CellContext<Row, number | undefined>) => (
      <AgeChip ageS={c.getValue() ?? null} staleAfterS={opts.staleAfterS} />
    ),
  });
}

function enumOptions(
  values: readonly string[],
  keys: Readonly<Record<string, string>>,
): FilterOption[] {
  return values.map((v) => ({ value: v, labelKey: keys[v] ?? v }));
}

/** The alert's or violation's severity, from the server (Z-10). */
function severity<Row>(
  opts: ColumnOptions & { key?: KeyOf<Row, Severity | null | undefined> } = {},
): TableColumn<Row> {
  const key = opts.key ?? "severity";
  // Least severe first, so "descending" puts critical on top.
  const order = ["info", "warning", "critical"];
  return tableColumn<Row, string | undefined>({
    id: opts.id ?? key,
    accessorFn: (r) => {
      const v = value(r, key);
      return typeof v === "string" ? v : undefined;
    },
    sortUndefined: "last",
    sortingFn: rankSort(order) as SortingFn<Row>,
    filterFn: equalsFilter as FilterFn<Row>,
    meta: kitColumnMeta({
      headerKey: opts.headerKey ?? "table.column.severity",
      filter: { kind: "enum", options: enumOptions(order, SEVERITY_KEYS) },
    }),
    cell: (c: CellContext<Row, string | undefined>) => (
      <SeverityCell s={(c.getValue() as Severity | undefined) ?? null} />
    ),
  });
}

/** How the position reached the system (04 §2); broadcast says so (R-05). */
function trust<Row>(
  opts: ColumnOptions & { key?: KeyOf<Row, Trust | null | undefined> } = {},
): TableColumn<Row> {
  const key = opts.key ?? "trust";
  return tableColumn<Row, string | undefined>({
    id: opts.id ?? key,
    accessorFn: (r) => {
      const v = value(r, key);
      return typeof v === "string" ? v : undefined;
    },
    sortUndefined: "last",
    sortingFn: rankSort(TRUST_ORDER) as SortingFn<Row>,
    filterFn: equalsFilter as FilterFn<Row>,
    meta: kitColumnMeta({
      headerKey: opts.headerKey ?? "table.column.trust",
      filter: {
        kind: "enum",
        options: TRUST_ORDER.map((v) => ({
          value: v,
          labelKey: v === "broadcast" ? "track.broadcast" : TRUST_KEYS[v],
        })),
      },
    }),
    cell: (c: CellContext<Row, string | undefined>) => (
      <TrustCell trust={(c.getValue() as Trust | undefined) ?? null} />
    ),
  });
}

/**
 * The identification status as drawn (a registered status with a
 * mismatch is never shown as registered, G-02), with the basis caveat
 * (R-05) and the mismatch line. No identification is its own status.
 */
function ident<Row>(
  opts: ColumnOptions & {
    key?: KeyOf<Row, Identification | null | undefined>;
  } = {},
): TableColumn<Row> {
  const key = opts.key ?? "identification";
  const read = (r: Row): Identification | null => {
    const v = value(r, key);
    return typeof v === "object" && v !== null ? (v as Identification) : null;
  };
  return tableColumn<Row, string>({
    id: opts.id ?? key,
    accessorFn: (r) => identDrawn(read(r)),
    sortingFn: rankSort(IDENT_ORDER) as SortingFn<Row>,
    filterFn: equalsFilter as FilterFn<Row>,
    meta: kitColumnMeta({
      headerKey: opts.headerKey ?? "table.column.ident",
      filter: {
        kind: "enum",
        options: enumOptions(IDENT_ORDER, IDENT_STATUS_KEYS),
      },
    }),
    cell: (c: CellContext<Row, string>) => (
      <IdentCell ident={read(c.row.original)} />
    ),
  });
}

/**
 * A value of an enumeration, labelled by `<i18nPrefix>.<value>`. With
 * `values`, the filter is a choice among them; without, a text filter.
 */
function enumColumn<Row>(
  key: KeyOf<Row, string | null | undefined>,
  i18nPrefix: string,
  opts: ColumnOptions & { values?: readonly string[] } = {},
): TableColumn<Row> {
  const labelKey = (v: string): string => `${i18nPrefix}.${v}`;
  return tableColumn<Row, string | undefined>({
    id: opts.id ?? key,
    accessorFn: (r) => {
      const v = value(r, key);
      return typeof v === "string" ? v : undefined;
    },
    sortUndefined: "last",
    sortingFn:
      opts.values === undefined
        ? "text"
        : (rankSort(opts.values) as SortingFn<Row>),
    filterFn: equalsFilter as FilterFn<Row>,
    meta: kitColumnMeta({
      headerKey: opts.headerKey ?? key,
      filter:
        opts.values === undefined
          ? { kind: "text" }
          : {
              kind: "enum",
              options: opts.values.map((v) => ({
                value: v,
                labelKey: labelKey(v),
              })),
            },
    }),
    cell: (c: CellContext<Row, string | undefined>) => {
      const v = c.getValue();
      return <KeyCell k={v === undefined ? null : labelKey(v)} />;
    },
  });
}

/** Plain text as the API sent it, with a case-insensitive text filter. */
function text<Row>(
  key: KeyOf<Row, string | null | undefined>,
  opts: ColumnOptions & { mono?: boolean } = {},
): TableColumn<Row> {
  return tableColumn<Row, string | undefined>({
    id: opts.id ?? key,
    accessorFn: (r) => {
      const v = value(r, key);
      return typeof v === "string" && v !== "" ? v : undefined;
    },
    sortUndefined: "last",
    sortingFn: "text",
    filterFn: "includesString",
    meta: kitColumnMeta({
      headerKey: opts.headerKey ?? key,
      filter: { kind: "text" },
    }),
    cell: (c: CellContext<Row, string | undefined>) => {
      const v = c.getValue();
      if (v === undefined) return <Dash />;
      return opts.mono === true ? (
        <span className="font-mono text-xs">{v}</span>
      ) : (
        v
      );
    },
  });
}

/**
 * The row-selection column: a checkbox per row (Space toggles it) and one
 * in the header for the rows of the page; DataTable draws both.
 */
function select<Row>(opts: { id?: string } = {}): TableColumn<Row> {
  return tableColumn<Row, unknown>({
    id: opts.id ?? "select",
    enableSorting: false,
    enableColumnFilter: false,
    enableHiding: false,
    enableResizing: false,
    size: 48,
    // DataTable renders the checkboxes, so they take part in its roving
    // focus; the header names the column for the column list.
    meta: kitColumnMeta({ headerKey: "table.column.select", select: true }),
  });
}

/** The column helpers, each generic in the row type. */
export const columns = Object.freeze({
  num,
  utc,
  age,
  severity,
  trust,
  ident,
  enum: enumColumn,
  text,
  select,
});

/** The helpers with `Row` fixed once: `const c = columnsFor<Registration>()`. */
export function columnsFor<Row>() {
  return {
    num: (
      key: KeyOf<Row, number | null | undefined>,
      unitKey: string,
      digits: number,
      opts?: ColumnOptions,
    ) => num<Row>(key, unitKey, digits, opts),
    utc: (key: KeyOf<Row, string | null | undefined>, opts?: ColumnOptions) =>
      utc<Row>(key, opts),
    age: (nowMs: number, opts: AgeColumnOptions<Row>) => age<Row>(nowMs, opts),
    severity: (
      opts?: ColumnOptions & { key?: KeyOf<Row, Severity | null | undefined> },
    ) => severity<Row>(opts),
    trust: (
      opts?: ColumnOptions & { key?: KeyOf<Row, Trust | null | undefined> },
    ) => trust<Row>(opts),
    ident: (
      opts?: ColumnOptions & {
        key?: KeyOf<Row, Identification | null | undefined>;
      },
    ) => ident<Row>(opts),
    enum: (
      key: KeyOf<Row, string | null | undefined>,
      i18nPrefix: string,
      opts?: ColumnOptions & { values?: readonly string[] },
    ) => enumColumn<Row>(key, i18nPrefix, opts),
    text: (
      key: KeyOf<Row, string | null | undefined>,
      opts?: ColumnOptions & { mono?: boolean },
    ) => text<Row>(key, opts),
    select: (opts?: { id?: string }) => select<Row>(opts),
  };
}

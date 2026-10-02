// `@rootxkit/uspace-ui/table` (docs/PLAN.md §3.14, WP-9): the accessible
// data table every console lists with, its URL state with a PII deny-list,
// and the typed column helpers. No export button: an export is an audited
// act at the API (spec 01 A10, F10; table/README.md).
export {
  UNIT_KEYS,
  columnLabel,
  columns,
  columnsFor,
  kitColumnMeta,
  kitMetaOf,
  tableColumn,
  type AgeColumnOptions,
  type ColumnFilterKind,
  type ColumnOptions,
  type FilterOption,
  type KeyOf,
  type KitColumnMeta,
  type TableColumn,
} from "./columns.js";
export {
  resetTableCountersForTests,
  tableCounters,
  type TableCounter,
} from "./counters.js";
export {
  DataTable,
  RESIZE_STEP_PX,
  VIRTUAL_VIEWPORT_PX,
  VIRTUALIZE_ABOVE_ROWS,
  type DataTableProps,
} from "./DataTable.js";
export {
  PAGE_STEP_ROWS,
  nextGridPos,
  type GridKey,
  type GridPos,
  type GridSize,
} from "./keyboard.js";
export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PAGE_SIZES,
  PII_FILTER_DENY_LIST,
  initialTableState,
  isPiiColumn,
  readTableState,
  writeTableState,
  type TableState,
} from "./state.js";

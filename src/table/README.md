# `@rootxkit/uspace-ui/table`

The data table every console lists with (docs/PLAN.md §3.14, WP-9):
`DataTable`, `useTableUrlState`, and the column helpers (`columns`,
`columnsFor<Row>()`).

```tsx
import {
  DataTable,
  UNIT_KEYS,
  columnsFor,
  useTableUrlState,
} from "@rootxkit/uspace-ui/table";

const c = columnsFor<Registration>();
const columns = [
  c.text("regNumber", { headerKey: "reg.number", mono: true }),
  c.enum("status", "reg.status", { values: STATUSES }),
  c.num("maxAltAmslM", UNIT_KEYS.m_amsl, 0, { headerKey: "reg.ceiling" }),
  c.utc("updatedAt", { headerKey: "reg.updated" }),
];

const [state, setState] = useTableUrlState("reg");
<DataTable
  caption={t("reg.caption")}
  columns={columns}
  rows={rows}
  getRowId={(r) => r.id}
  empty={<p>{t("reg.empty")}</p>}
  state={state}
  onStateChange={setState}
  error={problem}
  retryAfterS={apiError?.retryAfterS ?? null}
  freshness={freshness}
  staleAfterS={status.staleAfterS}
/>;
```

## Why there is no export button

An export of a list is an audited act at the API (spec `01` A10, F10):
the API records who exported what, when, and under which role, and it
applies the role's view of personal data (`06 §5`). A button in the kit
that wrote the visible rows to a CSV in the browser would produce the
same file without that record, so the kit does not offer one, and a
console must not build one on top of `DataTable`. A console that needs an
export links to the API's export endpoint, which is the audited path.

## Personal data and the URL

`useTableUrlState` writes sorting, filters, the page and the hidden
columns to the search parameters under `<key>.*`, so a view can be
shared. A filter value in a URL is also in the browser history, in proxy
logs and in screenshots, so a filter on a column whose id names personal
data is kept in memory only. It still filters. The list is
`PII_FILTER_DENY_LIST` (`name`, `legal_name`, `email`, `phone`,
`address`, `date_of_birth`, `person_ref`, `reporter`), matched on the
last words of the column id in any spelling (`operatorEmail`,
`date-of-birth`, `person.ref`). A PII filter found in a URL is not
applied and is counted (`tableCounters().url_pii_refused`). Malformed
state in a URL is ignored and counted, never thrown.

## Keyboard

The table is an ARIA grid with one tab stop (WAI-ARIA APG, "Data Grid"):

| Key | Moves to |
|---|---|
| Arrow keys | the next cell in that direction; no wrapping |
| Home / End | the first / last cell of the row |
| Ctrl+Home / Ctrl+End | the first / last cell of the grid |
| PageUp / PageDown | ten rows up / down |
| Enter | on a row: `onSelect`; on a header: sort (Shift adds to the sort) |
| Space | toggles the row's checkbox (`columns.select`) |
| Alt+Left / Alt+Right | on a header: narrows / widens the column |

## What the helpers show

- `num(key, unitKey, digits)`: the unit (and the datum, for an altitude)
  is in the header ("Ceiling (m AMSL)"), never a bare number; `null` is a
  dash and sorts last in both directions.
- `utc(key)`: `fmtTimeUTC`, the header says UTC.
- `age(nowMs, { ageS, staleAfterS })`: an `AgeChip`. The threshold is
  the caller's (the status frame's `stale_after_s`); without one the age
  is shown without a bucket.
- `severity()`, `trust()`, `ident()`: the server's values with the kit's
  tokens and words. A broadcast track says "broadcast and unverified";
  a registration on a broadcast basis says "registered, as broadcast and
  unverified"; a registered status with a mismatch is never shown as
  registered.
- `enum(key, i18nPrefix, { values })`, `text(key)`, `select()`.

A column the app writes itself joins the array through `tableColumn()`,
and gets the kit's header and filter with `meta: kitColumnMeta({...})`.

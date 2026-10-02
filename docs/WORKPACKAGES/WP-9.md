# WP-9: `table` (accessible data table kit)

Branch `feat/WP-9-table`. Milestone U-M2 (registry, certificates,
publications, deliveries, violations, intents and records lists in
every console). Owns `src/table/` exclusively. Depends on WP-1 (`ui`
table primitives), WP-2 (formatters, i18n). Consumers: every console.

## Read first

1. `docs/PLAN.md` §3.14, §4 (TanStack rows), §7 (no PII in URLs), §8
   (10 000 rows virtualised; sort ≤ 50 ms).
2. Spec `01` (the lists each role sees: registry for registrars,
   certificates and the public register, publications and deliveries at
   the CISP, violations and incidents and occurrences at the authority,
   intents and records at the USSP, restrictions and the coordination
   inbox at the ANSP; this WP builds no list, it builds the table they
   all use), `06 §5` (PII is shown to the roles that may see it; a
   table never puts it in a URL or a `localStorage`), `02 §1` (UTC).
3. LESSONS E-13 (unit in the column header), S-16 (UTC said), B-11 (a
   source list shows disabled, healthy, stale, never heard: the status
   cell), E-02 (an empty table says why: no rows, filtered out, loading,
   error, stale).
4. WAI-ARIA Authoring Practices: grid and table patterns, `aria-sort`,
   roving tabindex. TanStack Table and Virtual documentation.
5. Predecessor `utm/web-pilot/src/components/RegistryView.tsx`,
   `AircraftList.tsx` (what operators used; the filter and status
   behaviour).

## What to build

- `DataTable<Row>` on TanStack Table: sorting (multi with shift),
  column filters, pagination or virtualisation (`virtualize` switches
  to `@tanstack/react-virtual` rows; above 200 rows automatic), column
  visibility, resizable columns, sticky header, `caption` (required;
  visually hidden allowed), `aria-sort` on headers, keyboard navigation
  (arrows, Home/End, PageUp/Down, Enter selects, Space toggles a
  checkbox cell), focus ring from tokens, dense mode, row selection by
  `getRowId`, `empty` node, `loading` skeleton, `error` (a `Problem`
  rendered with its `detail` and `retryAfterS` when present),
  `freshness` (an `AgeChip` and "as of version V" in the footer).
- `useTableUrlState(key)`: sorting, filters, page and visibility in the
  URL search params under `key.*`; a filter whose column id is in the
  PII deny-list (`name`, `legal_name`, `email`, `phone`, `address`,
  `date_of_birth`, `person_ref`, `reporter`) is kept in memory only and
  never written to the URL; the list is exported and tested.
- `columns.*` helpers: `age(nowMs)` (an `AgeChip`), `severity()`,
  `trust()`, `ident()` (badges from WP-7 tokens; until WP-7 merges, a
  plain badge with the token name), `utc(key)` (`fmtTimeUTC`),
  `num(key, unit, digits)` (header carries the unit; null is a dash),
  `enum(key, i18nPrefix)`.
- Export of the visible rows to CSV is **not** in this WP: an export is
  an audited act at the API (`01` A10, F10) and the kit must not offer a
  client-side one that bypasses the audit. Document this in `table/README.md`.

## Tests

- jsdom: sorting toggles `aria-sort` and reorders (ascending, descending,
  none); a numeric column sorts numerically with nulls last (dash rows
  at the bottom in both directions); filter narrows; pagination
  bounds; keyboard navigation moves focus as APG says (each key tested);
  `Enter` calls `onSelect` and an arrow does not (pair); `caption`
  required (type-level test); empty, loading, error with `retryAfterS`,
  and `freshness` footers each render (presence loop); `axe` clean on
  every state.
- `useTableUrlState`: a sort lands in the URL; a filter on `email` does
  not and still filters (pair); malformed URL state is ignored and
  counted, not thrown.
- Virtualisation: 10 000 rows render ≤ 60 DOM rows; scrolling to the
  end renders the last row; sort of 10 000 rows timed and reported
  (benchmark).
- Browser tests: a registry-shaped fixture (with `GEO-TEST-*` numbers), a
  sources table with every `SourceState`, a deliveries table with
  freshness and an error state; both languages; golden DOM snapshots of
  one page and the empty/error states.

## Done when

- [ ] PLAN §3.14 implemented; API report updated.
- [ ] APG keyboard behaviour covered key by key; `axe` clean.
- [ ] The PII deny-list test exists and `table/README.md` explains why
  there is no export button.
- [ ] `pnpm check`, `pnpm test`, `pnpm test:browser` outputs in the PR.

## Safety notes

Not a safety-critical surface, but a privacy one (`06 §5`): a filter
value in a URL is a value in a browser history, a proxy log and a
screenshot. The deny-list is the mechanism; the test that a PII filter
still works in memory is the presence twin so that privacy does not
quietly disable the feature.

## Commits

`feat(table): add DataTable on TanStack with sorting, filters, virtualisation and keyboard navigation [WP-9 U-M2]`,
`feat(table): add URL state with a PII deny-list and the typed column helpers [WP-9 U-M2]`,
`test(table): cover APG keys, null ordering, URL state and the empty, loading, error and stale states [WP-9 U-M2]`.

// On the server there is no URL to read or write: useTableUrlState gives
// the initial state and a DataTable renders without touching `window`.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";

import { I18nProvider } from "../i18n/I18nProvider.js";
import { columnsFor } from "./columns.js";
import { DataTable } from "./DataTable.js";
import { registrationRows, type RegistrationRow } from "./fixtures.testing.js";
import { DEFAULT_PAGE_SIZE, type TableState } from "./state.js";
import { useTableUrlState } from "./useTableUrlState.js";

it("renders on the server with the initial state", () => {
  expect(typeof window).toBe("undefined");
  let seen: TableState | null = null;
  let write: ((s: TableState) => void) | null = null;
  const c = columnsFor<RegistrationRow>();
  function Page() {
    const [state, setState] = useTableUrlState("reg");
    seen = state;
    write = setState;
    return createElement(DataTable<RegistrationRow>, {
      caption: "Registered aircraft",
      columns: [c.text("regNumber")],
      rows: registrationRows(3),
      getRowId: (r) => r.id,
      empty: null,
      state,
    });
  }
  const html = renderToString(
    createElement(I18nProvider, { lang: "en" }, createElement(Page)),
  );
  expect(html).toContain("GEO-TEST-00003");
  // A write without a URL is a no-op, not a throw.
  expect(() => {
    write?.({
      ...(seen as unknown as TableState),
      sorting: [{ id: "x", desc: false }],
    });
  }).not.toThrow();
  expect(seen).toEqual({
    sorting: [],
    columnFilters: [],
    pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
    columnVisibility: {},
  });
});

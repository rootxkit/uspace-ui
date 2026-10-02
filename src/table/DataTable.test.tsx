// DataTable (WP-9, PLAN §3.14) in jsdom: sorting with aria-sort (asc,
// desc, none) and numbers with nulls last both ways, multi-sort with
// Shift, filters, pagination bounds, column visibility and resizing, the
// APG keys one by one, Enter selects and an arrow does not (pair), Space
// toggles a selection, the caption required by type, every state that
// says why the table is empty (E-02) and the freshness footer, each
// checked with axe, and virtualisation of 10 000 rows.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n/I18nProvider.js";
import type { Lang } from "../i18n/lang.js";
import { axeCheck } from "../test/axe.js";
import { UNIT_KEYS, columnsFor, type TableColumn } from "./columns.js";
import { resetTableCountersForTests, tableCounters } from "./counters.js";
import { DataTable, type DataTableProps } from "./DataTable.js";
import {
  APP_CATALOGUES,
  FRESHNESS,
  PICTURE_NOW_MS,
  REFUSED,
  REG_STATUSES,
  pictureRows,
  registrationRows,
  type PictureRow,
  type RegistrationRow,
} from "./fixtures.testing.js";
import { initialTableState, type TableState } from "./state.js";

afterEach(() => {
  cleanup();
  resetTableCountersForTests();
});

const c = columnsFor<RegistrationRow>();

function regColumns(select = false): TableColumn<RegistrationRow>[] {
  return [
    ...(select ? [c.select()] : []),
    c.text("regNumber", { headerKey: "reg.regNumber", mono: true }),
    c.text("serial", { headerKey: "reg.serial", mono: true }),
    c.enum("status", "reg.status", {
      values: REG_STATUSES,
      headerKey: "reg.status",
    }),
    c.text("email", { headerKey: "reg.email" }),
    c.num("massKg", UNIT_KEYS.kg, 2, { headerKey: "reg.massKg" }),
    c.num("maxAltAmslM", UNIT_KEYS.m_amsl, 0, { headerKey: "reg.maxAltAmslM" }),
    c.utc("updatedAt", { headerKey: "reg.updatedAt" }),
  ];
}

function wrap(ui: ReactNode, lang: Lang = "en") {
  return render(
    <I18nProvider lang={lang} catalogues={APP_CATALOGUES}>
      {ui}
    </I18nProvider>,
  );
}

type RegProps = Partial<DataTableProps<RegistrationRow>> & { lang?: Lang };

function renderReg(props: RegProps = {}) {
  const { lang, ...rest } = props;
  return wrap(
    <DataTable<RegistrationRow>
      caption="Registered aircraft"
      columns={regColumns()}
      rows={registrationRows(30)}
      getRowId={(r) => r.id}
      empty={<p>No registrations yet</p>}
      {...rest}
    />,
    lang,
  );
}

const ids = (root: HTMLElement): string[] =>
  [...root.querySelectorAll("tbody tr[data-row-id]")].map(
    (tr) => tr.getAttribute("data-row-id") ?? "",
  );

const cells = (root: HTMLElement, column: string): string[] =>
  [...root.querySelectorAll(`tbody td[data-column="${column}"]`)].map(
    (td) => td.textContent ?? "",
  );

const th = (name: string): HTMLElement => {
  const el = screen.getByRole("button", { name }).closest("th");
  if (el === null) throw new Error(`no header ${name}`);
  return el;
};

function altRows(values: (number | null)[]): RegistrationRow[] {
  const base = registrationRows(values.length);
  return base.map((r, i) => ({ ...r, maxAltAmslM: values[i] ?? null }));
}

describe("sorting", () => {
  it("toggles aria-sort ascending, descending, none and reorders", () => {
    const { container } = renderReg({ rows: altRows([300, 100, 200]) });
    const before = ids(container);
    const header = th("Ceiling (m AMSL)");
    expect(header.getAttribute("aria-sort")).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Ceiling (m AMSL)" }));
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(cells(container, "maxAltAmslM")).toEqual(["100", "200", "300"]);
    fireEvent.click(screen.getByRole("button", { name: "Ceiling (m AMSL)" }));
    expect(header.getAttribute("aria-sort")).toBe("descending");
    expect(cells(container, "maxAltAmslM")).toEqual(["300", "200", "100"]);
    fireEvent.click(screen.getByRole("button", { name: "Ceiling (m AMSL)" }));
    expect(header.getAttribute("aria-sort")).toBe("none");
    expect(ids(container)).toEqual(before);
  });

  it("sorts numbers numerically with the dashes last in both directions", () => {
    const { container } = renderReg({
      rows: altRows([10, 2, null, 100, null, 9]),
    });
    const button = screen.getByRole("button", { name: "Ceiling (m AMSL)" });
    fireEvent.click(button);
    expect(cells(container, "maxAltAmslM")).toEqual([
      "2",
      "9",
      "10",
      "100",
      "—",
      "—",
    ]);
    fireEvent.click(button);
    expect(cells(container, "maxAltAmslM")).toEqual([
      "100",
      "10",
      "9",
      "2",
      "—",
      "—",
    ]);
  });

  it("adds a column with Shift and shows the order; without Shift it replaces", () => {
    const { container } = renderReg({ rows: registrationRows(12) });
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    fireEvent.click(screen.getByRole("button", { name: "Ceiling (m AMSL)" }), {
      shiftKey: true,
    });
    expect(th("Status").getAttribute("aria-sort")).toBe("ascending");
    expect(th("Ceiling (m AMSL)").getAttribute("aria-sort")).toBe("ascending");
    expect(
      [...container.querySelectorAll('[data-part="sort-index"]')].map(
        (e) => e.textContent,
      ),
    ).toEqual(["1", "2"]);
    // An enumeration with values sorts in the order of its values.
    const ranks = cells(container, "status").map((v) =>
      ["Active", "Suspended", "Revoked", "Expired"].indexOf(v),
    );
    expect([...ranks].sort((x, y) => x - y)).toEqual(ranks);
    expect(ranks[0]).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Serial" }));
    expect(th("Status").getAttribute("aria-sort")).toBe("none");
    expect(container.querySelectorAll('[data-part="sort-index"]')).toHaveLength(
      0,
    );
  });

  it("sorts times by instant with an absent time last", () => {
    const rows = registrationRows(3).map((r, i) => ({
      ...r,
      updatedAt:
        ["2026-10-02T10:00:00.5Z", null, "2026-10-02T10:00:00Z"][i] ?? null,
    }));
    const { container } = renderReg({ rows });
    fireEvent.click(screen.getByRole("button", { name: "Updated (UTC)" }));
    expect(ids(container)).toEqual(["reg-00003", "reg-00001", "reg-00002"]);
    expect(cells(container, "updatedAt")[2]).toBe("—");
  });
});

describe("filters", () => {
  it("narrows by text and by an enumeration, and says when nothing matches", () => {
    const { container } = renderReg();
    fireEvent.change(screen.getByLabelText("Filter: Registration number"), {
      target: { value: "00003" },
    });
    expect(ids(container)).toEqual(["reg-00003"]);
    fireEvent.change(screen.getByLabelText("Filter: Registration number"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Filter: Status"), {
      target: { value: "suspended" },
    });
    expect(new Set(cells(container, "status"))).toEqual(new Set(["Suspended"]));
    fireEvent.change(screen.getByLabelText("Filter: Email"), {
      target: { value: "nobody" },
    });
    expect(ids(container)).toEqual([]);
    expect(
      container
        .querySelector("[data-state-kind]")
        ?.getAttribute("data-state-kind"),
    ).toBe("filtered");
    expect(screen.getByText("No rows match the filters")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(ids(container)).toHaveLength(25);
  });

  it("offers no filter for a number or a time column", () => {
    renderReg();
    expect(screen.queryByLabelText(/Filter: Ceiling/)).toBeNull();
    expect(screen.queryByLabelText(/Filter: Updated/)).toBeNull();
  });
});

describe("pagination", () => {
  const ten = { ...initialTableState(10) };

  it("pages within bounds: previous off on the first, next off on the last", () => {
    const { container } = renderReg();
    fireEvent.change(screen.getByLabelText("Rows per page"), {
      target: { value: "10" },
    });
    expect(screen.getByText("Rows 1 to 10 of 30")).toBeTruthy();
    const prev = screen.getByRole("button", {
      name: "Go to the previous page",
    });
    const next = screen.getByRole("button", { name: "Go to the next page" });
    expect((prev as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText("Rows 21 to 30 of 30")).toBeTruthy();
    expect(screen.getByText("Page 3 of 3")).toBeTruthy();
    expect((next as HTMLButtonElement).disabled).toBe(true);
    expect(ids(container)[0]).toBe("reg-00021");
    fireEvent.click(prev);
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  });

  it("clamps a page past the end to the last page", () => {
    renderReg({
      state: { ...ten, pagination: { pageIndex: 99, pageSize: 10 } },
    });
    expect(screen.getByText("Page 3 of 3")).toBeTruthy();
    expect(screen.getByText("Rows 21 to 30 of 30")).toBeTruthy();
  });

  it("returns to the first page when the sort changes, and reports state to the app", () => {
    const seen: TableState[] = [];
    const { rerender } = renderReg({
      state: { ...ten, pagination: { pageIndex: 2, pageSize: 10 } },
      onStateChange: (s) => seen.push(s),
    });
    fireEvent.click(screen.getByRole("button", { name: "Serial" }));
    expect(seen.at(-1)?.pagination.pageIndex).toBe(0);
    expect(seen.at(-1)?.sorting).toEqual([{ id: "serial", desc: false }]);
    rerender(<></>);
  });

  it("offers a page size the app chose even when it is not in the list", () => {
    renderReg({ state: initialTableState(7) });
    const select = screen.getByLabelText("Rows per page") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toContain("7");
    expect(screen.getByText("Rows 1 to 7 of 30")).toBeTruthy();
  });
});

describe("columns", () => {
  it("hides a column from the column list and shows it again", () => {
    const { container } = renderReg();
    const toggle = container.querySelector<HTMLInputElement>(
      '[data-column-toggle="serial"]',
    );
    if (toggle === null) throw new Error("no toggle");
    fireEvent.click(toggle);
    expect(container.querySelector('td[data-column="serial"]')).toBeNull();
    fireEvent.click(toggle);
    expect(container.querySelector('td[data-column="serial"]')).not.toBeNull();
  });

  it("ignores and counts state for a column the table does not have", () => {
    const { container } = renderReg({
      state: {
        ...initialTableState(),
        sorting: [{ id: "gone", desc: false }],
        columnFilters: [{ id: "gone_too", value: "x" }],
        columnVisibility: { also_gone: false },
      },
    });
    expect(ids(container)).toHaveLength(25);
    expect(tableCounters().state_unknown_column).toBeGreaterThanOrEqual(3);
  });
});

function focused(): string | null {
  return document.activeElement?.getAttribute("data-grid-cell") ?? null;
}

function key(k: string, mods: Record<string, boolean> = {}) {
  const el = document.activeElement;
  if (el === null) throw new Error("nothing focused");
  fireEvent.keyDown(el, { key: k, ...mods });
}

function startAt(container: HTMLElement, cell: string) {
  const el = container.querySelector<HTMLElement>(`[data-grid-cell="${cell}"]`);
  if (el === null) throw new Error(`no cell ${cell}`);
  act(() => {
    el.focus();
  });
}

describe("keyboard (WAI-ARIA APG data grid)", () => {
  // 7 columns (no selection column), 30 rows, 25 on the page.
  it.each([
    ["ArrowDown", "0:0", {}, "1:0"],
    ["ArrowRight", "1:0", {}, "1:1"],
    ["ArrowLeft", "1:1", {}, "1:0"],
    ["ArrowUp", "1:0", {}, "0:0"],
    ["End", "3:2", {}, "3:6"],
    ["Home", "3:2", {}, "3:0"],
    ["PageDown", "1:2", {}, "11:2"],
    ["PageUp", "15:2", {}, "5:2"],
    ["End", "3:2", { ctrlKey: true }, "25:6"],
    ["Home", "3:2", { ctrlKey: true }, "0:0"],
  ])("%s from %s (%o) goes to %s", (k, from, mods, to) => {
    const { container } = renderReg();
    startAt(container, from);
    key(k, mods);
    expect(focused()).toBe(to);
  });

  it("keeps one tab stop in the grid, and it follows focus", () => {
    const { container } = renderReg();
    const stops = () =>
      [...container.querySelectorAll('table [tabindex="0"]')].map((e) =>
        e.getAttribute("data-grid-cell"),
      );
    expect(stops()).toEqual(["0:0"]);
    startAt(container, "0:0");
    key("ArrowDown");
    key("ArrowRight");
    expect(stops()).toEqual(["1:1"]);
    // A click (focus) moves the tab stop too.
    startAt(container, "4:3");
    expect(stops()).toEqual(["4:3"]);
  });

  it("Enter on a row calls onSelect with it; an arrow does not (pair)", () => {
    const onSelect = vi.fn();
    const { container } = renderReg({ onSelect, selectedId: "reg-00002" });
    startAt(container, "1:0");
    key("ArrowDown");
    expect(onSelect).not.toHaveBeenCalled();
    key("Enter");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect((onSelect.mock.calls[0]?.[0] as RegistrationRow).id).toBe(
      "reg-00002",
    );
    const row = container.querySelector('tr[data-row-id="reg-00002"]');
    expect(row?.getAttribute("aria-selected")).toBe("true");
    expect(
      container
        .querySelector('tr[data-row-id="reg-00001"]')
        ?.getAttribute("aria-selected"),
    ).toBe("false");
  });

  it("a click on a row selects it; a click on a control in it does not", () => {
    const onSelect = vi.fn();
    const { container } = renderReg({ onSelect });
    const cell = container.querySelector<HTMLElement>(
      'tr[data-row-id="reg-00004"] td',
    );
    if (cell === null) throw new Error("no cell");
    fireEvent.click(cell);
    expect(onSelect).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Serial" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("Enter on a header sorts; with Shift it adds to the sort", () => {
    const { container } = renderReg();
    startAt(container, "0:2");
    key("Enter");
    expect(th("Status").getAttribute("aria-sort")).toBe("ascending");
    key("ArrowRight");
    key("ArrowRight");
    key("Enter", { shiftKey: true });
    expect(th("Status").getAttribute("aria-sort")).toBe("ascending");
    expect(th("Mass (kg)").getAttribute("aria-sort")).toBe("ascending");
  });

  it("Enter on a body row without onSelect does nothing", () => {
    const { container } = renderReg();
    startAt(container, "2:1");
    key("Enter");
    expect(focused()).toBe("2:1");
  });

  it("Space on a cell toggles the row's selection; without selection it only stays put", () => {
    const changes: Record<string, boolean>[] = [];
    const first = renderReg({
      columns: regColumns(true),
      rowSelection: {},
      onRowSelectionChange: (s) => changes.push(s),
    });
    startAt(first.container, "1:1");
    key(" ");
    expect(changes).toEqual([{ "reg-00001": true }]);
    cleanup();
    const second = renderReg();
    startAt(second.container, "1:1");
    key(" ");
    expect(focused()).toBe("1:1");
  });

  it("the selection column's checkboxes take part in the roving focus", () => {
    const changes: Record<string, boolean>[] = [];
    const { container } = renderReg({
      columns: regColumns(true),
      rowSelection: { "reg-00002": true },
      onRowSelectionChange: (s) => changes.push(s),
    });
    startAt(container, "0:1");
    key("ArrowLeft");
    expect(document.activeElement?.getAttribute("role")).toBe("checkbox");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Select every row on this page",
    );
    expect(document.activeElement?.getAttribute("aria-checked")).toBe("mixed");
    key("ArrowDown");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Select row reg-00001",
    );
    fireEvent.click(document.activeElement as HTMLElement);
    expect(changes.at(-1)).toEqual({ "reg-00001": true, "reg-00002": true });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select every row on this page" }),
    );
    // reg-00002 was selected: the page's 25 rows, no more.
    expect(Object.keys(changes.at(-1) ?? {})).toHaveLength(25);
  });

  it("unselects the page from the header checkbox when every row is selected", () => {
    const all = Object.fromEntries(
      registrationRows(25).map((r) => [r.id, true] as const),
    );
    const changes: Record<string, boolean>[] = [];
    renderReg({
      columns: regColumns(true),
      rows: registrationRows(25),
      rowSelection: { ...all, "reg-elsewhere": true },
      onRowSelectionChange: (s) => changes.push(s),
    });
    const box = screen.getByRole("checkbox", {
      name: "Select every row on this page",
    });
    expect(box.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(box);
    expect(changes.at(-1)).toEqual({ "reg-elsewhere": true });
  });

  it("Alt+Right and Alt+Left resize the focused header's column", () => {
    const { container } = renderReg();
    startAt(container, "0:1");
    const header = th("Serial");
    const width = parseFloat(header.style.width);
    key("ArrowRight", { altKey: true });
    expect(parseFloat(header.style.width)).toBe(width + 16);
    key("ArrowLeft", { altKey: true });
    key("ArrowLeft", { altKey: true });
    expect(parseFloat(header.style.width)).toBe(width - 16);
    expect(focused()).toBe("0:1");
  });
});

describe("caption", () => {
  it("is required by the type, and names the grid", () => {
    const props = { columns: [], rows: [], getRowId: () => "", empty: null };
    // @ts-expect-error a table without a caption does not type-check
    const element = <DataTable {...props} />;
    expect(element).toBeTruthy();
    renderReg({ captionHidden: true });
    const grid = screen.getByRole("grid", { name: "Registered aircraft" });
    expect(grid.querySelector("caption")?.className).toContain("sr-only");
  });
});

describe("states that say why (E-02), each with axe", () => {
  const cases: [string, RegProps, string, RegExp | null][] = [
    ["rows", {}, "rows", /Rows 1 to 25 of 30/],
    ["empty", { rows: [] }, "empty", /No registrations yet/],
    ["loading", { rows: [], loading: true }, "loading", /Loading/],
    [
      "error",
      { rows: [], error: REFUSED, retryAfterS: 30 },
      "error",
      /CIS data out of date \(status 503\).*not been refreshed.*wait 30 seconds/,
    ],
    [
      "error without Retry-After",
      { rows: [], error: { ...REFUSED, detail: null } },
      "error",
      /CIS data out of date \(status 503\)/,
    ],
    ["refreshing over rows", { loading: true }, "rows", /Refreshing/],
    [
      "error over rows (the last rows stay, dimmed)",
      { error: REFUSED, retryAfterS: 1 },
      "rows",
      /wait 1 second before/,
    ],
    [
      "freshness",
      { freshness: FRESHNESS, staleAfterS: 300 },
      "rows",
      /As of version 42.*updated 2026-10-02 09:14 UTC/,
    ],
    [
      "stale freshness",
      {
        freshness: { ...FRESHNESS, stale: true, version: null },
        staleAfterS: null,
      },
      "rows",
      /As of version "v42".*Stale, as the server reports/,
    ],
  ];

  it.each(cases)("%s", async (_name, props, kind, text) => {
    const { container } = renderReg(props);
    const root = container.querySelector("[data-table]");
    expect(root?.getAttribute("data-state-kind")).toBe(kind);
    if (text !== null) expect(root?.textContent).toMatch(text);
    await axeCheck(container);
  });

  it("shows skeleton rows only on the first load, not over rows (pair)", () => {
    const first = renderReg({ rows: [], loading: true });
    expect(
      first.container.querySelectorAll('[data-part="skeleton"]').length,
    ).toBeGreaterThan(0);
    expect(
      first.container.querySelector("table")?.getAttribute("aria-busy"),
    ).toBe("true");
    cleanup();
    const second = renderReg({ loading: true });
    expect(
      second.container.querySelectorAll('[data-part="skeleton"]'),
    ).toHaveLength(0);
  });

  it("dims the last rows under an error and not without one (pair)", () => {
    const first = renderReg({ error: REFUSED });
    expect(first.container.querySelector("table")?.className).toContain(
      "opacity-60",
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    cleanup();
    const second = renderReg();
    expect(second.container.querySelector("table")?.className).not.toContain(
      "opacity-60",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("dense mode, toolbar off", () => {
    const { container } = renderReg({ dense: true, toolbar: false });
    expect(container.querySelector('[data-part="filters"]')).toBeNull();
    expect(container.querySelector("td")?.className).toContain("py-1");
  });
});

describe("Georgian", () => {
  it("names the unit and UTC in the headers and pages in Georgian", async () => {
    const { container } = renderReg({ lang: "ka" });
    expect(
      screen.getByRole("button", { name: "ჭერი (მ ზღვის დონიდან)" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "განახლდა (UTC)" })).toBeTruthy();
    expect(screen.getByText("გვერდი 1 / 2")).toBeTruthy();
    expect(screen.getByLabelText("ფილტრი: სტატუსი")).toBeTruthy();
    await axeCheck(container);
  });
});

describe("virtualisation", () => {
  function stubLayout() {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(480);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1000);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 41,
      right: 1000,
      width: 1000,
      height: 41,
      toJSON: () => ({}),
    });
  }

  it("virtualises above 200 rows: 10 000 rows render at most 60, and the end renders the last", () => {
    stubLayout();
    const { container } = renderReg({ rows: registrationRows(10_000) });
    const root = container.querySelector("[data-table]");
    expect(root?.getAttribute("data-virtual")).toBe("true");
    const rendered = ids(container);
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThanOrEqual(60);
    expect(
      container.querySelector("table")?.getAttribute("aria-rowcount"),
    ).toBe("10001");
    expect(container.querySelector('[data-part="pager"]')).toBeNull();
    const scroller = container.querySelector<HTMLElement>(
      '[data-part="scroll"]',
    );
    if (scroller === null) throw new Error("no scroller");
    act(() => {
      // Past the end; the browser would clamp, the virtualiser does too.
      scroller.scrollTop = 1e9;
      fireEvent.scroll(scroller);
    });
    const end = ids(container);
    expect(end.at(-1)).toBe("reg-10000");
    expect(end.length).toBeLessThanOrEqual(60);
    const last = container.querySelector('tr[data-row-id="reg-10000"]');
    expect(last?.getAttribute("aria-rowindex")).toBe("10001");
  });

  it("stays paged at 200 rows, and virtualises on request below it (pair)", () => {
    const first = renderReg({ rows: registrationRows(200) });
    expect(
      first.container
        .querySelector("[data-table]")
        ?.getAttribute("data-virtual"),
    ).toBe("false");
    cleanup();
    stubLayout();
    const second = renderReg({ rows: registrationRows(50), virtualize: true });
    expect(
      second.container
        .querySelector("[data-table]")
        ?.getAttribute("data-virtual"),
    ).toBe("true");
  });

  it("Ctrl+End scrolls to the last row and focuses it", () => {
    stubLayout();
    const { container } = renderReg({ rows: registrationRows(1000) });
    startAt(container, "0:0");
    key("End", { ctrlKey: true });
    // The virtualiser scrolls; the row renders, then takes focus.
    // jsdom has no scrolling, so the scroll the virtualiser asked for is
    // played here; the browser story runs the real one.
    const scroller = container.querySelector<HTMLElement>(
      '[data-part="scroll"]',
    );
    act(() => {
      (scroller as HTMLElement).scrollTop = 1e9;
      fireEvent.scroll(scroller as HTMLElement);
    });
    expect(
      container.querySelector('tr[data-row-id="reg-01000"]'),
    ).not.toBeNull();
    expect(focused()).toBe("1000:6");
  });
});

describe("column helpers in cells", () => {
  const p = columnsFor<PictureRow>();
  const pictureColumns = (staleAfterS: number | null) => [
    p.severity(),
    p.trust(),
    p.ident(),
    p.age(PICTURE_NOW_MS, {
      ageS: (r, now) =>
        r.receivedAtMs === null ? null : (now - r.receivedAtMs) / 1000,
      staleAfterS,
    }),
    p.enum("kind", "pic.kind", { headerKey: "pic.kind" }),
  ];

  function renderPicture(lang: Lang = "en", staleAfterS: number | null = 30) {
    return wrap(
      <DataTable<PictureRow>
        caption="Alerts"
        columns={pictureColumns(staleAfterS)}
        rows={pictureRows()}
        getRowId={(r) => r.id}
        empty={null}
      />,
      lang,
    );
  }

  const row = (container: HTMLElement, id: string) => {
    const tr = container.querySelector<HTMLElement>(`tr[data-row-id="${id}"]`);
    if (tr === null) throw new Error(`no row ${id}`);
    return within(tr);
  };

  it("says broadcast and unverified for a broadcast track and an as-broadcast registration (R-05)", () => {
    const { container } = renderPicture();
    const p2 = row(container, "p2");
    expect(p2.getByText("broadcast and unverified")).toBeTruthy();
    expect(
      p2.getByText("registered, as broadcast and unverified"),
    ).toBeTruthy();
    const p1 = row(container, "p1");
    expect(p1.getByText("Authenticated")).toBeTruthy();
    expect(p1.getByText("registered")).toBeTruthy();
    expect(p1.queryByText(/unverified/)).toBeNull();
  });

  it("never shows a registered mismatch as registered (G-02)", () => {
    const { container } = renderPicture();
    const tr = container.querySelector('tr[data-row-id="p4"]');
    const cell = tr?.querySelector("[data-ident]");
    expect(cell?.getAttribute("data-ident")).toBe("unknown_operator");
    expect(cell?.firstElementChild?.textContent).toBe("unknown operator");
    expect(tr?.textContent).toMatch(/as broadcast and unverified/);
  });

  it("names the provider caveat and shows no identification as its own status", () => {
    const { container } = renderPicture();
    expect(
      row(container, "p3").getByText(/^Reported by a provider, unverified/),
    ).toBeTruthy();
    expect(row(container, "p5").getByText("no identification")).toBeTruthy();
  });

  it("shows a dash, labelled unknown, for every null, and an age bucket under the threshold", () => {
    const { container } = renderPicture();
    const p4 = container.querySelector('tr[data-row-id="p4"]');
    expect(
      p4?.querySelectorAll('[aria-label="unknown"]').length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      container
        .querySelector('tr[data-row-id="p1"] [data-age]')
        ?.getAttribute("data-age"),
    ).toBe("live");
    expect(
      container
        .querySelector('tr[data-row-id="p2"] [data-age]')
        ?.getAttribute("data-age"),
    ).toBe("stale");
    expect(
      row(container, "p1").getByText("Height limit exceeded"),
    ).toBeTruthy();
  });

  it("shows the raw age without a bucket when no threshold was sent (the twin)", () => {
    const { container } = renderPicture("en", null);
    expect(
      container
        .querySelector('tr[data-row-id="p2"] [data-age]')
        ?.getAttribute("data-age"),
    ).toBe("unknown");
    expect(
      container.querySelector('tr[data-row-id="p2"] [data-age]')?.textContent,
    ).toBe("45 s");
  });

  it("sorts severity critical first when descending and trust in legend order, nulls last", () => {
    const { container } = renderPicture();
    const sev = screen.getByRole("button", { name: "Severity" });
    fireEvent.click(sev);
    fireEvent.click(sev);
    expect(ids(container)).toEqual(["p1", "p2", "p5", "p3", "p4"]);
    fireEvent.click(screen.getByRole("button", { name: "Trust" }));
    expect(ids(container)).toEqual(["p1", "p3", "p2", "p4", "p5"]);
    fireEvent.click(screen.getByRole("button", { name: "Identification" }));
    expect(ids(container).at(-1)).toBe("p5");
  });

  it("filters by severity, trust and identification from their own options", () => {
    const { container } = renderPicture();
    fireEvent.change(screen.getByLabelText("Filter: Trust"), {
      target: { value: "broadcast" },
    });
    expect(ids(container)).toEqual(["p2", "p4"]);
    fireEvent.change(screen.getByLabelText("Filter: Identification"), {
      target: { value: "unknown_operator" },
    });
    expect(ids(container)).toEqual(["p4"]);
    const sev = screen.getByLabelText("Filter: Severity") as HTMLSelectElement;
    expect([...sev.options].map((o) => o.textContent)).toEqual([
      "All",
      "Information",
      "Warning",
      "Critical",
    ]);
  });

  it.each(["en", "ka"] as const)(
    "is axe-clean with every helper, %s",
    async (lang) => {
      const { container } = renderPicture(lang);
      await axeCheck(container);
      if (lang === "ka")
        expect(container.textContent).toMatch(/დაუდასტურებელი/);
    },
  );
});

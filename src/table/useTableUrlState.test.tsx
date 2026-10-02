// useTableUrlState with a DataTable (WP-9, PLAN §7; spec 06 §5): a sort
// lands in the URL; a filter on `email` does not and still filters, while
// the twin filter on `status` lands; malformed URL state is ignored and
// counted, never thrown; a PII filter in a URL is not applied. The URL is
// restored after each test (E-11).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { I18nProvider } from "../i18n/I18nProvider.js";
import { UNIT_KEYS, columnsFor } from "./columns.js";
import { resetTableCountersForTests, tableCounters } from "./counters.js";
import { DataTable } from "./DataTable.js";
import {
  APP_CATALOGUES,
  REG_STATUSES,
  registrationRows,
  type RegistrationRow,
} from "./fixtures.testing.js";
import { useTableUrlState } from "./useTableUrlState.js";

const START = "/registry?tab=aircraft#list";

beforeEach(() => {
  window.history.replaceState(null, "", START);
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  resetTableCountersForTests();
});

const c = columnsFor<RegistrationRow>();
const COLUMNS = [
  c.text("regNumber", { headerKey: "reg.regNumber" }),
  c.enum("status", "reg.status", {
    values: REG_STATUSES,
    headerKey: "reg.status",
  }),
  c.text("email", { headerKey: "reg.email" }),
  c.num("maxAltAmslM", UNIT_KEYS.m_amsl, 0, { headerKey: "reg.maxAltAmslM" }),
];

function Registry() {
  const [state, setState] = useTableUrlState("reg");
  return (
    <DataTable<RegistrationRow>
      caption="Registered aircraft"
      columns={COLUMNS}
      rows={registrationRows(60)}
      getRowId={(r) => r.id}
      empty={null}
      state={state}
      onStateChange={setState}
    />
  );
}

function renderRegistry() {
  return render(
    <I18nProvider lang="en" catalogues={APP_CATALOGUES}>
      <Registry />
    </I18nProvider>,
  );
}

const search = () => new URLSearchParams(window.location.search);
const rowIds = (root: HTMLElement) =>
  [...root.querySelectorAll("tbody tr[data-row-id]")].map((tr) =>
    tr.getAttribute("data-row-id"),
  );

describe("useTableUrlState", () => {
  it("writes a sort and a page to the URL, keeping the path, other parameters and the hash", () => {
    renderRegistry();
    fireEvent.click(screen.getByRole("button", { name: "Ceiling (m AMSL)" }));
    expect(search().get("reg.sort")).toBe("maxAltAmslM:asc");
    fireEvent.click(
      screen.getByRole("button", { name: "Go to the next page" }),
    );
    expect(search().get("reg.page")).toBe("2");
    expect(search().get("tab")).toBe("aircraft");
    expect(window.location.pathname).toBe("/registry");
    expect(window.location.hash).toBe("#list");
  });

  it("filters by email in memory and never writes it; the status twin is written", () => {
    const { container } = renderRegistry();
    fireEvent.change(screen.getByLabelText("Filter: Email"), {
      target: { value: "pilot00007@" },
    });
    expect(rowIds(container)).toEqual(["reg-00007"]);
    expect(window.location.href).not.toMatch(/email|pilot00007/);
    expect(tableCounters().pii_filter_in_memory).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Filter: Status"), {
      target: { value: "revoked" },
    });
    expect(search().get("reg.filter.status")).toBe("revoked");
    expect(window.location.href).not.toMatch(/email|pilot00007/);
  });

  it("reads its state back on mount, as a shared link would", () => {
    window.history.replaceState(
      null,
      "",
      "/registry?reg.sort=maxAltAmslM:desc&reg.filter.status=suspended&reg.size=10",
    );
    const { container } = renderRegistry();
    expect(
      screen
        .getByRole("button", { name: "Ceiling (m AMSL)" })
        .closest("th")
        ?.getAttribute("aria-sort"),
    ).toBe("descending");
    expect(rowIds(container)).toHaveLength(10);
    expect(
      (screen.getByLabelText("Filter: Status") as HTMLSelectElement).value,
    ).toBe("suspended");
  });

  it("ignores and counts malformed URL state and a PII filter in the URL, without throwing", () => {
    window.history.replaceState(
      null,
      "",
      "/registry?reg.page=minus-one&reg.sort=maxAltAmslM:up&reg.size=0&reg.filter.email=pilot00007%40example.test",
    );
    const { container } = renderRegistry();
    expect(rowIds(container)).toHaveLength(25);
    expect(rowIds(container)[0]).toBe("reg-00001");
    expect(tableCounters().url_state_malformed).toBe(3);
    expect(tableCounters().url_pii_refused).toBe(1);
    expect(
      (screen.getByLabelText("Filter: Email") as HTMLInputElement).value,
    ).toBe("");
  });

  it("refuses a key that cannot prefix parameters", () => {
    function Bad() {
      useTableUrlState("bad.key");
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/table state key/);
  });

  it("drops the query string when nothing is left to write", () => {
    window.history.replaceState(null, "", "/registry?reg.sort=status:asc");
    renderRegistry();
    const status = screen.getByRole("button", { name: "Status" });
    fireEvent.click(status);
    fireEvent.click(status);
    expect(window.location.search).toBe("");
  });
});

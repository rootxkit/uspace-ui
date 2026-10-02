import { within } from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import { expect } from "vitest";
import { userEvent } from "vitest/browser";

import { I18nProvider, useLang, useT } from "../../src/i18n/index.js";
import type { LiveSourceView } from "../../src/live/sourceStore.js";
import { SourceStateBadge } from "../../src/status/index.js";
import {
  DataTable,
  UNIT_KEYS,
  columnsFor,
  kitColumnMeta,
  tableColumn,
  type TableColumn,
} from "../../src/table/index.js";
import {
  APP_CATALOGUES,
  FRESHNESS,
  REFUSED,
  REG_STATUSES,
  deliveryRows,
  registrationRows,
  type DeliveryRow,
  type RegistrationRow,
} from "../../src/table/fixtures.testing.js";
import { FIXED_NOW_MS, fixtureSources } from "../live/status.js";

// WP-9: the data table with a registry-shaped list (GEO-TEST-* numbers),
// a sources list with every SourceState, a deliveries list with its
// freshness and with a refused read, the empty state and 10 000 rows
// virtualised. Both languages, both schemes; the tests drive the keyboard
// of the APG data grid in a real browser. Shared by DataTable.test.tsx and
// the golden set.

const reg = columnsFor<RegistrationRow>();

function registryColumns(): TableColumn<RegistrationRow>[] {
  return [
    reg.select(),
    reg.text("regNumber", { headerKey: "reg.regNumber", mono: true }),
    reg.text("serial", { headerKey: "reg.serial", mono: true }),
    reg.enum("status", "reg.status", {
      values: REG_STATUSES,
      headerKey: "reg.status",
    }),
    reg.text("email", { headerKey: "reg.email" }),
    reg.num("massKg", UNIT_KEYS.kg, 2, { headerKey: "reg.massKg" }),
    reg.num("maxAltAmslM", UNIT_KEYS.m_amsl, 0, {
      headerKey: "reg.maxAltAmslM",
    }),
    reg.utc("updatedAt", { headerKey: "reg.updatedAt" }),
  ];
}

function Empty() {
  const t = useT();
  return <p className="m-0">{t("reg.empty")}</p>;
}

export function Registry(props: {
  rows?: number;
  onSelect?: (r: RegistrationRow) => void;
}) {
  const rows = useMemo(() => registrationRows(props.rows ?? 30), [props.rows]);
  const columns = useMemo(() => registryColumns(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const t = useT();
  return (
    <div data-testid="registry">
      <DataTable<RegistrationRow>
        caption={t("reg.caption")}
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        empty={<Empty />}
        selectedId={selected}
        onSelect={(r) => {
          setSelected(r.id);
          props.onSelect?.(r);
        }}
        rowSelection={checked}
        onRowSelectionChange={setChecked}
      />
    </div>
  );
}

export function SourcesTable() {
  const sources = useMemo(() => fixtureSources(), []);
  const c = columnsFor<LiveSourceView>();
  const columns: TableColumn<LiveSourceView>[] = [
    c.text("sourceType", { headerKey: "table.test.source_type", mono: true }),
    c.text("instanceId", { headerKey: "table.test.instance", mono: true }),
    tableColumn<LiveSourceView, string>({
      id: "state",
      accessorFn: (s) => s.state,
      meta: kitColumnMeta({ headerKey: "table.test.state" }),
      cell: (ctx) => (
        <SourceStateBadge
          source={ctx.row.original}
          nowMs={FIXED_NOW_MS + 5000}
        />
      ),
    }),
  ];
  const t = useT();
  return (
    <div data-testid="sources">
      <DataTable<LiveSourceView>
        caption={t("table.test.sources")}
        columns={columns}
        rows={sources}
        getRowId={(s) => `${s.sourceType}/${s.instanceId ?? "*"}`}
        empty={null}
        toolbar={false}
      />
    </div>
  );
}

export function Deliveries(props: { error?: boolean }) {
  const rows = useMemo(() => deliveryRows(), []);
  const c = columnsFor<DeliveryRow>();
  const columns = [
    c.text("subscriber", { headerKey: "dlv.subscriber", mono: true }),
    c.text("dataset", { headerKey: "dlv.dataset", mono: true }),
    c.text("version", { headerKey: "dlv.version" }),
    c.utc("deliveredAt", { headerKey: "dlv.deliveredAt" }),
    c.num("latencyS", UNIT_KEYS.s, 1, { headerKey: "dlv.latencyS" }),
    c.enum("state", "dlv.state", {
      values: ["delivered", "pending", "failed"],
      headerKey: "dlv.state",
    }),
  ];
  const t = useT();
  return (
    <div data-testid="deliveries">
      <DataTable<DeliveryRow>
        caption={t("table.test.deliveries")}
        columns={columns}
        rows={props.error === true ? [] : rows}
        getRowId={(r) => r.id}
        empty={null}
        error={props.error === true ? REFUSED : null}
        retryAfterS={props.error === true ? 30 : null}
        freshness={FRESHNESS}
        staleAfterS={300}
        dense
      />
    </div>
  );
}

// The test-only words: the sources and deliveries captions and headers.
const TEST_CATALOGUES = {
  en: {
    "table.test.sources": "Sources",
    "table.test.deliveries": "Deliveries of the zone dataset",
    "table.test.source_type": "Source type",
    "table.test.instance": "Instance",
    "table.test.state": "State",
  },
  ka: {
    "table.test.sources": "წყაროები",
    "table.test.deliveries": "ზონების ნაკრების მიწოდებები",
    "table.test.source_type": "წყაროს ტიპი",
    "table.test.instance": "ეგზემპლარი",
    "table.test.state": "მდგომარეობა",
  },
};

export function WithCatalogues(props: { children: ReactNode }) {
  const { lang } = useLang();
  return (
    <I18nProvider
      lang={lang}
      catalogues={{
        en: { ...APP_CATALOGUES.en, ...TEST_CATALOGUES.en },
        ka: { ...APP_CATALOGUES.ka, ...TEST_CATALOGUES.ka },
      }}
    >
      {props.children}
    </I18nProvider>
  );
}

export const LOST = /lost|დაკარგ/i;

/** The registry's first page, and a sort that cycles back to none. */
export async function checkRegistry(
  canvasElement: HTMLElement,
  caption: string,
  sortName: RegExp,
): Promise<void> {
  const root = within(within(canvasElement).getByTestId("registry"));
  const grid = root.getByRole("grid", { name: caption });
  expect(grid.querySelectorAll("tbody tr[data-row-id]")).toHaveLength(25);
  const button = root.getByRole("button", { name: sortName });
  const header = button.closest("th");
  expect(header?.getAttribute("aria-sort")).toBe("none");
  await userEvent.click(button);
  expect(header?.getAttribute("aria-sort")).toBe("ascending");
  await userEvent.click(button);
  await userEvent.click(button);
  expect(header?.getAttribute("aria-sort")).toBe("none");
  expect(grid.textContent).not.toMatch(LOST);
}

export function checkSourcesTable(canvasElement: HTMLElement): void {
  const root = within(canvasElement).getByTestId("sources");
  const states = [...root.querySelectorAll("[data-source-state]")].map((e) =>
    e.getAttribute("data-source-state"),
  );
  expect(new Set(states)).toEqual(
    new Set([
      "disabled",
      "healthy",
      "stale",
      "lagging",
      "unreachable",
      "never_heard",
    ]),
  );
  expect(root.textContent).not.toMatch(LOST);
}

export function checkDeliveries(
  canvasElement: HTMLElement,
  version: RegExp,
): void {
  const root = within(canvasElement).getByTestId("deliveries");
  const footer = root.querySelector('[data-part="freshness"]');
  expect(footer?.textContent).toMatch(version);
  expect(footer?.querySelector("[data-age]")).not.toBeNull();
  expect(root.textContent).toMatch(/UTC/);
}

export function checkError(canvasElement: HTMLElement, retry: RegExp): void {
  const root = within(canvasElement).getByTestId("deliveries");
  const alert = within(root).getByRole("alert");
  expect(alert.textContent).toMatch(/503/);
  expect(alert.textContent).toMatch(retry);
}

export function checkEmpty(canvasElement: HTMLElement, text: RegExp): void {
  const root = within(canvasElement).getByTestId("registry");
  expect(
    root.querySelector("[data-table]")?.getAttribute("data-state-kind"),
  ).toBe("empty");
  expect(root.textContent).toMatch(text);
}

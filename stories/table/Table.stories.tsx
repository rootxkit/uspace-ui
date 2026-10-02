import { useMemo, useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

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
import { STORY_NOW_MS, storySources } from "../live/status.js";

// WP-9: the data table with a registry-shaped list (GEO-TEST-* numbers),
// a sources list with every SourceState, a deliveries list with its
// freshness and with a refused read, the empty state and 10 000 rows
// virtualised. Both languages, both schemes; the play functions drive the
// keyboard of the APG data grid in a real browser.

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

function Registry(props: {
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

function SourcesTable() {
  const sources = useMemo(() => storySources(), []);
  const c = columnsFor<LiveSourceView>();
  const columns: TableColumn<LiveSourceView>[] = [
    c.text("sourceType", { headerKey: "table.story.source_type", mono: true }),
    c.text("instanceId", { headerKey: "table.story.instance", mono: true }),
    tableColumn<LiveSourceView, string>({
      id: "state",
      accessorFn: (s) => s.state,
      meta: kitColumnMeta({ headerKey: "table.story.state" }),
      cell: (ctx) => (
        <SourceStateBadge
          source={ctx.row.original}
          nowMs={STORY_NOW_MS + 5000}
        />
      ),
    }),
  ];
  const t = useT();
  return (
    <div data-testid="sources">
      <DataTable<LiveSourceView>
        caption={t("table.story.sources")}
        columns={columns}
        rows={sources}
        getRowId={(s) => `${s.sourceType}/${s.instanceId ?? "*"}`}
        empty={null}
        toolbar={false}
      />
    </div>
  );
}

function Deliveries(props: { error?: boolean }) {
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
        caption={t("table.story.deliveries")}
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

// The story-only words: the sources and deliveries captions and headers.
const STORY_CATALOGUES = {
  en: {
    "table.story.sources": "Sources",
    "table.story.deliveries": "Deliveries of the zone dataset",
    "table.story.source_type": "Source type",
    "table.story.instance": "Instance",
    "table.story.state": "State",
  },
  ka: {
    "table.story.sources": "წყაროები",
    "table.story.deliveries": "ზონების ნაკრების მიწოდებები",
    "table.story.source_type": "წყაროს ტიპი",
    "table.story.instance": "ეგზემპლარი",
    "table.story.state": "მდგომარეობა",
  },
};

function WithStory(props: { children: ReactNode }) {
  const { lang } = useLang();
  return (
    <I18nProvider
      lang={lang}
      catalogues={{
        en: { ...APP_CATALOGUES.en, ...STORY_CATALOGUES.en },
        ka: { ...APP_CATALOGUES.ka, ...STORY_CATALOGUES.ka },
      }}
    >
      {props.children}
    </I18nProvider>
  );
}

const meta = {
  title: "table/DataTable",
  component: Registry,
  decorators: [
    (Story) => (
      <WithStory>
        <Story />
      </WithStory>
    ),
  ],
} satisfies Meta<typeof Registry>;

export default meta;

const LOST = /lost|დაკარგ/i;

const registryPlay =
  (caption: string, sortName: RegExp): NonNullable<StoryObj["play"]> =>
  async ({ canvasElement }) => {
    const root = within(within(canvasElement).getByTestId("registry"));
    const grid = root.getByRole("grid", { name: caption });
    await expect(grid.querySelectorAll("tbody tr[data-row-id]")).toHaveLength(
      25,
    );
    const button = root.getByRole("button", { name: sortName });
    const header = button.closest("th");
    await expect(header?.getAttribute("aria-sort")).toBe("none");
    await userEvent.click(button);
    await expect(header?.getAttribute("aria-sort")).toBe("ascending");
    await userEvent.click(button);
    await userEvent.click(button);
    await expect(header?.getAttribute("aria-sort")).toBe("none");
    await expect(grid.textContent).not.toMatch(LOST);
  };

export const RegistryEnglishLight: StoryObj = {
  render: () => <Registry />,
  globals: { lang: "en", scheme: "light" },
  play: registryPlay("Registered aircraft", /^Ceiling \(m AMSL\)$/),
};

export const RegistryGeorgianDark: StoryObj = {
  render: () => <Registry />,
  globals: { lang: "ka", scheme: "dark" },
  play: registryPlay(
    "რეგისტრირებული საჰაერო ხომალდები",
    /^ჭერი \(მ ზღვის დონიდან\)$/,
  ),
};

const selected = fn();

export const RegistryKeyboard: StoryObj = {
  render: () => <Registry onSelect={selected} />,
  globals: { lang: "en", scheme: "light" },
  play: async ({ canvasElement }) => {
    selected.mockClear();
    const root = within(canvasElement);
    const grid = root.getByRole("grid");
    // The grid has one tab stop (roving tabindex): the select-all box.
    const stops = grid.querySelectorAll<HTMLElement>('[tabindex="0"]');
    await expect(stops).toHaveLength(1);
    stops[0]?.focus();
    const active = () => canvasElement.ownerDocument.activeElement;
    await userEvent.keyboard("{Control>}{Home}{/Control}");
    await expect(active()?.getAttribute("data-grid-cell")).toBe("0:0");
    await userEvent.keyboard("{ArrowDown}{ArrowRight}");
    await expect(active()?.getAttribute("data-grid-cell")).toBe("1:1");
    await expect(selected).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await expect(selected).toHaveBeenCalledTimes(1);
    await expect(
      grid
        .querySelector('tr[data-row-id="reg-00001"]')
        ?.getAttribute("aria-selected"),
    ).toBe("true");
    // Space on the row's checkbox toggles it (the browser's own button).
    await userEvent.keyboard("{ArrowLeft}");
    await expect(active()?.getAttribute("role")).toBe("checkbox");
    await userEvent.keyboard(" ");
    await expect(active()?.getAttribute("aria-checked")).toBe("true");
    await userEvent.keyboard("{PageDown}");
    await expect(active()?.getAttribute("data-grid-cell")).toBe("11:0");
    await userEvent.keyboard("{End}");
    await expect(active()?.getAttribute("data-grid-cell")).toBe("11:7");
  },
};

const sourcesPlay: StoryObj["play"] = async ({ canvasElement }) => {
  const root = within(canvasElement).getByTestId("sources");
  const states = [...root.querySelectorAll("[data-source-state]")].map((e) =>
    e.getAttribute("data-source-state"),
  );
  await expect(new Set(states)).toEqual(
    new Set([
      "disabled",
      "healthy",
      "stale",
      "lagging",
      "unreachable",
      "never_heard",
    ]),
  );
  await expect(root.textContent).not.toMatch(LOST);
};

export const SourcesEnglishLight: StoryObj = {
  render: () => <SourcesTable />,
  globals: { lang: "en", scheme: "light" },
  play: sourcesPlay,
};

export const SourcesGeorgianDark: StoryObj = {
  render: () => <SourcesTable />,
  globals: { lang: "ka", scheme: "dark" },
  play: sourcesPlay,
};

const deliveriesPlay =
  (version: RegExp): NonNullable<StoryObj["play"]> =>
  async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId("deliveries");
    const footer = root.querySelector('[data-part="freshness"]');
    await expect(footer?.textContent).toMatch(version);
    await expect(footer?.querySelector("[data-age]")).not.toBeNull();
    await expect(root.textContent).toMatch(/UTC/);
  };

export const DeliveriesEnglishLight: StoryObj = {
  render: () => <Deliveries />,
  globals: { lang: "en", scheme: "light" },
  play: deliveriesPlay(/As of version 42/),
};

export const DeliveriesGeorgianDark: StoryObj = {
  render: () => <Deliveries />,
  globals: { lang: "ka", scheme: "dark" },
  play: deliveriesPlay(/ვერსია 42/),
};

const errorPlay =
  (retry: RegExp): NonNullable<StoryObj["play"]> =>
  async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId("deliveries");
    const alert = within(root).getByRole("alert");
    await expect(alert.textContent).toMatch(/503/);
    await expect(alert.textContent).toMatch(retry);
  };

export const DeliveriesErrorEnglishLight: StoryObj = {
  render: () => <Deliveries error />,
  globals: { lang: "en", scheme: "light" },
  play: errorPlay(/wait 30 seconds/),
};

export const DeliveriesErrorGeorgianDark: StoryObj = {
  render: () => <Deliveries error />,
  globals: { lang: "ka", scheme: "dark" },
  play: errorPlay(/30 წამის/),
};

const emptyPlay =
  (text: RegExp): NonNullable<StoryObj["play"]> =>
  async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId("registry");
    await expect(
      root.querySelector("[data-table]")?.getAttribute("data-state-kind"),
    ).toBe("empty");
    await expect(root.textContent).toMatch(text);
  };

export const EmptyEnglishLight: StoryObj = {
  render: () => <Registry rows={0} />,
  globals: { lang: "en", scheme: "light" },
  play: emptyPlay(/No registrations yet/),
};

export const EmptyGeorgianDark: StoryObj = {
  render: () => <Registry rows={0} />,
  globals: { lang: "ka", scheme: "dark" },
  play: emptyPlay(/რეგისტრაციები ჯერ არ არის/),
};

export const Virtualised10000: StoryObj = {
  render: () => <Registry rows={10_000} />,
  globals: { lang: "en", scheme: "light" },
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId("registry");
    const rendered = () => root.querySelectorAll("tbody tr[data-row-id]");
    await waitFor(() => expect(rendered().length).toBeGreaterThan(0));
    await expect(rendered().length).toBeLessThanOrEqual(60);
    const scroller = root.querySelector<HTMLElement>('[data-part="scroll"]');
    if (scroller === null) throw new Error("no scroller");
    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() =>
      expect(root.querySelector('tr[data-row-id="reg-10000"]')).not.toBeNull(),
    );
    await expect(rendered().length).toBeLessThanOrEqual(60);
    // Ctrl+Home from the last row scrolls back and focuses the first cell.
    const last = root.querySelector<HTMLElement>(
      'tr[data-row-id="reg-10000"] td[data-grid-cell]',
    );
    last?.focus();
    await userEvent.keyboard("{Control>}{Home}{/Control}");
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.activeElement?.getAttribute(
          "data-grid-cell",
        ),
      ).toBe("0:0"),
    );
    await userEvent.keyboard("{Control>}{End}{/Control}");
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.activeElement?.getAttribute(
          "data-grid-cell",
        ),
      ).toBe("10000:7"),
    );
  },
};

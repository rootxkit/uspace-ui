import { within } from "@testing-library/react";
import { useMemo, type ReactNode } from "react";
import { expect, it } from "vitest";

import { I18nProvider, useLang, useT } from "../../src/i18n/index.js";
import {
  DataTable,
  UNIT_KEYS,
  columnsFor,
  type TableColumn,
} from "../../src/table/index.js";
import {
  TABLE_NOWRAP,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../src/ui/index.js";
import { LOOKS, lookName, renderKit } from "../kit.js";

// 1.1.1: the table cells wrap, so a long text cell does not widen a table
// past its container, and a column opted out (`TABLE_NOWRAP`,
// `ColumnOptions.nowrap`, on by default for ids, times and numbers) stays
// on one line. Both the vendored `Table` and `DataTable`, in both looks.
// Each "fits" has its twin: the same long cell kept on one line does
// widen the table, so the overflow measurement can see an overflow; and
// each "stays on one line" has its twin: the same value in a wrapping
// column does break, so the line count can see a break.

/** The console width the tables must fit (a 1280 px desktop). */
const CONSOLE_PX = 1280;
/** Narrow enough that a 20-character time cannot fit beside its twin. */
const SQUEEZE_PX = 260;

const TIME = "2026-10-02 14:03 UTC";
/** A long token with no break opportunity (a hash, a path, a list). */
const TOKEN = `TEST${"0123456789abcdef".repeat(10)}`;
const NOTE = {
  en: `The operator reported that the remote pilot station lost sight of the aircraft behind the ridge and recovered it about forty seconds later; the reference is ${TOKEN}.`,
  ka: `ოპერატორმა შეგვატყობინა, რომ დისტანციურმა პილოტმა საჰაერო ხომალდი ქედის მიღმა დაკარგა მხედველობიდან და დაახლოებით ორმოც წამში ისევ დაინახა; მითითება: ${TOKEN}.`,
} as const;

const CATALOGUES = {
  en: {
    "wrap.caption": "Operator reports",
    "wrap.code": "Code",
    "wrap.note": "Report",
    "wrap.raised": "Raised",
    "wrap.alt": "Altitude",
    "wrap.time_text": "Time as text",
  },
  ka: {
    "wrap.caption": "ოპერატორის მოხსენებები",
    "wrap.code": "კოდი",
    "wrap.note": "მოხსენება",
    "wrap.raised": "დრო",
    "wrap.alt": "სიმაღლე",
    "wrap.time_text": "დრო ტექსტად",
  },
};

interface Report {
  id: string;
  code: string;
  note: string;
  raisedAt: string;
  altAmslM: number;
  timeText: string;
}

function reports(lang: "en" | "ka"): Report[] {
  return [1, 2, 3].map((i) => ({
    id: `r-${i}`,
    code: `GEO-TEST-0000${i}`,
    note: NOTE[lang],
    raisedAt: "2026-10-02T14:03:00Z",
    altAmslM: 612 + i,
    timeText: TIME,
  }));
}

function WithWords(props: { children: ReactNode }) {
  const { lang } = useLang();
  return (
    <I18nProvider lang={lang} catalogues={CATALOGUES}>
      {props.children}
    </I18nProvider>
  );
}

const c = columnsFor<Report>();

function ReportTable(props: { width: number; columns: TableColumn<Report>[] }) {
  const t = useT();
  const { lang } = useLang();
  const rows = useMemo(() => reports(lang), [lang]);
  return (
    <div data-testid="frame" style={{ width: props.width }}>
      <DataTable<Report>
        caption={t("wrap.caption")}
        columns={props.columns}
        rows={rows}
        getRowId={(r) => r.id}
        empty={null}
        toolbar={false}
      />
    </div>
  );
}

const REPORT_COLUMNS = (noteNowrap: boolean): TableColumn<Report>[] => [
  c.text("code", { headerKey: "wrap.code", mono: true }),
  c.text("note", { headerKey: "wrap.note", nowrap: noteNowrap }),
  c.utc("raisedAt", { headerKey: "wrap.raised" }),
  c.num("altAmslM", UNIT_KEYS.m_amsl, 0, { headerKey: "wrap.alt" }),
];

function UiReportTable(props: { lang: "en" | "ka"; width: number }) {
  const words = CATALOGUES[props.lang];
  return (
    <div data-testid="frame" style={{ width: props.width }}>
      <Table>
        <TableCaption>{words["wrap.caption"]}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className={TABLE_NOWRAP}>{words["wrap.code"]}</TableHead>
            <TableHead>{words["wrap.note"]}</TableHead>
            <TableHead>{words["wrap.raised"]}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports(props.lang).map((r) => (
            <TableRow key={r.id}>
              <TableCell className={TABLE_NOWRAP} data-part="code">
                {r.code}
              </TableCell>
              <TableCell data-part="note">{r.note}</TableCell>
              <TableCell className={TABLE_NOWRAP} data-part="time">
                {r.timeText}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** The number of line boxes the element's text occupies. */
function lines(el: Element | null | undefined): number {
  if (el === null || el === undefined) throw new Error("no element");
  const range = document.createRange();
  range.selectNodeContents(el);
  const tops = new Set<number>();
  for (const r of range.getClientRects())
    if (r.width > 0) tops.add(Math.round(r.top));
  return tops.size;
}

/** The frame's scroller does not scroll sideways, and fits the frame. */
function expectFits(scroller: HTMLElement, frameWidth: number): void {
  expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);
  const table = scroller.querySelector("table");
  expect(table?.getBoundingClientRect().width).toBeLessThanOrEqual(frameWidth);
}

const scrollerOf = (canvas: HTMLElement, selector: string): HTMLElement => {
  const el = within(canvas)
    .getByTestId("frame")
    .querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`no ${selector}`);
  return el;
};

for (const look of LOOKS) {
  const name = lookName(look);

  it(`DataTable with a long text cell fits ${CONSOLE_PX}px (${name})`, () => {
    const { container } = renderKit(
      <WithWords>
        <ReportTable width={CONSOLE_PX} columns={REPORT_COLUMNS(false)} />
      </WithWords>,
      look,
    );
    expectFits(scrollerOf(container, '[data-part="scroll"]'), CONSOLE_PX);
    const row = container.querySelector('tr[data-row-id="r-1"]');
    // The long cell wrapped rather than spilling.
    expect(lines(row?.querySelector('[data-column="note"]'))).toBeGreaterThan(
      1,
    );
    // The id, the time and the number stay on one line by default.
    for (const id of ["code", "raisedAt", "altAmslM"])
      expect(lines(row?.querySelector(`[data-column="${id}"]`)), id).toBe(1);
  });

  it(`DataTable with the long cell kept on one line overflows (${name})`, () => {
    const { container } = renderKit(
      <WithWords>
        <ReportTable width={CONSOLE_PX} columns={REPORT_COLUMNS(true)} />
      </WithWords>,
      look,
    );
    const scroller = scrollerOf(container, '[data-part="scroll"]');
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    const row = container.querySelector('tr[data-row-id="r-1"]');
    expect(lines(row?.querySelector('[data-column="note"]'))).toBe(1);
  });

  it(`DataTable nowrap column stays on one line when squeezed (${name})`, () => {
    // The same time twice: once as `columns.utc` (nowrap by default),
    // once as plain text (wraps). Small column sizes, so the squeeze is
    // the container's and not the columns' own widths.
    const columns: TableColumn<Report>[] = [
      { ...c.utc("raisedAt", { headerKey: "wrap.raised" }), size: 60 },
      { ...c.text("timeText", { headerKey: "wrap.time_text" }), size: 60 },
    ];
    const { container } = renderKit(
      <WithWords>
        <ReportTable width={SQUEEZE_PX} columns={columns} />
      </WithWords>,
      look,
    );
    const row = container.querySelector('tr[data-row-id="r-1"]');
    const time = row?.querySelector('[data-column="raisedAt"]');
    expect(time?.textContent).toBe(TIME);
    expect(lines(time)).toBe(1);
    const twin = row?.querySelector('[data-column="timeText"]');
    expect(twin?.textContent).toBe(TIME);
    expect(lines(twin)).toBeGreaterThan(1);
  });

  it(`Table with a long text cell fits ${CONSOLE_PX}px (${name})`, () => {
    const { container } = renderKit(
      <UiReportTable lang={look.lang} width={CONSOLE_PX} />,
      look,
    );
    expectFits(
      scrollerOf(container, '[data-slot="table-container"]'),
      CONSOLE_PX,
    );
    const note = container.querySelector('[data-part="note"]');
    expect(lines(note)).toBeGreaterThan(1);
    expect(lines(container.querySelector('[data-part="code"]'))).toBe(1);
    expect(lines(container.querySelector('[data-part="time"]'))).toBe(1);
  });

  it(`Table TABLE_NOWRAP cell stays on one line when squeezed (${name})`, () => {
    const { container } = renderKit(
      <div data-testid="frame" style={{ width: SQUEEZE_PX }}>
        <Table>
          <TableCaption>{CATALOGUES[look.lang]["wrap.caption"]}</TableCaption>
          <TableBody>
            <TableRow>
              <TableCell className={TABLE_NOWRAP} data-part="kept">
                {TIME}
              </TableCell>
              <TableCell data-part="wrapped">{TIME}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>,
      look,
    );
    expectFits(
      scrollerOf(container, '[data-slot="table-container"]'),
      SQUEEZE_PX,
    );
    expect(lines(container.querySelector('[data-part="kept"]'))).toBe(1);
    expect(
      lines(container.querySelector('[data-part="wrapped"]')),
    ).toBeGreaterThan(1);
  });
}

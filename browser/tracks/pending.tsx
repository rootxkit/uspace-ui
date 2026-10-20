import { within } from "@testing-library/react";
import { expect } from "vitest";

import { useT } from "../../src/i18n/index.js";
import { uasTrack } from "../../src/layers/traffic.testing.js";
import { IdentificationLegend } from "../../src/legend/index.js";
import type { Identification, TrackView } from "../../src/model/index.js";
import { TrackDetail } from "../../src/status/index.js";
import {
  identDrawn,
  identMark,
  type IdentKey,
} from "../../src/symbology/index.js";
import { DataTable, columnsFor } from "../../src/table/index.js";

// A block that was not judged (spec 04 §3.2, lab#37 errata; LESSONS G-13):
// `details_unavailable` and `registry_unavailable` are drawn pending with
// the missing input named, beside a judged `unidentified / no_serial`
// track, in the legend (with the app's counts), the table cell and the
// detail panel. Shared by pending.test.tsx and the golden set.

const NOW_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
const STALE_AFTER_S = 30;

function withIdent(trackId: string, over: Partial<Identification>): TrackView {
  const t = uasTrack();
  return {
    ...t,
    trackId,
    receivedAtMs: NOW_MS - 2000,
    identification: {
      ...(t.identification as Identification),
      ...over,
    },
  };
}

/** The three tracks: two not judged, one judged unidentified. */
export function pendingTracks(): readonly [string, TrackView][] {
  return [
    [
      "details_unavailable",
      withIdent("TEST-TRK-0901", {
        status: "unidentified",
        reason: "details_unavailable",
        serial: null,
        operatorReg: null,
        basis: "provider",
      }),
    ],
    [
      "registry_unavailable",
      withIdent("TEST-TRK-0902", {
        status: "unknown_operator",
        reason: "registry_unavailable",
        basis: "as_broadcast",
      }),
    ],
    [
      "no_serial",
      withIdent("TEST-TRK-0903", {
        status: "unidentified",
        reason: "no_serial",
        serial: null,
        operatorReg: null,
        basis: "as_broadcast",
      }),
    ],
  ];
}

interface Row {
  id: string;
  identification: Identification | null;
}

export function Pending() {
  const tr = useT();
  const tracks = pendingTracks();
  // The app counts what it shows, by the drawn key; the legend shows it.
  const counts: Partial<Record<IdentKey, number>> = {};
  for (const [, t] of tracks) {
    const k = identDrawn(t.identification);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const c = columnsFor<Row>();
  return (
    <div className="grid gap-4" style={{ maxWidth: 420 }} data-testid="pending">
      <IdentificationLegend counts={counts} />
      <DataTable<Row>
        caption={tr("ident.legend.title")}
        columns={[c.ident()]}
        rows={tracks.map(([, t]) => ({
          id: t.trackId,
          identification: t.identification,
        }))}
        getRowId={(r) => r.id}
        empty={null}
      />
      {tracks.map(([name, t]) => (
        <div key={name} data-case={name}>
          <TrackDetail track={t} nowMs={NOW_MS} staleAfterS={STALE_AFTER_S} />
        </div>
      ))}
    </div>
  );
}

export function checkPending(
  canvasElement: HTMLElement,
  words: { pending: string; unidentified: string },
): void {
  const root = within(canvasElement).getByTestId("pending");
  // Legend: one pending row, counted, not flagged for attention; the
  // judged unidentified row keeps its count and its flag.
  const row = (k: string) =>
    root.querySelector<HTMLElement>(`li[data-ident="${k}"]`);
  expect(row("pending")?.dataset["attention"]).toBe("false");
  expect(row("pending")?.querySelector('[data-count="2"]')).not.toBeNull();
  expect(row("unidentified")?.dataset["attention"]).toBe("true");
  expect(row("unidentified")?.querySelector('[data-count="1"]')).not.toBeNull();
  expect(
    row("pending")?.querySelector("[data-mark]")?.getAttribute("data-mark"),
  ).toBe(identMark("pending"));
  // Table: pending cells name their input; the judged one is unidentified.
  const cell = (id: string) =>
    root.querySelector<HTMLElement>(`tr[data-row-id="${id}"] [data-ident]`);
  expect(cell("TEST-TRK-0901")?.dataset["ident"]).toBe("pending");
  expect(cell("TEST-TRK-0902")?.dataset["ident"]).toBe("pending");
  expect(cell("TEST-TRK-0903")?.dataset["ident"]).toBe("unidentified");
  for (const id of ["TEST-TRK-0901", "TEST-TRK-0902"]) {
    expect(cell(id)?.textContent).toContain(words.pending);
    expect(cell(id)?.textContent).not.toContain(words.unidentified);
  }
  // Detail: the same.
  const detail = (name: string) =>
    root.querySelector<HTMLElement>(
      `[data-case="${name}"] [data-field="ident-status"] [data-ident]`,
    );
  expect(detail("details_unavailable")?.dataset["ident"]).toBe("pending");
  expect(detail("registry_unavailable")?.dataset["ident"]).toBe("pending");
  expect(detail("no_serial")?.dataset["ident"]).toBe("unidentified");
}

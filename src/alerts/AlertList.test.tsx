// AlertList (WP-11): the order, replace-not-stack (C-06), the live region
// announcing each new critical once and a severity rise again (C-07) with
// the equal re-raise that does not, the acknowledge button with and
// without `canAcknowledge`, the clear's reason, the broadcast caveat with
// its twin, the replayed raise time (C-08), and both languages with axe.
import {
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
import type { AlertView, TrackView } from "../model/index.js";
import { axeCheck } from "../test/axe.js";
import { AlertList, type AlertListProps } from "./AlertList.js";
import { alertCounters, resetAlertCountersForTests } from "./counters.js";
import {
  alert,
  cleared,
  EVERY_KIND,
  NOW_MS,
  track,
} from "./fixtures.testing.js";

afterEach(() => {
  cleanup();
  resetAlertCountersForTests();
});

const wrap = (ui: ReactNode, lang: Lang = "en") => (
  <I18nProvider lang={lang}>{ui}</I18nProvider>
);

function list(
  alerts: readonly AlertView[],
  over: Partial<AlertListProps> = {},
): ReactNode {
  return (
    <AlertList
      alerts={alerts}
      nowMs={NOW_MS}
      canAcknowledge={false}
      {...over}
    />
  );
}

function mount(
  alerts: readonly AlertView[],
  over: Partial<AlertListProps> = {},
  lang: Lang = "en",
) {
  const r = render(wrap(list(alerts, over), lang));
  return {
    ...r,
    update(
      next: readonly AlertView[],
      nextOver: Partial<AlertListProps> = over,
    ) {
      r.rerender(wrap(list(next, nextOver), lang));
    },
  };
}

const rows = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>("li[data-alert-id]"),
];
const rowIds = (): (string | undefined)[] =>
  rows().map((r) => r.dataset["alertId"]);
const live = (): HTMLElement =>
  document.querySelector<HTMLElement>("[data-announcements]") as HTMLElement;
const announced = (): number => Number(live().dataset["announcements"]);

describe("order and content", () => {
  it("sorts critical first, then the most recent raise", () => {
    mount([
      alert({
        alertId: "w",
        severity: "warning",
        raisedAt: "2026-10-02T09:15:00Z",
      }),
      alert({ alertId: "c-old", raisedAt: "2026-10-02T09:00:00Z" }),
      alert({
        alertId: "i",
        severity: "info",
        raisedAt: "2026-10-02T09:15:05Z",
      }),
      alert({ alertId: "c-new", raisedAt: "2026-10-02T09:10:00Z" }),
    ]);
    expect(rowIds()).toEqual(["c-new", "c-old", "w", "i"]);
  });

  it("tells severity and state in words and glyphs, not colour alone", () => {
    mount([
      alert(),
      alert({ alertId: "w", severity: "warning", state: "updated" }),
    ]);
    const [crit, warn] = rows() as [HTMLElement, HTMLElement];
    expect(crit.textContent).toContain("Critical");
    expect(crit.querySelector("[data-glyph]")?.getAttribute("data-glyph")).toBe(
      "octagon",
    );
    expect(within(crit).getByText("raised")).toBeTruthy();
    expect(warn.textContent).toContain("Warning");
    expect(warn.querySelector("[data-glyph]")?.getAttribute("data-glyph")).toBe(
      "triangle",
    );
    expect(within(warn).getByText("updated")).toBeTruthy();
  });

  it("shows the server's raise time in UTC, not 'just now' (C-08)", () => {
    mount([
      alert({ raisedAt: "2026-10-02T08:00:00.000Z", receivedAtMs: NOW_MS }),
    ]);
    const meta = rows()[0]?.querySelector('[data-part="meta"]')?.textContent;
    expect(meta).toContain("08:00:00");
    expect(meta).toContain("UTC");
    expect(meta).toContain("policy test-policy-1");
  });

  it("the age of the last update climbs with the clock (E-02)", () => {
    const r = mount([alert({ receivedAtMs: NOW_MS - 2000 })]);
    const received = () =>
      rows()[0]?.querySelector('[data-part="received"]')?.textContent;
    expect(received()).toContain("2 s");
    r.rerender(
      wrap(
        <AlertList
          alerts={[alert({ receivedAtMs: NOW_MS - 2000 })]}
          nowMs={NOW_MS + 60_000}
          canAcknowledge={false}
        />,
      ),
    );
    expect(received()).toContain("1 min");
  });

  it("a cleared alert stays, dashed, with its reason and its own numbers (C-14)", () => {
    mount([cleared("proximity", { clearReason: "landed" })]);
    const row = rows()[0] as HTMLElement;
    expect(row.dataset["state"]).toBe("cleared");
    expect(row.className).toContain("border-dashed");
    expect(row.querySelector('[data-part="summary"]')?.textContent).toBe(
      "Cleared: the aircraft landed (closest 940 m horizontally in 0 s, 70 m apart vertically)",
    );
  });

  it("an active alert is drawn solid (the twin)", () => {
    mount([alert()]);
    expect(rows()[0]?.className).not.toContain("border-dashed");
  });

  it("says when there is nothing, and only then", () => {
    const r = mount([]);
    expect(screen.getByText("No alerts")).toBeTruthy();
    r.update([alert()]);
    expect(screen.queryByText("No alerts")).toBeNull();
  });

  it("every kind renders in both languages", () => {
    for (const lang of ["en", "ka"] as const) {
      const all = EVERY_KIND.flatMap((kind, i) => [
        alert({ kind, alertId: `r-${i}` }),
        cleared(kind, { alertId: `c-${i}` }),
      ]);
      const r = mount(all, {}, lang);
      expect(rows()).toHaveLength(EVERY_KIND.length * 2);
      for (const row of rows()) {
        expect(row.textContent).not.toMatch(/alert\.|[{}]/);
      }
      r.unmount();
    }
  });
});

describe("replace, not stack (C-06)", () => {
  it("a second raise under one id replaces the row", () => {
    const r = mount([
      alert({ detail: { t_cpa_s: 40, d_cpa_h_m: 100, d_alt_m: 10 } }),
    ]);
    r.update([alert({ detail: { t_cpa_s: 30, d_cpa_h_m: 80, d_alt_m: 10 } })]);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.textContent).toContain("closest 80 m");
  });

  it("two entries under one id in one list show once, the later, counted", () => {
    mount([alert({ severity: "warning" }), alert({ severity: "critical" })]);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.dataset["severity"]).toBe("critical");
    expect(alertCounters().alert_duplicate_id).toBe(1);
  });
});

describe("the live region", () => {
  it("announces a new critical alert exactly once", () => {
    const r = mount([alert()]);
    expect(announced()).toBe(1);
    expect(live().textContent).toContain("Critical alert: Converging aircraft");
    r.update([alert({ state: "updated" })]);
    r.update([alert({ state: "raised" })]);
    expect(announced()).toBe(1);
    expect(live().getAttribute("aria-live")).toBe("assertive");
  });

  it("re-announces a rise to critical (C-07) ...", () => {
    const r = mount([alert({ severity: "warning" })]);
    expect(announced()).toBe(0);
    r.update([alert({ severity: "critical" })]);
    expect(announced()).toBe(1);
  });

  it("... and not an equal re-raise (the twin)", () => {
    const r = mount([alert({ severity: "warning" })]);
    r.update([alert({ severity: "warning", state: "raised" })]);
    expect(announced()).toBe(0);
  });

  it("announces a raise after a clear again", () => {
    const r = mount([alert()]);
    r.update([alert({ state: "cleared", clearReason: "resolved" })]);
    r.update([alert()]);
    expect(announced()).toBe(2);
  });

  it("does not announce a warning or a re-render with the same list", () => {
    const alerts = [alert({ severity: "warning" })];
    const r = mount(alerts);
    r.update(alerts);
    expect(announced()).toBe(0);
  });
});

describe("acknowledge", () => {
  it("the button exists with canAcknowledge and calls back", () => {
    const onAcknowledge = vi.fn();
    const a = alert();
    mount([a], { canAcknowledge: true, onAcknowledge });
    const button = screen.getByRole("button", {
      name: "Acknowledge Converging aircraft, aircraft TEST-TRK-0001",
    });
    fireEvent.click(button);
    expect(onAcknowledge).toHaveBeenCalledWith(a);
    expect(rows()[0]?.textContent).toContain("not acknowledged");
  });

  it("is absent without canAcknowledge (the twin; the authority's violations)", () => {
    mount([alert()], { canAcknowledge: false, onAcknowledge: vi.fn() });
    expect(screen.queryByRole("button", { name: /^Acknowledge/ })).toBeNull();
    expect(rows()[0]?.textContent).toContain("not acknowledged");
  });

  it("is absent without a callback, on an acknowledged and on a cleared alert", () => {
    mount(
      [
        alert({ alertId: "a" }),
        alert({ alertId: "b", acknowledged: true }),
        cleared("lost_link", { alertId: "c" }),
      ],
      { canAcknowledge: true },
    );
    expect(screen.queryByRole("button", { name: /^Acknowledge/ })).toBeNull();
    const b = rows().find((r) => r.dataset["alertId"] === "b");
    expect(b?.textContent).toContain("acknowledged on this console");
    expect(b?.dataset["acknowledged"]).toBe("true");
  });
});

describe("select", () => {
  it("calls back with the alert to centre the map", () => {
    const onSelect = vi.fn();
    const a = alert();
    mount([a], { onSelect });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show on map: Converging aircraft, aircraft TEST-TRK-0001",
      }),
    );
    expect(onSelect).toHaveBeenCalledWith(a);
  });

  it("has no button without a callback", () => {
    mount([alert()]);
    expect(screen.queryByRole("button", { name: /Show on map/ })).toBeNull();
  });
});

describe("the broadcast caveat (R-05)", () => {
  const tracks = (trust: TrackView["trust"]): ReadonlyMap<string, TrackView> =>
    new Map([["TEST-TRK-0001", track({ trust })]]);

  it("a broadcast aircraft makes the alert say unverified", () => {
    mount([alert({ kind: "zone_incursion" })], { tracks: tracks("broadcast") });
    expect(
      rows()[0]?.querySelector('[data-part="caveat"]')?.textContent,
    ).toMatch(/unverified/);
  });

  it("a broadcast peer named in the detail does too", () => {
    mount([
      alert({
        detail: { peer: { track_id: "TEST-TRK-0002", trust: "broadcast" } },
      }),
    ]);
    expect(rows()[0]?.querySelector('[data-part="caveat"]')).not.toBeNull();
  });

  it("an authenticated aircraft does not (the twin)", () => {
    mount([alert({ kind: "zone_incursion" })], {
      tracks: tracks("authenticated"),
    });
    expect(rows()[0]?.querySelector('[data-part="caveat"]')).toBeNull();
  });

  it("the peer from peerTrackId is looked up in the tracks", () => {
    mount([alert({ detail: {}, peerTrackId: "TEST-TRK-0002" })], {
      tracks: new Map([
        [
          "TEST-TRK-0002",
          track({ trackId: "TEST-TRK-0002", trust: "broadcast" }),
        ],
      ]),
    });
    expect(rows()[0]?.querySelector('[data-part="caveat"]')).not.toBeNull();
  });
});

describe("accessibility", () => {
  for (const lang of ["en", "ka"] as const) {
    it(`passes axe with every kind and the buttons (${lang})`, async () => {
      const { container } = mount(
        EVERY_KIND.map((kind, i) => alert({ kind, alertId: `a-${i}` })),
        { canAcknowledge: true, onAcknowledge: vi.fn(), onSelect: vi.fn() },
        lang,
      );
      await axeCheck(container);
    });
  }
});

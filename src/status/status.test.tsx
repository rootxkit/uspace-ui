// The status components (WP-8, PLAN §3.12) in both languages: every
// source state renders, disabled says who and never "silent" (B-11),
// lagging and unreachable in their own words (B-03, B-04, C-12), "0
// dropped" shown, the degraded entries and the frame's ages present only
// when sent, the frozen overlay present when down and absent when live,
// the switch's mandatory reason, and axe.
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LiveSourceView } from "../live/sourceStore.js";
import {
  SOURCE_STATES,
  type FeedStatus,
  type SourceState,
} from "../model/index.js";
import { I18nProvider } from "../i18n/I18nProvider.js";
import { axeCheck } from "../test/axe.js";
import { renderWithKit } from "../test/render.js";
import { AgeChip } from "./AgeChip.js";
import { DegradedBanner } from "./DegradedBanner.js";
import { FeedStatusBar } from "./FeedStatusBar.js";
import { FrozenOverlay } from "./FrozenOverlay.js";
import { SourcesPanel } from "./SourcesPanel.js";
import { SourceStateBadge } from "./SourceStateBadge.js";
import { omit } from "../live/test/omit.js";

afterEach(() => {
  cleanup();
});

const NOW = Date.UTC(2026, 9, 2, 9, 15, 6);
const LANGS = ["en", "ka"] as const;
const LOST = /lost|დაკარგ/i;

function status(over: Partial<FeedStatus> = {}): FeedStatus & {
  lastFrameAtMs: number | null;
  framesMalformed: number;
  unauthorized: boolean;
} {
  return {
    connection: "live",
    sinceMs: NOW - 60_000,
    droppedFrames: 0,
    degraded: [],
    policyVersion: "test",
    staleAfterS: 30,
    liveMaxAgeS: 10,
    serverTs: "2026-10-02T09:15:06.000Z",
    lastFrameAtMs: NOW - 3000,
    framesMalformed: 0,
    unauthorized: false,
    ...over,
  };
}

function source(
  state: SourceState,
  over: Partial<LiveSourceView> = {},
): LiveSourceView {
  return {
    sourceType: "direct_rid",
    instanceId: `rx-${state}`,
    state,
    disabledBy: state === "disabled" ? "instance" : null,
    disabledByWho: state === "disabled" ? "admin:test-1" : null,
    lastSeenAt: state === "never_heard" ? null : "2026-10-02T09:14:06.000Z",
    lagS: state === "lagging" ? 42 : null,
    accepted: 1200,
    refused: state === "disabled" ? 7 : 0,
    ageS: state === "never_heard" ? null : 60,
    ageAtMs: NOW,
    since: "2026-10-02T09:00:00.000Z",
    counters: { accepted: 1200, refused: 0 },
    ...over,
  };
}

const text = (el: Element | null): string => el?.textContent ?? "";

describe("FeedStatusBar", () => {
  it.each(LANGS)(
    "says live, the last frame's age and '0 dropped' (not nothing), %s",
    (lang) => {
      const { container } = renderWithKit(
        <FeedStatusBar status={status()} nowMs={NOW} />,
        { lang },
      );
      const bar = container.querySelector("[data-connection]");
      expect(bar?.getAttribute("data-connection")).toBe("live");
      const dropped = container.querySelector('[data-part="dropped"]');
      expect(dropped?.getAttribute("data-dropped")).toBe("0");
      expect(text(dropped)).toMatch(lang === "en" ? /^0 frames dropped$/ : /0/);
      expect(text(container.querySelector('[data-part="last-frame"]'))).toMatch(
        lang === "en" ? /last frame 3 s ago/ : /3 წმ/,
      );
      expect(container.querySelector('[data-part="malformed"]')).toBeNull();
      expect(container.querySelector('[data-part="degraded"]')).toBeNull();
    },
  );

  it("shows the dropped count when it is over 0, and the malformed count (pair)", () => {
    const { container } = renderWithKit(
      <FeedStatusBar status={status({ droppedFrames: 17 })} nowMs={NOW} />,
    );
    expect(text(container.querySelector('[data-part="dropped"]'))).toBe(
      "17 frames dropped",
    );
    cleanup();
    const second = renderWithKit(
      <FeedStatusBar
        status={{ ...status(), framesMalformed: 1 }}
        nowMs={NOW}
      />,
    );
    expect(
      text(second.container.querySelector('[data-part="malformed"]')),
    ).toBe("1 malformed frame ignored");
  });

  it.each(LANGS)(
    "says down is retrying with the last frame's age, never lost, %s",
    (lang) => {
      const { container } = renderWithKit(
        <FeedStatusBar
          status={status({
            connection: "down",
            lastFrameAtMs: NOW - 125_000,
          } as Partial<FeedStatus>)}
          nowMs={NOW}
        />,
        { lang },
      );
      const t = text(container.firstElementChild);
      expect(t).not.toMatch(LOST);
      if (lang === "en") {
        expect(t).toContain("Feed down, retrying");
        expect(t).toContain("last frame 2 min ago");
      }
    },
  );

  it("a quiet live feed: the last-frame age climbs with the tick (E-02)", () => {
    const s = status({ lastFrameAtMs: NOW } as Partial<FeedStatus>);
    const { container, rerender } = renderWithKit(
      <FeedStatusBar status={s} nowMs={NOW} />,
    );
    expect(text(container.querySelector('[data-part="last-frame"]'))).toBe(
      "last frame 0 s ago",
    );
    rerender(
      <I18nProvider lang="en">
        <FeedStatusBar status={s} nowMs={NOW + 600_000} />
      </I18nProvider>,
    );
    expect(text(container.querySelector('[data-part="last-frame"]'))).toBe(
      "last frame 10 min ago",
    );
    expect(container.querySelector('[data-connection="live"]')).not.toBeNull();
  });

  it("says connecting with no frame yet, and a session that ended", () => {
    renderWithKit(
      <FeedStatusBar
        status={{
          ...status({ connection: "connecting" }),
          lastFrameAtMs: null,
          unauthorized: true,
        }}
        nowMs={NOW}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("Connecting");
    expect(screen.getByRole("status").textContent).toContain(
      "no frame received yet",
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Session ended: sign in again",
    );
  });

  it("lists degraded entries and says when the server sent no threshold", () => {
    const { container } = renderWithKit(
      <FeedStatusBar
        status={status({ degraded: ["manned", "x_custom"], staleAfterS: null })}
        nowMs={NOW}
      />,
    );
    expect(text(container.querySelector('[data-part="degraded"]'))).toBe(
      "Degraded: Manned traffic unavailable; x_custom (as the server names it)",
    );
    expect(
      container.querySelector('[data-part="no-threshold"]'),
    ).not.toBeNull();
  });

  it("a plain FeedStatus (no lastFrameAtMs) renders without the last-frame part", () => {
    const plain = omit(
      status(),
      "lastFrameAtMs",
      "framesMalformed",
      "unauthorized",
    );
    const { container } = renderWithKit(
      <FeedStatusBar status={plain} nowMs={NOW} />,
    );
    expect(container.querySelector('[data-part="last-frame"]')).toBeNull();
    expect(container.querySelector('[data-part="dropped"]')).not.toBeNull();
  });

  it.each(LANGS)("passes axe in every connection state, %s", async (lang) => {
    const { container } = renderWithKit(
      <>
        {(["connecting", "live", "down"] as const).map((c) => (
          <FeedStatusBar
            key={c}
            status={status({
              connection: c,
              degraded: ["dss"],
              droppedFrames: 2,
            })}
            nowMs={NOW}
          />
        ))}
      </>,
      { lang },
    );
    await axeCheck(container);
  });
});

describe("SourceStateBadge", () => {
  for (const lang of LANGS) {
    it(`renders every SourceState with its own words (presence loop), ${lang}`, () => {
      const seen = new Set<string>();
      for (const s of SOURCE_STATES) {
        const { container } = renderWithKit(
          <SourceStateBadge source={source(s)} nowMs={NOW + 5000} />,
          { lang },
        );
        const el = container.querySelector(`[data-source-state="${s}"]`);
        expect(el, s).not.toBeNull();
        const words = text(el?.querySelector('[data-part="state"]') ?? null);
        expect(words.length, s).toBeGreaterThan(0);
        seen.add(words);
        expect(text(el), s).not.toMatch(LOST);
        cleanup();
      }
      expect(seen.size).toBe(SOURCE_STATES.length);
    });
  }

  it("disabled contains the who and how, and never 'silent since' (B-11)", () => {
    const { container } = renderWithKit(
      <SourceStateBadge source={source("disabled")} nowMs={NOW} />,
    );
    const t = text(container);
    expect(t).toContain("disabled by admin:test-1");
    expect(t).toContain("disabled: this source is switched off");
    expect(t).not.toMatch(/silent/);
    cleanup();
    const ka = renderWithKit(
      <SourceStateBadge source={source("disabled")} nowMs={NOW} />,
      { lang: "ka" },
    );
    expect(text(ka.container)).toContain("admin:test-1");
    expect(text(ka.container)).not.toMatch(/დუმს/);
  });

  it("a silent source says silent since, and never disabled (the twin)", () => {
    for (const s of ["stale", "unreachable"] as const) {
      const { container } = renderWithKit(
        <SourceStateBadge source={source(s)} nowMs={NOW + 5000} />,
      );
      const t = text(container);
      expect(t, s).toContain("silent since 2026-10-02 09:14:06 UTC");
      expect(t, s).toContain("last heard 1 min ago");
      expect(t, s).not.toMatch(/disabled/);
      cleanup();
    }
  });

  it("lagging says how far behind; unreachable says buffered (B-03, B-04)", () => {
    const { container } = renderWithKit(
      <>
        <SourceStateBadge source={source("lagging")} nowMs={NOW} />
        <SourceStateBadge source={source("unreachable")} nowMs={NOW} />
      </>,
    );
    expect(
      text(container.querySelector('[data-source-state="lagging"]')),
    ).toContain("lagging: behind, data still arriving");
    expect(
      text(container.querySelector('[data-source-state="lagging"]')),
    ).toContain("behind by 42 s");
    expect(
      text(container.querySelector('[data-source-state="unreachable"]')),
    ).toContain("unreachable: data buffered at the source");
  });

  it("the age climbs on the tick; a disabled source without a who says how only", () => {
    const { container, rerender } = renderWithKit(
      <SourceStateBadge
        source={source("healthy", { ageS: 0.4 })}
        nowMs={NOW}
      />,
    );
    expect(text(container)).toContain("last heard 0 s ago");
    rerender(
      <I18nProvider lang="en">
        <SourceStateBadge
          source={source("healthy", { ageS: 0.4 })}
          nowMs={NOW + 150_000}
        />
      </I18nProvider>,
    );
    expect(text(container)).toContain("last heard 2 min ago");
    cleanup();
    const second = renderWithKit(
      <SourceStateBadge
        source={source("disabled", {
          disabledByWho: null,
          disabledBy: "default_deny",
        })}
        nowMs={NOW}
      />,
    );
    expect(text(second.container)).toContain(
      "new sources are off until enabled",
    );
    expect(text(second.container)).not.toContain("disabled by");
  });

  it("a plain SourceView (no age from the store) renders without an age line", () => {
    const plain = omit(
      source("healthy"),
      "ageS",
      "ageAtMs",
      "since",
      "counters",
    );
    const { container } = renderWithKit(
      <SourceStateBadge source={plain} nowMs={NOW} />,
    );
    expect(container.querySelectorAll('[data-part="detail"]')).toHaveLength(0);
  });
});

describe("SourcesPanel", () => {
  const all = SOURCE_STATES.map((s) => source(s));

  it.each(LANGS)(
    "lists every source by type with its counters; axe, %s",
    async (lang) => {
      const { container } = renderWithKit(
        <SourcesPanel
          sources={[
            ...all,
            source("healthy", { sourceType: "adsb_rx", instanceId: null }),
          ]}
          nowMs={NOW}
          canSwitch={false}
        />,
        { lang },
      );
      expect(container.querySelectorAll("li[data-source]")).toHaveLength(
        SOURCE_STATES.length + 1,
      );
      expect(
        container.querySelectorAll("section[data-source-type]"),
      ).toHaveLength(2);
      if (lang === "en") {
        expect(
          text(container.querySelector('li[data-source="adsb_rx/*"]')),
        ).toContain("All adsb_rx");
        expect(
          text(
            container.querySelector(
              'li[data-source="direct_rid/rx-disabled"] [data-part="counters"]',
            ),
          ),
        ).toBe("1,200 accepted, 7 refused");
      }
      expect(container.querySelector("button")).toBeNull();
      await axeCheck(container);
    },
  );

  it("says when the server reported no sources", () => {
    renderWithKit(<SourcesPanel sources={[]} nowMs={NOW} canSwitch={false} />);
    expect(screen.getByText("The server reported no sources")).toBeTruthy();
  });

  it("the switch needs a reason: blank is refused, a reason calls back once (B-11)", async () => {
    const onSwitch = vi.fn();
    renderWithKit(
      <SourcesPanel sources={all} nowMs={NOW} canSwitch onSwitch={onSwitch} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Switch off rx-healthy" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Switch off rx-healthy")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(onSwitch).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("alert").textContent).toBe(
      "Give a reason to continue",
    );
    fireEvent.change(within(dialog).getByLabelText("Reason (required)"), {
      target: { value: "   " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(onSwitch).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Reason (required)"), {
      target: { value: "  receiver maintenance  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onSwitch.mock.calls[0]?.[1]).toBe(false);
    expect(onSwitch.mock.calls[0]?.[2]).toBe("receiver maintenance");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a disabled source is switched on; cancel calls nothing", async () => {
    const onSwitch = vi.fn();
    renderWithKit(
      <SourcesPanel sources={all} nowMs={NOW} canSwitch onSwitch={onSwitch} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Switch on rx-disabled" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onSwitch).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Switch on rx-disabled" }),
    );
    const again = await screen.findByRole("dialog");
    fireEvent.change(within(again).getByLabelText("Reason (required)"), {
      target: { value: "back in service" },
    });
    fireEvent.click(within(again).getByRole("button", { name: "Confirm" }));
    expect(onSwitch.mock.calls[0]?.[1]).toBe(true);
  });

  it("no switch without canSwitch or without onSwitch; an instance off with its type is switched at the type", () => {
    const byType = source("disabled", {
      instanceId: "rx-9",
      disabledBy: "type",
    });
    const { container } = renderWithKit(
      <SourcesPanel
        sources={[byType]}
        nowMs={NOW}
        canSwitch
        onSwitch={() => undefined}
      />,
    );
    expect(container.querySelector("button")).toBeNull();
    expect(text(container.querySelector('[data-part="at-type"]'))).toBe(
      "Switched with its source type",
    );
    cleanup();
    const noCb = renderWithKit(
      <SourcesPanel sources={all} nowMs={NOW} canSwitch />,
    );
    expect(noCb.container.querySelector("button")).toBeNull();
  });

  it("the switch dialog passes axe in Georgian", async () => {
    renderWithKit(
      <SourcesPanel
        sources={all}
        nowMs={NOW}
        canSwitch
        onSwitch={() => undefined}
      />,
      { lang: "ka" },
    );
    fireEvent.click(screen.getAllByRole("button")[0] as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    await axeCheck(dialog);
  });
});

describe("DegradedBanner", () => {
  it.each(LANGS)("lists each degraded entry, %s", async (lang) => {
    const { container } = renderWithKit(
      <DegradedBanner
        degraded={[
          "manned",
          "dss",
          "source_disabled",
          "publisher_stale",
          "nats_down",
        ]}
      />,
      { lang },
    );
    const items = [...container.querySelectorAll("li[data-degraded-key]")];
    expect(items.map((li) => li.getAttribute("data-degraded-key"))).toEqual([
      "manned",
      "dss",
      "source_disabled",
      "publisher_stale",
      "nats_down",
    ]);
    expect(new Set(items.map((li) => li.textContent)).size).toBe(5);
    expect(text(items[4] ?? null)).toContain("nats_down");
    if (lang === "en")
      expect(text(items[0] ?? null)).toBe("Manned traffic unavailable");
    expect(text(container)).not.toMatch(LOST);
    await axeCheck(container);
  });

  it("shows cis_age_s and each dataset's age when the frame carries them", () => {
    const { container } = renderWithKit(
      <DegradedBanner
        degraded={[]}
        cisAgeS={14}
        datasets={{
          zones: { version: "zones-0007", ageS: 812.5 },
          uspace_airspace: { version: "uspace-0002", ageS: 160233 },
        }}
        projectionAgeS={1.2}
      />,
    );
    expect(text(container.querySelector('[data-age-of="cis"]'))).toBe(
      "CIS data 14 s old",
    );
    expect(text(container.querySelector('[data-age-of="dataset:zones"]'))).toBe(
      "zones, version zones-0007: 13 min old",
    );
    expect(
      text(container.querySelector('[data-age-of="dataset:uspace_airspace"]')),
    ).toBe("uspace_airspace, version uspace-0002: 1 d old");
    expect(text(container.querySelector('[data-age-of="projection"]'))).toBe(
      "Registry projection 1 s old",
    );
    expect(
      container.querySelector("[data-banner]")?.getAttribute("data-degraded"),
    ).toBe("false");
  });

  it("says nothing about them when the frame does not carry them (the pair)", () => {
    const { container } = renderWithKit(<DegradedBanner degraded={["dss"]} />);
    expect(container.querySelector("[data-age-of]")).toBeNull();
    expect(text(container)).not.toMatch(/CIS|version|projection/);
    cleanup();
    const nothing = renderWithKit(
      <DegradedBanner degraded={[]} cisAgeS={null} datasets={null} />,
    );
    expect(nothing.container.querySelector("[data-banner]")).toBeNull();
  });

  it("an age at or over the app's bound says so; under it does not", () => {
    const { container, rerender } = renderWithKit(
      <DegradedBanner degraded={[]} cisAgeS={300} cisStaleBoundS={300} />,
    );
    expect(
      container.querySelector('[data-age-of="cis"]')?.getAttribute("data-over"),
    ).toBe("true");
    expect(text(container)).toBe("CIS data 5 min old: over the bound of 5 min");
    rerender(
      <I18nProvider lang="en">
        <DegradedBanner degraded={[]} cisAgeS={299} cisStaleBoundS={300} />
      </I18nProvider>,
    );
    expect(
      container.querySelector('[data-age-of="cis"]')?.getAttribute("data-over"),
    ).toBeNull();
  });
});

describe("AgeChip", () => {
  it("buckets an age under the server's threshold", () => {
    const { container } = renderWithKit(
      <>
        <AgeChip ageS={2} staleAfterS={30} />
        <AgeChip ageS={15} staleAfterS={30} />
        <AgeChip ageS={45} staleAfterS={30} />
      </>,
    );
    expect(
      [...container.querySelectorAll("[data-age]")].map((e) => [
        e.getAttribute("data-age"),
        e.textContent,
      ]),
    ).toEqual([
      ["live", "2 s· Live"],
      ["aging", "15 s· Ageing"],
      ["stale", "45 s· Stale"],
    ]);
  });

  it("without a threshold: the raw age, no bucket; an unknown age is a dash", async () => {
    const { container } = renderWithKit(
      <>
        <AgeChip ageS={45} staleAfterS={null} />
        <AgeChip ageS={null} staleAfterS={30} />
      </>,
      { lang: "ka" },
    );
    const chips = [...container.querySelectorAll("[data-age]")];
    expect(chips[0]?.getAttribute("data-age")).toBe("unknown");
    expect(chips[0]?.textContent).toBe("45 წმ");
    expect(chips[1]?.textContent).toContain("—");
    expect(chips[1]?.textContent).not.toContain("0");
    await axeCheck(container);
  });
});

describe("FrozenOverlay", () => {
  it.each(LANGS)(
    "appears when down, with the data's time and age, never lost, %s",
    async (lang) => {
      const { container } = renderWithKit(
        <div className="relative">
          <FrozenOverlay
            status={{
              ...status({ connection: "down" }),
              lastFrameAtMs: NOW - 95_000,
            }}
            nowMs={NOW}
          />
        </div>,
        { lang },
      );
      const overlay = container.querySelector('[data-overlay="frozen"]');
      expect(overlay).not.toBeNull();
      const t = text(overlay);
      expect(t).not.toMatch(LOST);
      expect(t).toContain("2026-10-02 09:13:31 UTC");
      if (lang === "en") {
        expect(t).toContain("Feed down, retrying");
        expect(t).toContain("received 1 min ago");
      }
      await axeCheck(container);
    },
  );

  it("is absent when live (the pair)", () => {
    const { container } = renderWithKit(
      <FrozenOverlay status={status()} nowMs={NOW} />,
    );
    expect(container.querySelector('[data-overlay="frozen"]')).toBeNull();
  });

  it("before any frame it says no data yet, so an empty map is not an empty sky (02 F4)", () => {
    const { container } = renderWithKit(
      <FrozenOverlay
        status={{
          ...status({ connection: "connecting" }),
          lastFrameAtMs: null,
        }}
        nowMs={NOW}
      />,
    );
    expect(text(container)).toBe("ConnectingNo data received yet");
  });

  it("with a plain FeedStatus it says how long the feed has been in this state", () => {
    const plain = omit(
      status({
        connection: "down",
        sinceMs: NOW - 30_000,
      }),
      "lastFrameAtMs",
      "framesMalformed",
      "unauthorized",
    );
    const { container } = renderWithKit(
      <FrozenOverlay status={plain} nowMs={NOW} />,
    );
    expect(text(container)).toContain("Frozen: no update for 30 s");
  });
});

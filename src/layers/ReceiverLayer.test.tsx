// ReceiverLayer over the WP-3 MapLibre mock (WP-12): every source state
// renders its word (in the map label and in the hover card) and has a
// colour and a mark that are total over SourceState; `disabled` with
// `disabledByWho` names the person and never reads like silent, `stale`
// says since when and never reads like disabled (B-11, both ways); a
// receiver in any state is drawn, never removed; click calls onSelect.
import { act, cleanup, screen } from "@testing-library/react";
import type * as GeoJSON from "geojson";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { en } from "../i18n/en.js";
import { ka } from "../i18n/ka.js";
import { MapView, type MapViewProps } from "../map/MapView.js";
import { MockMap, resetMapMock } from "../map/test/maplibre-mock.js";
import {
  mapProps,
  renderLoadedMap,
  stubSourceJson,
} from "../map/test/render-map.js";
import { SOURCE_STATES, type SourceState } from "../model/index.js";
import { SOURCE_STATE_KEYS } from "../status/words.js";
import {
  RECEIVER_LAYER_ID,
  ReceiverLayer,
  receiverLayerIds,
  receiverMark,
  receiverToken,
  type ReceiverInput,
  type ReceiverLayerProps,
} from "./ReceiverLayer.js";
import { receiver } from "./traffic.testing.js";

vi.mock("maplibre-gl", async () =>
  (await import("../map/test/maplibre-mock.js")).maplibreMockModule(),
);

beforeEach(() => {
  stubSourceJson();
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

afterEach(() => {
  cleanup();
  resetMapMock();
});

const ids = receiverLayerIds(RECEIVER_LAYER_ID);

type FC = GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>;

async function mount(
  receivers: readonly ReceiverInput[],
  over: Partial<ReceiverLayerProps> = {},
  view: Partial<MapViewProps> = {},
) {
  const r = await renderLoadedMap(
    <ReceiverLayer receivers={receivers} {...over} />,
    view,
  );
  return r;
}

function lastData(map: MockMap): FC {
  const s = map.getSource(RECEIVER_LAYER_ID);
  const last = s?.setData.mock.calls.at(-1);
  if (last === undefined) throw new Error("setData was never called");
  return last[0] as FC;
}

function card(map: MockMap, id: string): HTMLElement {
  map.queryRenderedFeatures.mockReturnValue([
    { properties: { identifier: id } },
  ] as never);
  act(() => map.fire("mousemove", { point: { x: 3, y: 3 } }));
  return screen.getByRole("tooltip");
}

const everyState = (): ReceiverInput[] =>
  SOURCE_STATES.map((state, i) =>
    receiver({
      id: `TEST-RX-${state}`,
      state,
      lng: 44.78 + i * 0.005,
      disabledBy: state === "disabled" ? "instance" : null,
      disabledByWho: state === "disabled" ? "admin:test-1" : null,
      lastSeenAt:
        state === "never_heard" || state === "disabled"
          ? null
          : "2026-01-01T11:58:00Z",
      lagS: state === "lagging" ? 12 : null,
    }),
  );

describe("ReceiverLayer: setup", () => {
  it("adds its source and three layers, and removes them on unmount", async () => {
    const { map, result } = await mount([receiver()]);
    for (const l of [ids.circle, ids.mark, ids.label]) {
      expect(map.getLayer(l), l).toBeDefined();
    }
    result.rerender(<MapView {...mapProps()} />);
    expect(map.getSource(RECEIVER_LAYER_ID)).toBeUndefined();
  });
});

describe("every source state", () => {
  it("has a token and a mark (total), and only healthy has no mark", () => {
    for (const s of SOURCE_STATES) {
      expect(receiverToken(s)).toMatch(/^--us-/);
    }
    expect(SOURCE_STATES.filter((s) => receiverMark(s) === "")).toEqual([
      "healthy",
    ]);
    expect(new Set(SOURCE_STATES.map(receiverToken)).size).toBe(
      SOURCE_STATES.length,
    );
  });

  it("is drawn, whatever the state: none is removed", async () => {
    const { map } = await mount(everyState());
    expect(lastData(map).features.map((f) => f.properties["state"])).toEqual([
      ...SOURCE_STATES,
    ]);
  });

  for (const lang of ["en", "ka"] as const) {
    it(`labels each receiver with its state's word (${lang})`, async () => {
      const { map } = await mount(everyState(), {}, { lang });
      const c = lang === "en" ? en : ka;
      for (const f of lastData(map).features) {
        const state = f.properties["state"] as SourceState;
        expect(f.properties["label"]).toBe(
          `TEST-RX-${state}\n${c[SOURCE_STATE_KEYS[state]]}`,
        );
      }
    });
  }

  for (const state of SOURCE_STATES) {
    it(`renders the word of ${state} in the hover card`, async () => {
      const { map } = await mount(everyState());
      const el = card(map, `TEST-RX-${state}`);
      expect(el.querySelector('[data-part="state"]')?.textContent).toBe(
        en[SOURCE_STATE_KEYS[state]],
      );
      expect(
        el
          .querySelector("[data-source-state]")
          ?.getAttribute("data-source-state"),
      ).toBe(state);
    });
  }
});

describe("B-11: disabled by a person is not silent", () => {
  it("disabled with disabledByWho names the person and does not say silent", async () => {
    const { map } = await mount(everyState());
    const text = card(map, "TEST-RX-disabled").textContent;
    expect(text).toMatch(/disabled by admin:test-1/);
    expect(text).toMatch(/this source is switched off/);
    expect(text).not.toMatch(/silent/);
  });

  it("stale says silent since the time, in UTC, and does not say disabled (the twin)", async () => {
    const { map } = await mount(everyState());
    const text = card(map, "TEST-RX-stale").textContent;
    expect(text).toMatch(/silent since 2026-01-01 11:58:00 UTC/);
    expect(text).not.toMatch(/disabled/);
  });

  it("healthy says healthy and nothing about silence", async () => {
    const { map } = await mount(everyState());
    const text = card(map, "TEST-RX-healthy").textContent;
    expect(text).toMatch(/healthy/);
    expect(text).not.toMatch(/silent|disabled/);
  });

  it("lagging says how far behind, never lost", async () => {
    const { map } = await mount(everyState());
    const text = card(map, "TEST-RX-lagging").textContent;
    expect(text).toMatch(/behind by 12 s/);
    expect(text).not.toMatch(/lost/);
  });

  it("disabled without a person still says disabled, and how", async () => {
    const { map } = await mount([
      receiver({ state: "disabled", disabledBy: "type", disabledByWho: null }),
    ]);
    const text = card(map, "TEST-RX-0001").textContent;
    expect(text).toMatch(/whole source type is switched off/);
    expect(text).not.toMatch(/disabled by/);
  });

  it("names the person in Georgian too", async () => {
    const { map } = await mount(everyState(), {}, { lang: "ka" });
    const text = card(map, "TEST-RX-disabled").textContent;
    expect(text).toMatch(/გამორთო: admin:test-1/);
    expect(text).not.toMatch(/დუმს/);
  });
});

describe("selection", () => {
  it("calls onSelect with a clicked receiver and marks the selected one", async () => {
    const onSelect = vi.fn();
    const { map } = await mount([receiver()], {
      onSelect,
      selectedId: "TEST-RX-0001",
    });
    expect(lastData(map).features[0]?.properties["selected"]).toBe(true);
    map.queryRenderedFeatures.mockReturnValue([
      { properties: { identifier: "TEST-RX-0001" } },
    ] as never);
    act(() => map.fire("click", { point: { x: 1, y: 1 } }));
    expect(onSelect).toHaveBeenCalledWith("TEST-RX-0001");
  });

  it("a click beside every receiver selects nothing (the twin)", async () => {
    const onSelect = vi.fn();
    const { map } = await mount([receiver()], { onSelect });
    map.queryRenderedFeatures.mockReturnValue([]);
    act(() => map.fire("click", { point: { x: 1, y: 1 } }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

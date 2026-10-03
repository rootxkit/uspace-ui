// IntentLayer over the WP-3 MapLibre mock (WP-12): the volumes passed
// through untouched (the same objects, deep-equal; a MultiPolygon and a
// Polygon with a hole), Nonconforming and Contingent drawn unlike
// Activated, an unknown state drawn as unstated, `activeIds` emphasis
// present for a listed id and absent for another (the pair), the peer
// pattern with its twin, the hover card's window in UTC, selection and
// labels; and, over every WP-12 source file, no time or geometry
// computation (CLAUDE.md rule 2).
import { readFileSync } from "node:fs";

import { act, cleanup, screen } from "@testing-library/react";
import type * as GeoJSON from "geojson";
import type { LayerSpecification } from "maplibre-gl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapView, type MapViewProps } from "../map/MapView.js";
import { MockMap, resetMapMock } from "../map/test/maplibre-mock.js";
import {
  mapProps,
  renderLoadedMap,
  stubSourceJson,
} from "../map/test/render-map.js";
import {
  DSS_STATES,
  INTENT_PEER_PATTERN_ID,
  INTENT_STATE_KEYS_ORDER,
} from "../symbology/intent.js";
import { resetLayerCountersForTests } from "./counters.js";
import {
  INTENT_LAYER_ID,
  IntentLayer,
  intentLayerIds,
  type IntentInput,
  type IntentLayerProps,
} from "./IntentLayer.js";
import {
  intent,
  multiPolygon,
  polygon,
  polygonWithHole,
} from "./traffic.testing.js";

vi.mock("maplibre-gl", async () =>
  (await import("../map/test/maplibre-mock.js")).maplibreMockModule(),
);

let frames: Map<number, FrameRequestCallback>;

function flushFrames(): void {
  const due = [...frames.values()];
  frames.clear();
  act(() => {
    for (const f of due) f(0);
  });
}

beforeEach(() => {
  stubSourceJson();
  frames = new Map();
  let next = 1;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = next++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  resetLayerCountersForTests();
});

afterEach(() => {
  cleanup();
  resetMapMock();
});

const ids = intentLayerIds(INTENT_LAYER_ID);

type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

async function mount(
  intents: readonly IntentInput[],
  over: Partial<IntentLayerProps> = {},
  view: Partial<MapViewProps> = {},
) {
  const r = await renderLoadedMap(
    <IntentLayer intents={intents} {...over} />,
    view,
  );
  const rerender = (
    next: readonly IntentInput[],
    nextOver: Partial<IntentLayerProps> = over,
  ): void => {
    r.result.rerender(
      <MapView {...mapProps(view)}>
        <IntentLayer intents={next} {...nextOver} />
      </MapView>,
    );
  };
  return { ...r, rerender };
}

function lastData(map: MockMap): FC {
  const s = map.getSource(INTENT_LAYER_ID);
  if (s === undefined) throw new Error("no intent source");
  const last = s.setData.mock.calls.at(-1);
  if (last === undefined) throw new Error("setData was never called");
  return last[0] as FC;
}

function featuresOf(map: MockMap, id: string) {
  return lastData(map).features.filter(
    (f) => f.properties["identifier"] === id,
  );
}

function layer(map: MockMap, id: string): LayerSpecification {
  const l = map.getLayer(id);
  if (l === undefined) throw new Error(`no layer ${id}`);
  return l;
}

const paint = (map: MockMap, id: string, key: string): unknown =>
  (layer(map, id) as { paint?: Record<string, unknown> }).paint?.[key];

describe("IntentLayer: setup", () => {
  it("adds its source, the fill, the pattern, a line per state and the label", async () => {
    const { map } = await mount([intent()]);
    expect(map.getSource(INTENT_LAYER_ID)).toBeDefined();
    for (const l of [
      ids.fill,
      ids.pattern,
      ids.label,
      ...INTENT_STATE_KEYS_ORDER.map((k) => ids.lines[k]),
    ]) {
      expect(map.getLayer(l), l).toBeDefined();
    }
    expect(map.hasImage(INTENT_PEER_PATTERN_ID)).toBe(true);
  });

  it("removes everything on unmount", async () => {
    const { map, result } = await mount([intent()]);
    result.rerender(<MapView {...mapProps()} />);
    expect(map.getSource(INTENT_LAYER_ID)).toBeUndefined();
    expect(map.getLayer(ids.fill)).toBeUndefined();
  });
});

describe("volumes are the API's, untouched", () => {
  it("passes a Polygon, a Polygon with a hole and a MultiPolygon through as the same objects", async () => {
    const plain = polygon(44.8, 41.7);
    const holed = polygonWithHole(44.79, 41.705);
    const multi = multiPolygon(44.81, 41.695);
    const copies = structuredClone([plain, holed, multi]);
    const { map } = await mount([intent({ volumes: [plain, holed, multi] })]);
    const geoms = featuresOf(map, "TEST-INT-0001").map((f) => f.geometry);
    expect(geoms).toHaveLength(3);
    expect(geoms[0]).toBe(plain);
    expect(geoms[1]).toBe(holed);
    expect(geoms[2]).toBe(multi);
    // Nothing was written into them on the way.
    expect(geoms).toEqual(copies);
    expect((geoms[1] as GeoJSON.Polygon).coordinates).toHaveLength(2);
    expect(geoms[2]?.type).toBe("MultiPolygon");
  });

  it("numbers the volumes of one intent in the API's order", async () => {
    const { map } = await mount([
      intent({ volumes: [polygon(44.8, 41.7), polygon(44.81, 41.7)] }),
    ]);
    expect(
      featuresOf(map, "TEST-INT-0001").map((f) => f.properties["volume"]),
    ).toEqual([0, 1]);
  });

  it("draws an intent with no volumes as nothing, and the others still", async () => {
    const { map } = await mount([
      intent({ intentId: "TEST-INT-EMPTY", volumes: [] }),
      intent({ intentId: "TEST-INT-0002" }),
    ]);
    expect(featuresOf(map, "TEST-INT-EMPTY")).toHaveLength(0);
    expect(featuresOf(map, "TEST-INT-0002")).toHaveLength(1);
  });
});

describe("styled by DSS state", () => {
  it("every DSS state is drawn as itself, an unknown and a null one as unstated", async () => {
    const all = [
      ...DSS_STATES.map((s) => intent({ intentId: `TEST-${s}`, dssState: s })),
      intent({ intentId: "TEST-NULL", dssState: null }),
      intent({ intentId: "TEST-ODD", dssState: "Ended" }),
    ];
    const { map } = await mount(all);
    for (const s of DSS_STATES) {
      expect(featuresOf(map, `TEST-${s}`)[0]?.properties["state"]).toBe(s);
    }
    expect(featuresOf(map, "TEST-NULL")[0]?.properties["state"]).toBe(
      "unstated",
    );
    expect(featuresOf(map, "TEST-ODD")[0]?.properties["state"]).toBe(
      "unstated",
    );
  });

  it("Nonconforming and Contingent lines differ from Activated in colour and width", async () => {
    const { map, result } = await mount([intent()]);
    const css = map.options.container.style;
    css.setProperty("--us-text", "#0b0c0f");
    css.setProperty("--us-severity-warning", "#c47b08");
    css.setProperty("--us-severity-critical", "#88122b");
    // The style re-applies, as on a scheme change, and resolves again.
    result.rerender(
      <MapView {...mapProps({ scheme: "dark" })}>
        <IntentLayer intents={[intent()]} />
      </MapView>,
    );
    await vi.waitFor(() =>
      expect(paint(map, ids.lines.Activated, "line-color")).toBe("#0b0c0f"),
    );
    const activated = {
      colour: paint(map, ids.lines.Activated, "line-color"),
      width: paint(map, ids.lines.Activated, "line-width"),
    };
    for (const k of ["Nonconforming", "Contingent"] as const) {
      expect(paint(map, ids.lines[k], "line-color")).not.toEqual(
        activated.colour,
      );
      expect(paint(map, ids.lines[k], "line-width")).not.toEqual(
        activated.width,
      );
    }
  });

  it("the unstated line is dashed and the Activated one is not", async () => {
    const { map } = await mount([intent()]);
    expect(paint(map, ids.lines.unstated, "line-dasharray")).toBeDefined();
    expect(paint(map, ids.lines.Activated, "line-dasharray")).toBeUndefined();
  });
});

describe("activeIds: the app's word for current", () => {
  it("emphasises a listed intent", async () => {
    const { map } = await mount(
      [intent({ intentId: "TEST-INT-A" }), intent({ intentId: "TEST-INT-B" })],
      { activeIds: ["TEST-INT-A"] },
    );
    expect(featuresOf(map, "TEST-INT-A")[0]?.properties["active"]).toBe(true);
  });

  it("does not emphasise one that is not listed (the twin)", async () => {
    const { map } = await mount(
      [intent({ intentId: "TEST-INT-A" }), intent({ intentId: "TEST-INT-B" })],
      { activeIds: ["TEST-INT-A"] },
    );
    expect(featuresOf(map, "TEST-INT-B")[0]?.properties["active"]).toBe(false);
  });

  it("with no activeIds, nothing is emphasised, whatever the time window says", async () => {
    // The window contains every clock the test could run at; only the
    // app's list decides.
    const { map } = await mount([
      intent({
        timeStart: "2000-01-01T00:00:00Z",
        timeEnd: "2100-01-01T00:00:00Z",
      }),
    ]);
    expect(featuresOf(map, "TEST-INT-0001")[0]?.properties["active"]).toBe(
      false,
    );
  });

  it("follows a new list on rerender", async () => {
    const list = [intent()];
    const { map, rerender } = await mount(list, { activeIds: [] });
    expect(featuresOf(map, "TEST-INT-0001")[0]?.properties["active"]).toBe(
      false,
    );
    rerender(list, { activeIds: ["TEST-INT-0001"] });
    flushFrames();
    expect(featuresOf(map, "TEST-INT-0001")[0]?.properties["active"]).toBe(
      true,
    );
  });
});

describe("peer intents", () => {
  it("a peer intent carries the flag the diamond pattern filters on", async () => {
    const { map } = await mount([intent({ peer: true })]);
    expect(featuresOf(map, "TEST-INT-0001")[0]?.properties["peer"]).toBe(true);
    expect(layer(map, ids.pattern)).toMatchObject({
      filter: ["==", ["get", "peer"], true],
    });
    expect(paint(map, ids.pattern, "fill-pattern")).toBe(
      INTENT_PEER_PATTERN_ID,
    );
  });

  it("an own intent does not (the twin)", async () => {
    const { map } = await mount([intent()]);
    expect(featuresOf(map, "TEST-INT-0001")[0]?.properties["peer"]).toBe(false);
  });
});

describe("labels, selection and the hover card", () => {
  function hoverOn(map: MockMap, id: string): void {
    map.queryRenderedFeatures.mockReturnValue([
      { properties: { identifier: id } },
    ] as never);
    act(() => map.fire("mousemove", { point: { x: 4, y: 4 } }));
  }

  it("labels by the authorisation number, else the intent id, with the state", async () => {
    const { map } = await mount([
      intent(),
      intent({ intentId: "TEST-INT-0002", authorisationNumber: null }),
    ]);
    expect(featuresOf(map, "TEST-INT-0001")[0]?.properties["label"]).toBe(
      "GEO-TEST-AUTH-0001\nActivated",
    );
    expect(featuresOf(map, "TEST-INT-0002")[0]?.properties["label"]).toBe(
      "TEST-INT-0002\nActivated",
    );
  });

  it("marks the selected intent and calls onSelect on a click", async () => {
    const onSelect = vi.fn();
    const { map } = await mount([intent()], {
      selectedId: "TEST-INT-0001",
      onSelect,
    });
    expect(featuresOf(map, "TEST-INT-0001")[0]?.properties["selected"]).toBe(
      true,
    );
    map.queryRenderedFeatures.mockReturnValue([
      { properties: { identifier: "TEST-INT-0001" } },
    ] as never);
    act(() => map.fire("click", { point: { x: 1, y: 1 } }));
    expect(onSelect).toHaveBeenCalledWith("TEST-INT-0001");
  });

  it("shows the window in UTC, the states, and the peer and current notes", async () => {
    const { map } = await mount([intent({ peer: true })], {
      activeIds: ["TEST-INT-0001"],
    });
    hoverOn(map, "TEST-INT-0001");
    const card = screen.getByRole("tooltip");
    expect(card.querySelector('[data-field="window"]')?.textContent).toMatch(
      /2026-01-01 11:30 UTC to 2026-01-01 12:30 UTC/,
    );
    expect(card.querySelector('[data-field="dss-state"]')?.textContent).toMatch(
      /Activated/,
    );
    expect(card.querySelector('[data-part="peer"]')?.textContent).toMatch(
      /unverified/,
    );
    expect(card.querySelector('[data-part="active"]')).not.toBeNull();
  });

  it("without peer or activeIds the card has neither note (the twin)", async () => {
    const { map } = await mount([intent()]);
    hoverOn(map, "TEST-INT-0001");
    const card = screen.getByRole("tooltip");
    expect(card.querySelector('[data-part="peer"]')).toBeNull();
    expect(card.querySelector('[data-part="active"]')).toBeNull();
  });

  it("shows an unknown DSS state as the server named it, and nulls as dashes", async () => {
    const { map } = await mount([
      intent({
        dssState: "Ended",
        localState: null,
        priority: null,
        authorisationNumber: null,
      }),
    ]);
    hoverOn(map, "TEST-INT-0001");
    const card = screen.getByRole("tooltip");
    expect(card.querySelector('[data-field="dss-state"] dd')?.textContent).toBe(
      "Ended (as the server names it)",
    );
    for (const f of ["local-state", "priority", "authorisation"]) {
      expect(card.querySelector(`[data-field="${f}"] dd`)?.textContent, f).toBe(
        "—",
      );
    }
  });

  it("says a null DSS state is not provided", async () => {
    const { map } = await mount([intent({ dssState: null })]);
    hoverOn(map, "TEST-INT-0001");
    expect(
      screen.getByRole("tooltip").querySelector('[data-field="dss-state"] dd')
        ?.textContent,
    ).toBe("DSS state not provided");
  });

  it("is in Georgian on a Georgian map", async () => {
    const { map } = await mount([intent()], {}, { lang: "ka" });
    hoverOn(map, "TEST-INT-0001");
    expect(screen.getByRole("tooltip").textContent).toMatch(/აქტივირებული/);
  });
});

// --- CLAUDE.md rule 2: no time or geometry here ----------------------------

const WP12_SOURCES = [
  "src/layers/IntentLayer.tsx",
  "src/layers/MannedLayer.tsx",
  "src/layers/ReceiverLayer.tsx",
  "src/layers/HoverPortal.tsx",
  "src/status/TrackDetail.tsx",
  "src/symbology/intent.ts",
  "src/symbology/manned.ts",
];

// What a time comparison or a geometry computation would need. `Date` is
// the word the brief names; the rest are the WP-6/WP-7 review greps.
const FORBIDDEN =
  /\bDate\b|\bnow\(|Math\.|\bcos\(|\bsin\(|\batan2?\(|\bcontains\(|\bbooleanPointInPolygon\b|\bdistance\(/;

/** Source text without comments, so a sentence about a rule is not a use. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("no time or geometry computation in WP-12 (CLAUDE.md rule 2)", () => {
  for (const path of WP12_SOURCES) {
    it(`${path} has none`, () => {
      expect(code(path)).not.toMatch(FORBIDDEN);
    });
  }

  it("the check sees a Date, a Math call and a contains()", () => {
    expect("const t = new Date();").toMatch(FORBIDDEN);
    expect("x = Math.cos(a)").toMatch(FORBIDDEN);
    expect("if (contains(zone, p))").toMatch(FORBIDDEN);
    expect(code("src/symbology/trackIcon.ts")).toMatch(FORBIDDEN);
  });
});

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMap, useStyleLoad } from "./context.js";
import {
  useBBoxSubscription,
  useViewport,
  type BBoxSubscriptionOptions,
  type ViewportState,
} from "./hooks.js";
import { MapView } from "./MapView.js";
import { MockMap, resetMapMock } from "./test/maplibre-mock.js";
import {
  mapProps,
  renderLoadedMap,
  stubSourceJson,
  TEST_VIEW,
} from "./test/render-map.js";

vi.mock("maplibre-gl", async () =>
  (await import("./test/maplibre-mock.js")).maplibreMockModule(),
);

beforeEach(() => {
  stubSourceJson();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetMapMock();
});

const VIEW = { west: 44.71, south: 41.62, east: 44.89, north: 41.78 };

function Subscriber(props: BBoxSubscriptionOptions) {
  useBBoxSubscription(props);
  return null;
}

async function subscribe(over: Partial<BBoxSubscriptionOptions> = {}) {
  const onChange = vi.fn();
  const opts: BBoxSubscriptionOptions = {
    marginFraction: 0,
    debounceMs: 300,
    quantizeDeg: 0.1,
    onChange,
    ...over,
  };
  MockMap.autoLoad = false;
  const { map } = await (async () => {
    const r = render(
      <MapView {...mapProps()}>
        <Subscriber {...opts} />
      </MapView>,
    );
    await vi.waitFor(() => expect(MockMap.instances).toHaveLength(1));
    const m = MockMap.instances[0] as MockMap;
    m.bounds = { ...VIEW };
    act(() => {
      m.fire("style.load");
      m.fire("load");
    });
    return { map: m, result: r };
  })();
  vi.useFakeTimers();
  return { map, onChange };
}

describe("useBBoxSubscription", () => {
  it("fires once on load with the quantised bbox", async () => {
    const { onChange } = await subscribe();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({
      minLng: 44.7,
      minLat: 41.6,
      maxLng: 44.9,
      maxLat: 41.8,
    });
  });

  it("debounces: several moveends inside the window evaluate once", async () => {
    const { map, onChange } = await subscribe();
    act(() =>
      map.moveTo({ west: 45.01, south: 41.62, east: 45.19, north: 41.78 }),
    );
    act(() => vi.advanceTimersByTime(200));
    act(() =>
      map.moveTo({ west: 45.11, south: 41.62, east: 45.29, north: 41.78 }),
    );
    act(() => vi.advanceTimersByTime(299));
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({
      minLng: 45.1,
      minLat: 41.6,
      maxLng: 45.3,
      maxLat: 41.8,
    });
  });

  it("fires nothing for a pan smaller than the quantum", async () => {
    const { map, onChange } = await subscribe();
    act(() => map.moveTo({ ...VIEW, west: 44.715, east: 44.895 }));
    act(() => vi.advanceTimersByTime(1000));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("fires once for a pan larger than the quantum", async () => {
    const { map, onChange } = await subscribe();
    act(() => map.moveTo({ ...VIEW, west: 44.86, east: 45.04 }));
    act(() => vi.advanceTimersByTime(1000));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({
      minLng: 44.8,
      minLat: 41.6,
      maxLng: 45.1,
      maxLat: 41.8,
    });
  });

  it("applies the margin", async () => {
    const { onChange } = await subscribe({
      marginFraction: 0.5,
      quantizeDeg: 0.01,
    });
    expect(onChange).toHaveBeenLastCalledWith({
      minLng: 44.62,
      minLat: 41.54,
      maxLng: 44.98,
      maxLat: 41.86,
    });
  });

  it("stops listening when unmounted, pending timer included", async () => {
    const { map, onChange } = await subscribe();
    act(() => map.moveTo({ ...VIEW, west: 45.5, east: 45.7 }));
    cleanup();
    act(() => vi.advanceTimersByTime(1000));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["a zero quantum", { quantizeDeg: 0 }],
    ["a negative margin", { marginFraction: -0.1 }],
    ["a negative debounce", { debounceMs: -1 }],
  ])("refuses %s", (_name, over) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() =>
      render(
        <MapView {...mapProps()}>
          <Subscriber
            marginFraction={0}
            debounceMs={0}
            quantizeDeg={0.1}
            onChange={() => undefined}
            {...over}
          />
        </MapView>,
      ),
    ).toThrow(RangeError);
  });
});

describe("useViewport", () => {
  function Probe({ seen }: { seen: (v: ViewportState) => void }) {
    seen(useViewport());
    return null;
  }

  it("is the initial view before load and the camera after each moveend", async () => {
    const states: ViewportState[] = [];
    MockMap.autoLoad = false;
    render(
      <MapView {...mapProps()}>
        <Probe seen={(v) => states.push(v)} />
      </MapView>,
    );
    expect(states.at(-1)?.viewport).toEqual(TEST_VIEW);
    expect(states.at(-1)?.bbox.minLng).toBeCloseTo(44.8, 6);
    await vi.waitFor(() => expect(MockMap.instances).toHaveLength(1));
    const map = MockMap.instances[0] as MockMap;
    map.bounds = { ...VIEW };
    act(() => {
      map.fire("style.load");
      map.fire("load");
    });
    expect(states.at(-1)?.bbox).toEqual({
      minLng: 44.71,
      minLat: 41.62,
      maxLng: 44.89,
      maxLat: 41.78,
    });
    act(() =>
      map.moveTo(
        { west: 44.5, south: 41.5, east: 44.7, north: 41.6 },
        { zoom: 11 },
      ),
    );
    expect(states.at(-1)?.viewport.zoom).toBe(11);
    expect(states.at(-1)?.bbox.maxLng).toBe(44.7);
  });

  it("fits bounds and flies through the map", async () => {
    let state: ViewportState | null = null;
    const { map } = await renderLoadedMap(<Probe seen={(v) => (state = v)} />);
    act(() => {
      state?.fitBounds(
        { minLng: 1, minLat: 2, maxLng: 3, maxLat: 4 },
        { padding: 10 },
      );
      state?.flyTo({ zoom: 9 });
    });
    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [1, 2],
        [3, 4],
      ],
      { padding: 10 },
    );
    expect(map.flyTo).toHaveBeenCalledWith({ zoom: 9 });
  });
});

describe("context outside a MapView", () => {
  it("useMap is null and useStyleLoad throws", () => {
    const seen = vi.fn();
    function M({ report }: { report: (m: unknown) => void }) {
      report(useMap());
      return null;
    }
    render(<M report={seen} />);
    expect(seen).toHaveBeenLastCalledWith(null);
    function S() {
      useStyleLoad(() => undefined);
      return null;
    }
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<S />)).toThrow(/inside <MapView>/);
  });

  it("a layer that mounts after load is added at once", async () => {
    const onAdd = vi.fn();
    function Late() {
      useStyleLoad(onAdd);
      return null;
    }
    const { map, result } = await renderLoadedMap();
    result.rerender(
      <MapView {...mapProps()}>
        <Late />
      </MapView>,
    );
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(map);
  });
});

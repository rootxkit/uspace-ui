import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMap, useStyleLoad } from "./context.js";
import { mapCounters } from "./counters.js";
import { resetPmtilesProtocolForTests } from "./maplibre.js";
import { MapView } from "./MapView.js";
import {
  addProtocol,
  lastMap,
  MockMap,
  resetMapMock,
} from "./test/maplibre-mock.js";
import {
  mapProps,
  renderLoadedMap,
  stubSourceJson,
} from "./test/render-map.js";

vi.mock("maplibre-gl", async () =>
  (await import("./test/maplibre-mock.js")).maplibreMockModule(),
);

beforeEach(() => {
  stubSourceJson();
});

afterEach(() => {
  cleanup();
  resetMapMock();
});

function StyleProbe({ onAdd }: { onAdd: (n: number) => void }) {
  useStyleLoad((map) => onAdd(map.getZoom()));
  return null;
}

function MapProbe({ seen }: { seen: (m: unknown) => void }) {
  seen(useMap());
  return null;
}

describe("MapView", () => {
  it("registers the pmtiles protocol once for two instances", async () => {
    resetPmtilesProtocolForTests();
    render(
      <>
        <MapView {...mapProps()} />
        <MapView {...mapProps()} />
      </>,
    );
    await waitFor(() => expect(MockMap.instances).toHaveLength(2));
    expect(addProtocol).toHaveBeenCalledTimes(1);
    expect(addProtocol).toHaveBeenCalledWith("pmtiles", expect.any(Function));
  });

  it("creates the map with the basemap style, the initial camera and the OSM date", async () => {
    const { map } = await renderLoadedMap();
    expect(map.options.center).toEqual([44.8, 41.7]);
    expect(map.options.zoom).toBe(13);
    expect(JSON.stringify(map.style.sources)).toContain(
      "pmtiles://https://kit.test/basemap/basemap.pmtiles",
    );
    expect(JSON.stringify(map.style.sources)).toContain("2026-10-01");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("passes the app's attribution through", async () => {
    const { map } = await renderLoadedMap(null, {
      attributionExtra: "Zones: test data",
    });
    expect(map.options.attributionControl).toEqual({
      compact: false,
      customAttribution: "Zones: test data",
    });
  });

  it("shows a loading notice until SOURCE.json answers", async () => {
    let answer: (r: Response) => void = () => undefined;
    stubSourceJson(() => new Promise((r) => (answer = r)));
    render(<MapView {...mapProps()} />);
    expect(screen.getByRole("status").textContent).toContain(
      "Loading the base map",
    );
    expect(MockMap.instances).toHaveLength(0);
    await act(async () => {
      answer(Response.json({ bounds: [1, 2, 3, 4] }));
      await Promise.resolve();
    });
    await waitFor(() => expect(MockMap.instances).toHaveLength(1));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("calls onViewport on load and on moveend with a [lng, lat] bbox", async () => {
    const onViewport = vi.fn();
    const onLoad = vi.fn();
    const { map } = await renderLoadedMap(null, { onViewport, onLoad });
    expect(onLoad).toHaveBeenCalledWith(map);
    expect(onViewport).toHaveBeenCalledTimes(1);
    act(() => map.moveTo({ west: 44.7, south: 41.6, east: 44.9, north: 41.8 }));
    expect(onViewport).toHaveBeenCalledTimes(2);
    const [viewport, bbox] = onViewport.mock.lastCall as [
      { center: [number, number] },
      { minLng: number; minLat: number; maxLng: number; maxLat: number },
    ];
    expect(bbox).toEqual({
      minLng: 44.7,
      minLat: 41.6,
      maxLng: 44.9,
      maxLat: 41.8,
    });
    expect(bbox.minLng).toBeLessThan(bbox.maxLng);
    expect(viewport.center[0]).toBeCloseTo(44.8, 9);
    expect(viewport.center[1]).toBeCloseTo(41.7, 9);
  });

  it("gives children the map after load, null before", async () => {
    const seen = vi.fn();
    MockMap.autoLoad = false;
    render(
      <MapView {...mapProps()}>
        <MapProbe seen={seen} />
      </MapView>,
    );
    await waitFor(() => expect(MockMap.instances).toHaveLength(1));
    expect(seen).toHaveBeenLastCalledWith(null);
    const map = lastMap();
    act(() => {
      map.fire("style.load");
      map.fire("load");
    });
    expect(seen).toHaveBeenLastCalledWith(map);
  });

  it("re-applies the style on a language change and re-adds the kit layers", async () => {
    const onAdd = vi.fn();
    const { map, result } = await renderLoadedMap(<StyleProbe onAdd={onAdd} />);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(map.setStyleCalls).toHaveLength(0);

    result.rerender(
      <MapView {...mapProps({ lang: "ka" })}>
        <StyleProbe onAdd={onAdd} />
      </MapView>,
    );
    expect(map.setStyleCalls).toHaveLength(1);
    expect(map.setStyleCalls[0]?.options).toEqual({ diff: false });
    expect(JSON.stringify(map.setStyleCalls[0]?.style)).toContain("name:ka");
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2));
  });

  it("does not re-apply the style while the language and scheme are stable", async () => {
    const onAdd = vi.fn();
    const { map, result } = await renderLoadedMap(<StyleProbe onAdd={onAdd} />);
    result.rerender(
      <MapView {...mapProps({ className: "other" })}>
        <StyleProbe onAdd={onAdd} />
      </MapView>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(map.setStyleCalls).toHaveLength(0);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("re-applies the dark flavour on a scheme change", async () => {
    const { map, result } = await renderLoadedMap();
    result.rerender(<MapView {...mapProps({ scheme: "dark" })} />);
    expect(map.setStyleCalls).toHaveLength(1);
    expect(map.setStyleCalls[0]?.style.sprite).toBe(
      "https://kit.test/basemap/sprites/v4/dark",
    );
  });

  it("stops calling a layer that unmounted", async () => {
    const onAdd = vi.fn();
    const { map, result } = await renderLoadedMap(<StyleProbe onAdd={onAdd} />);
    result.rerender(<MapView {...mapProps()} />);
    act(() => map.fire("style.load"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("removes the map on unmount", async () => {
    const { map, result } = await renderLoadedMap();
    result.unmount();
    expect(map.removed).toBe(true);
  });

  it("with SOURCE.json 404 shows the no-basemap notice and counts it", async () => {
    stubSourceJson(() => Promise.resolve(new Response("", { status: 404 })));
    const before = mapCounters().basemap_missing;
    const { map } = await renderLoadedMap();
    expect(screen.getByRole("status").textContent).toContain(
      "No base map: positions are drawn on a plain background.",
    );
    expect(mapCounters().basemap_missing).toBe(before + 1);
    expect(JSON.stringify(map.style)).not.toContain("pmtiles://");
    expect(JSON.stringify(map.style.sources)).toContain("no base map");
  });

  it("says no base map in Georgian in ka", async () => {
    stubSourceJson(() => Promise.resolve(new Response("", { status: 404 })));
    await renderLoadedMap(null, { lang: "ka" });
    expect(screen.getByRole("status").textContent).toContain(
      "საბაზისო რუკა არ არის",
    );
  });

  it("with no WebGL shows a notice with the bbox as text and counts it", async () => {
    MockMap.failNext = new Error("Failed to initialize WebGL");
    const onViewport = vi.fn();
    const before = mapCounters().webgl_unavailable;
    render(<MapView {...mapProps({ onViewport })} />);
    const notice = await screen.findByText(/this browser has no WebGL/);
    expect(notice.textContent).toMatch(
      /44\.8000, 41\.7000 to 44\.8000, 41\.7000/,
    );
    expect(notice.textContent).toContain("(lng, lat, WGS84)");
    expect(mapCounters().webgl_unavailable).toBe(before + 1);
    expect(MockMap.instances).toHaveLength(0);
    expect(onViewport).toHaveBeenCalledWith(
      mapProps().initial,
      expect.objectContaining({ minLng: expect.closeTo(44.8, 6) as unknown }),
    );
  });

  it("with WebGL shows no WebGL notice", async () => {
    await renderLoadedMap();
    expect(screen.queryByText(/WebGL/)).toBeNull();
  });
});

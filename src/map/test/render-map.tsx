// Renders a MapView over the MapLibre mock with a stubbed SOURCE.json.
// The caller mocks "maplibre-gl" with maplibreMockModule() (vi.mock is
// hoisted per test file, so it cannot live here).
import { render, waitFor, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, vi } from "vitest";

import { MapView, type MapViewProps } from "../MapView.js";
import { lastMap, MockMap } from "./maplibre-mock.js";

export const SOURCE_JSON = {
  bounds: [44.77, 41.68, 44.83, 41.73],
  osm_data_as_of: "2026-10-01T04:00:00Z",
};

export const TEST_VIEW = {
  center: [44.8, 41.7] as [number, number],
  zoom: 13,
  bearing: 0,
  pitch: 0,
};

export function stubSourceJson(
  answer: () => Promise<Response> = () =>
    Promise.resolve(Response.json(SOURCE_JSON)),
): ReturnType<typeof vi.fn> {
  const fn = vi.fn(answer);
  vi.stubGlobal("fetch", fn);
  return fn;
}

export function mapProps(over: Partial<MapViewProps> = {}): MapViewProps {
  return {
    basemap: { baseUrl: "https://kit.test" },
    initial: TEST_VIEW,
    lang: "en",
    scheme: "light",
    ...over,
  };
}

/** Renders and waits until the mock map has fired `load`. */
export async function renderLoadedMap(
  children?: ReactNode,
  over: Partial<MapViewProps> = {},
): Promise<{ result: RenderResult; map: MockMap }> {
  const result = render(<MapView {...mapProps(over)}>{children}</MapView>);
  await waitFor(() => {
    expect(MockMap.instances.length).toBeGreaterThan(0);
  });
  const map = lastMap();
  await waitFor(() => {
    expect(map.listenerCount("load")).toBe(0);
  });
  return { result, map };
}

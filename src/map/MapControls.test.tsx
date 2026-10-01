import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LayerPanel, MapControls, type LayerToggle } from "./MapControls.js";
import { MapView } from "./MapView.js";
import {
  MockMap,
  MockScaleControl,
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

function toggles(): LayerToggle[] {
  return [
    { id: "zones", labelKey: "layer.zones", visible: true, onChange: vi.fn() },
    {
      id: "tracks",
      labelKey: "layer.tracks",
      visible: false,
      onChange: vi.fn(),
    },
  ];
}

describe("MapControls", () => {
  it("zooms, turns north and shows the bearing", async () => {
    const { map } = await renderLoadedMap(<MapControls layers={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Turn the map to north up" }),
    );
    expect(map.zoomIn).toHaveBeenCalledTimes(1);
    expect(map.zoomOut).toHaveBeenCalledTimes(1);
    expect(map.resetNorth).toHaveBeenCalledTimes(1);
    act(() => map.rotateTo(30));
    const needle = screen.getByText("N");
    expect(needle.style.transform).toBe("rotate(-30deg)");
  });

  it("is disabled before the map has loaded, enabled after", async () => {
    MockMap.autoLoad = false;
    render(
      <MapView {...mapProps()}>
        <MapControls layers={[]} />
      </MapView>,
    );
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    expect((zoomIn as HTMLButtonElement).disabled).toBe(true);
    await vi.waitFor(() => expect(MockMap.instances).toHaveLength(1));
    const map = MockMap.instances[0] as MockMap;
    act(() => {
      map.fire("style.load");
      map.fire("load");
    });
    expect((zoomIn as HTMLButtonElement).disabled).toBe(false);
  });

  it("adds a metric scale and removes it on unmount", async () => {
    const { map, result } = await renderLoadedMap(<MapControls layers={[]} />);
    expect(map.controls).toHaveLength(1);
    const scale = map.controls[0]?.control as MockScaleControl;
    expect(scale).toBeInstanceOf(MockScaleControl);
    expect(scale.options).toEqual({ unit: "metric" });
    result.rerender(<MapView {...mapProps()} />);
    expect(map.controls).toHaveLength(0);
  });

  it("has no geolocation control", async () => {
    await renderLoadedMap(<MapControls layers={[]} locate={false} />);
    const names = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? b.textContent);
    expect(names).toEqual(["Zoom in", "Zoom out", "Turn the map to north up"]);
    expect(
      screen.queryByRole("button", { name: /locat|position|where/i }),
    ).toBeNull();
  });

  it("shows the scheme toggle when asked and switches to the other scheme", async () => {
    const onSchemeChange = vi.fn();
    await renderLoadedMap(
      <MapControls layers={[]} scheme onSchemeChange={onSchemeChange} />,
    );
    const toggle = screen.getByRole("button", { name: "Dark map" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(onSchemeChange).toHaveBeenCalledWith("dark");
  });

  it("presses the toggle in the dark scheme and offers light", async () => {
    const onSchemeChange = vi.fn();
    await renderLoadedMap(
      <MapControls layers={[]} scheme onSchemeChange={onSchemeChange} />,
      { scheme: "dark" },
    );
    const toggle = screen.getByRole("button", { name: "Dark map" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(toggle);
    expect(onSchemeChange).toHaveBeenCalledWith("light");
  });

  it("has no scheme toggle without the flag or without a handler", async () => {
    const { result } = await renderLoadedMap(
      <MapControls layers={[]} onSchemeChange={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Dark map" })).toBeNull();
    result.rerender(
      <MapView {...mapProps()}>
        <MapControls layers={[]} scheme />
      </MapView>,
    );
    expect(screen.queryByRole("button", { name: "Dark map" })).toBeNull();
  });

  it("speaks Georgian in ka", async () => {
    await renderLoadedMap(<MapControls layers={toggles()} />, { lang: "ka" });
    expect(
      screen.getByRole("button", { name: "მასშტაბის გაზრდა" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "ფენები" })).toBeTruthy();
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe(
      "რუკის ღილაკები",
    );
  });

  it("has no layer button when there are no layers", async () => {
    await renderLoadedMap(<MapControls layers={[]} />);
    expect(screen.queryByRole("button", { name: "Layers" })).toBeNull();
  });
});

describe("LayerPanel", () => {
  it("opens as a sheet, toggles layers and closes with Escape", async () => {
    const layers = toggles();
    await renderLoadedMap(
      <MapControls layers={layers} translate={(k) => `T:${k}`} />,
    );
    const open = screen.getByRole("button", { name: "Layers" });
    expect(open.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(open);
    expect(open.getAttribute("aria-expanded")).toBe("true");
    const sheet = screen.getByRole("dialog", { name: "Layers" });
    expect(open.getAttribute("aria-controls")).toBe(sheet.id);
    const zones = screen.getByRole("checkbox", { name: "T:layer.zones" });
    const tracks = screen.getByRole("checkbox", { name: "T:layer.tracks" });
    expect(document.activeElement).toBe(zones);
    expect(zones.getAttribute("aria-checked")).toBe("true");
    expect(tracks.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(tracks);
    expect(layers[1]?.onChange).toHaveBeenCalledWith(true);
    fireEvent.click(zones);
    expect(layers[0]?.onChange).toHaveBeenCalledWith(false);
    fireEvent.keyDown(zones, { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(zones, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    // The sheet's focus scope hands focus back after it unmounts.
    await waitFor(() => expect(document.activeElement).toBe(open));
  });

  it("closes with its close button", async () => {
    await renderLoadedMap(<LayerPanel layers={toggles()} lang="ka" />);
    const open = screen.getByRole("button", { name: "ფენები" });
    fireEvent.click(open);
    // The sheet renders in a portal, outside the map, and carries the
    // map's language itself.
    const sheet = screen.getByRole("dialog", { name: "ფენები" });
    expect(sheet.getAttribute("lang")).toBe("ka");
    expect(sheet.closest(".us-map")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "ფენების დახურვა" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(open));
  });

  it("shows the label key when no translation is given", async () => {
    await renderLoadedMap(<LayerPanel layers={toggles()} />);
    fireEvent.click(screen.getByRole("button", { name: "Layers" }));
    expect(screen.getByRole("checkbox", { name: "layer.zones" })).toBeTruthy();
  });
});

// A MapLibre stand-in for jsdom tests (WP-3; shared with the layer WPs).
// jsdom has no WebGL, so the real Map cannot be constructed. The mock keeps
// what tests assert on: sources, layers, style re-applies, events, the
// camera and controls. Everything that needs no WebGL (MercatorCoordinate,
// LngLat, LngLatBounds) is the real MapLibre.
//
//   vi.mock("maplibre-gl", async () =>
//     (await import("./test/maplibre-mock.js")).maplibreMockModule());
//
// and `resetMapMock()` in `afterEach` (E-11: tests restore the map mock).
import type * as ML from "maplibre-gl";
import { vi } from "vitest";

type Handler = (event?: unknown) => void;

export interface MockBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MockSource {
  id: string;
  spec: unknown;
  setData: ReturnType<typeof vi.fn>;
  updateData: ReturnType<typeof vi.fn>;
}

export interface MockMapOptions {
  container: HTMLElement;
  style: ML.StyleSpecification;
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
  attributionControl?: unknown;
}

export class MockMap {
  static instances: MockMap[] = [];
  /** The next constructor call throws this (MapLibre without WebGL). */
  static failNext: Error | null = null;
  /** When false, `style.load` and `load` are fired by the test. */
  static autoLoad = true;

  readonly options: MockMapOptions;
  style: ML.StyleSpecification;
  readonly setStyleCalls: {
    style: ML.StyleSpecification;
    options: unknown;
  }[] = [];
  readonly sources = new Map<string, MockSource>();
  readonly layers = new Map<string, ML.LayerSpecification>();
  /** Images added with addImage (WP-6: zone fill patterns). */
  readonly images = new Map<string, unknown>();
  /** The options each image was added with (WP-7: SDF track icons). */
  readonly imageOptions = new Map<string, unknown>();
  readonly controls: { control: unknown; position: unknown }[] = [];
  center: { lng: number; lat: number };
  zoom: number;
  bearing: number;
  pitch: number;
  bounds: MockBounds = { west: -1, south: -1, east: 1, north: 1 };
  removed = false;

  readonly zoomIn = vi.fn();
  readonly zoomOut = vi.fn();
  readonly resetNorth = vi.fn();
  readonly fitBounds = vi.fn();
  readonly flyTo = vi.fn();
  readonly queryRenderedFeatures = vi.fn(() => []);

  private readonly handlers = new Map<string, Set<Handler>>();

  constructor(options: MockMapOptions) {
    const fail = MockMap.failNext;
    if (fail !== null) {
      MockMap.failNext = null;
      throw fail;
    }
    this.options = options;
    this.style = options.style;
    this.center = {
      lng: options.center?.[0] ?? 0,
      lat: options.center?.[1] ?? 0,
    };
    this.zoom = options.zoom ?? 0;
    this.bearing = options.bearing ?? 0;
    this.pitch = options.pitch ?? 0;
    MockMap.instances.push(this);
    if (MockMap.autoLoad) {
      queueMicrotask(() => {
        this.fire("style.load");
        this.fire("load");
      });
    }
  }

  on(type: string, h: Handler): this {
    let set = this.handlers.get(type);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(h);
    return this;
  }

  off(type: string, h: Handler): this {
    this.handlers.get(type)?.delete(h);
    return this;
  }

  once(type: string, h: Handler): this {
    const wrapped: Handler = (e) => {
      this.off(type, wrapped);
      h(e);
    };
    return this.on(type, wrapped);
  }

  /** Fires `type` to every handler, as MapLibre's Evented does. */
  fire(type: string, event?: unknown): void {
    for (const h of [...(this.handlers.get(type) ?? [])]) h(event);
  }

  listenerCount(type: string): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  setStyle(style: ML.StyleSpecification, options?: unknown): this {
    this.style = style;
    this.sources.clear();
    this.layers.clear();
    this.images.clear();
    this.imageOptions.clear();
    this.setStyleCalls.push({ style, options });
    if (MockMap.autoLoad) queueMicrotask(() => this.fire("style.load"));
    return this;
  }

  getStyle(): ML.StyleSpecification {
    return this.style;
  }

  addSource(id: string, spec: unknown): this {
    this.sources.set(id, { id, spec, setData: vi.fn(), updateData: vi.fn() });
    return this;
  }

  getSource(id: string): MockSource | undefined {
    return this.sources.get(id);
  }

  removeSource(id: string): this {
    this.sources.delete(id);
    return this;
  }

  addLayer(layer: ML.LayerSpecification): this {
    this.layers.set(layer.id, layer);
    return this;
  }

  getLayer(id: string): ML.LayerSpecification | undefined {
    return this.layers.get(id);
  }

  removeLayer(id: string): this {
    this.layers.delete(id);
    return this;
  }

  getLayoutProperty(id: string, name: string): unknown {
    const layout = this.layers.get(id)?.layout as
      Record<string, unknown> | undefined;
    return layout?.[name];
  }

  hasImage(id: string): boolean {
    return this.images.has(id);
  }

  addImage(id: string, image: unknown, options?: unknown): this {
    if (this.images.has(id)) {
      throw new Error(`An image named "${id}" already exists.`);
    }
    this.images.set(id, image);
    this.imageOptions.set(id, options);
    return this;
  }

  updateImage(id: string, image: unknown): this {
    this.images.set(id, image);
    return this;
  }

  setLayoutProperty(id: string, name: string, value: unknown): this {
    const layer = this.layers.get(id);
    if (layer !== undefined) {
      this.layers.set(id, {
        ...layer,
        layout: { ...(layer.layout ?? {}), [name]: value },
      } as ML.LayerSpecification);
    }
    return this;
  }

  getCenter(): { lng: number; lat: number } {
    return { ...this.center };
  }

  getZoom(): number {
    return this.zoom;
  }

  getBearing(): number {
    return this.bearing;
  }

  getPitch(): number {
    return this.pitch;
  }

  getBounds(): Pick<
    ML.LngLatBounds,
    "getWest" | "getSouth" | "getEast" | "getNorth"
  > {
    const b = { ...this.bounds };
    return {
      getWest: () => b.west,
      getSouth: () => b.south,
      getEast: () => b.east,
      getNorth: () => b.north,
    };
  }

  /** Test helper: move the camera and fire `move` and `moveend`. */
  moveTo(bounds: MockBounds, camera: { zoom?: number } = {}): void {
    this.bounds = bounds;
    this.center = {
      lng: (bounds.west + bounds.east) / 2,
      lat: (bounds.south + bounds.north) / 2,
    };
    if (camera.zoom !== undefined) this.zoom = camera.zoom;
    this.fire("move");
    this.fire("moveend");
  }

  /** Test helper: rotate and fire `rotate`. */
  rotateTo(bearing: number): void {
    this.bearing = bearing;
    this.fire("rotate");
  }

  addControl(control: unknown, position?: unknown): this {
    this.controls.push({ control, position });
    return this;
  }

  hasControl(control: unknown): boolean {
    return this.controls.some((c) => c.control === control);
  }

  removeControl(control: unknown): this {
    const i = this.controls.findIndex((c) => c.control === control);
    if (i >= 0) this.controls.splice(i, 1);
    return this;
  }

  getCanvas(): HTMLCanvasElement {
    return document.createElement("canvas");
  }

  getContainer(): HTMLElement {
    return this.options.container;
  }

  remove(): void {
    this.removed = true;
    // MapLibre fires `remove` once the map is gone (Map.remove()).
    this.fire("remove");
    this.controls.length = 0;
    this.handlers.clear();
  }
}

export class MockScaleControl {
  constructor(readonly options: unknown) {}
}

export const addProtocol = vi.fn();
export const removeProtocol = vi.fn();

/** The module object `vi.mock("maplibre-gl", ...)` should return. */
export async function maplibreMockModule(): Promise<Record<string, unknown>> {
  const actual = await vi.importActual<typeof ML & { default?: typeof ML }>(
    "maplibre-gl",
  );
  const real = actual.default ?? actual;
  const lib = {
    ...real,
    Map: MockMap,
    ScaleControl: MockScaleControl,
    addProtocol,
    removeProtocol,
  };
  return { ...lib, default: lib };
}

/** The most recent map; throws when none was created. */
export function lastMap(): MockMap {
  const m = MockMap.instances.at(-1);
  if (m === undefined) throw new Error("no MockMap was created");
  return m;
}

/** Restores the mock between tests (E-11). */
export function resetMapMock(): void {
  MockMap.instances = [];
  MockMap.failNext = null;
  MockMap.autoLoad = true;
  addProtocol.mockClear();
  removeProtocol.mockClear();
}

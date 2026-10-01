import * as ns from "maplibre-gl";
import { Protocol } from "pmtiles";

type MapLibre = typeof ns;

// maplibre-gl ships a UMD bundle under "type": "module": Node's ESM loader
// exposes it only as `default`, bundlers expose the named exports as well.
export const maplibre: MapLibre =
  (ns as MapLibre & { default?: MapLibre }).default ?? ns;

let pmtilesRegistered = false;

/** Registers the `pmtiles://` protocol once per page, for every map. */
export function registerPmtilesProtocol(): void {
  if (pmtilesRegistered) return;
  maplibre.addProtocol("pmtiles", new Protocol().tile);
  pmtilesRegistered = true;
}

/** Tests only: forget the registration so a test can observe it. */
export function resetPmtilesProtocolForTests(): void {
  pmtilesRegistered = false;
}

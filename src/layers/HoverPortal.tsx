"use client";
// The hover card placement the WP-12 layers share (MannedLayer,
// IntentLayer, ReceiverLayer): a tooltip beside the pointer, inside the
// map's container, the way ZoneLayer's HoverCard places a zone card.
import type { Map as MapLibreMap } from "maplibre-gl";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { HOVER_OFFSET_PX } from "./ZoneLayer.js";
import type { PointerHover } from "./zoneFeatures.js";

/** @beta */
export function HoverPortal(props: {
  map: MapLibreMap;
  hover: PointerHover;
  children: ReactNode;
}) {
  const { map, hover, children } = props;
  return createPortal(
    <div
      className="us-map-hover pointer-events-none absolute z-10"
      role="tooltip"
      style={{
        left: hover.x + HOVER_OFFSET_PX,
        top: hover.y + HOVER_OFFSET_PX,
      }}
    >
      {children}
    </div>,
    map.getContainer(),
  );
}

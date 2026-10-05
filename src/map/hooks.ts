"use client";
import type { FitBoundsOptions } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";

import { useMapContext } from "./context.js";
import {
  bboxOf,
  subscriptionBBox,
  viewportOf,
  type BBox,
  type Viewport,
} from "./viewport.js";

/** @public */
export interface ViewportState {
  viewport: Viewport;
  /** The visible bbox; before load (or with no WebGL), the initial view's. */
  bbox: BBox;
  fitBounds(b: BBox, opts?: FitBoundsOptions): void;
  flyTo(v: Partial<Viewport>): void;
}

/**
 * The camera of the enclosing MapView, updated on every `moveend`.
 *
 * @public
 */
export function useViewport(): ViewportState {
  const { map, initial, initialBBox } = useMapContext();
  const [moved, setMoved] = useState<{ viewport: Viewport; bbox: BBox } | null>(
    null,
  );
  useEffect(() => {
    if (map === null) return;
    const update = (): void =>
      setMoved({ viewport: viewportOf(map), bbox: bboxOf(map) });
    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
    };
  }, [map]);
  const fitBounds = useCallback(
    (b: BBox, opts?: FitBoundsOptions) => {
      map?.fitBounds(
        [
          [b.minLng, b.minLat],
          [b.maxLng, b.maxLat],
        ],
        opts,
      );
    },
    [map],
  );
  const flyTo = useCallback(
    (v: Partial<Viewport>) => {
      map?.flyTo(v);
    },
    [map],
  );
  const current = map === null ? null : moved;
  return {
    viewport: current?.viewport ?? initial,
    bbox: current?.bbox ?? initialBBox,
    fitBounds,
    flyTo,
  };
}

/** @public */
export interface BBoxSubscriptionOptions {
  /** Padding on every side, as a fraction of the view's width and height. */
  marginFraction: number;
  /** Quiet time after the last `moveend` before the bbox is re-evaluated. */
  debounceMs: number;
  /** Grid the padded bbox is widened to, in degrees. */
  quantizeDeg: number;
  onChange(bbox: BBox): void;
}

function sameBBox(a: BBox | null, b: BBox): boolean {
  return (
    a !== null &&
    a.minLng === b.minLng &&
    a.minLat === b.minLat &&
    a.maxLng === b.maxLng &&
    a.maxLat === b.maxLat
  );
}

/**
 * Spec 05 §5: a console subscribes to the cells intersecting its viewport
 * plus a margin. Calls `onChange` with the padded, quantised bbox once on
 * load and then after each settled move that changes it; a move inside
 * the quantum calls nothing.
 *
 * @public
 */
export function useBBoxSubscription(opts: BBoxSubscriptionOptions): void {
  const { marginFraction, debounceMs, quantizeDeg } = opts;
  if (!(marginFraction >= 0) || !(quantizeDeg > 0) || !(debounceMs >= 0)) {
    throw new RangeError(
      "useBBoxSubscription: marginFraction >= 0, quantizeDeg > 0 and debounceMs >= 0 are required",
    );
  }
  const { map } = useMapContext();
  const onChange = useRef(opts.onChange);
  useEffect(() => {
    onChange.current = opts.onChange;
  });
  useEffect(() => {
    if (map === null) return;
    let last: BBox | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const evaluate = (): void => {
      const next = subscriptionBBox(bboxOf(map), marginFraction, quantizeDeg);
      if (sameBBox(last, next)) return;
      last = next;
      onChange.current(next);
    };
    const onMoveEnd = (): void => {
      clearTimeout(timer);
      timer = setTimeout(evaluate, debounceMs);
    };
    evaluate();
    map.on("moveend", onMoveEnd);
    return () => {
      clearTimeout(timer);
      map.off("moveend", onMoveEnd);
    };
  }, [map, marginFraction, debounceMs, quantizeDeg]);
}

"use client";
// One MapLibre map per MapView (predecessor utm/web-pilot MapView.tsx,
// LESSONS P1-12, E-02). A style re-apply (language, scheme, basemap info)
// drops every source and layer, so kit layers register a re-adder through
// context and are put back on each `style.load`. Every empty state is a
// visible notice and a counter: no base map, no WebGL.
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  basemapStyle,
  loadBasemapInfo,
  type BasemapConfig,
  type BasemapInfo,
  type MapScheme,
} from "./basemap.js";
import {
  MapContext,
  type MapContextValue,
  type StyleLoadHandler,
} from "./context.js";
import { countMap } from "./counters.js";
import { maplibre, registerPmtilesProtocol } from "./maplibre.js";
import { mapText, type MapLang } from "./messages.js";
import {
  bboxOf,
  bboxText,
  viewportBBox,
  viewportOf,
  type BBox,
  type Viewport,
} from "./viewport.js";

export interface MapViewProps {
  basemap: BasemapConfig;
  /** The first camera; the app's configuration, never a kit default. */
  initial: Viewport;
  lang: MapLang;
  scheme: MapScheme;
  /** On load and on every `moveend`, with the bbox in `[lng, lat]` order. */
  onViewport?(v: Viewport, bbox: BBox): void;
  onLoad?(map: MapLibreMap): void;
  /** HTML appended to the attribution (the app's own data sources). */
  attributionExtra?: string;
  children?: ReactNode;
  className?: string;
}

type Applied = { info: BasemapInfo | null; lang: MapLang; scheme: MapScheme };

export function MapView(props: MapViewProps): ReactNode {
  const { basemap, initial, lang, scheme, children, className } = props;
  const { baseUrl, sourceInfoPath } = basemap;
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loaded = useRef(false);
  const styleLoaded = useRef(false);
  const applied = useRef<Applied | null>(null);
  const handlers = useRef(new Set<StyleLoadHandler>());

  // undefined while SOURCE.json is being read; null when it is not there.
  const [info, setInfo] = useState<BasemapInfo | null | undefined>(undefined);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [noWebgl, setNoWebgl] = useState(false);
  const [initialBBox, setInitialBBox] = useState<BBox>(() =>
    viewportBBox(initial, 0, 0),
  );

  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const ctrl = new AbortController();
    const cfg: BasemapConfig =
      sourceInfoPath === undefined ? { baseUrl } : { baseUrl, sourceInfoPath };
    void loadBasemapInfo(cfg, ctrl.signal).then((i) => {
      if (!ctrl.signal.aborted) setInfo(i);
    });
    return () => ctrl.abort();
  }, [baseUrl, sourceInfoPath]);

  const infoRef = useRef<BasemapInfo | null>(null);
  useEffect(() => {
    if (info !== undefined) infoRef.current = info;
  }, [info]);

  const ready = info !== undefined;

  // Create the map once SOURCE.json has answered (or failed to).
  useEffect(() => {
    const el = container.current;
    if (!ready || el === null) return;
    const p = latest.current;
    const style = basemapStyle(p.basemap, infoRef.current, p.lang, p.scheme);
    const bbox = viewportBBox(p.initial, el.clientWidth, el.clientHeight);
    let m: MapLibreMap;
    try {
      registerPmtilesProtocol();
      m = new maplibre.Map({
        container: el,
        style,
        center: p.initial.center,
        zoom: p.initial.zoom,
        bearing: p.initial.bearing,
        pitch: p.initial.pitch,
        attributionControl:
          p.attributionExtra === undefined
            ? { compact: false }
            : { compact: false, customAttribution: p.attributionExtra },
      });
    } catch {
      // MapLibre throws when it cannot get a WebGL context.
      countMap("webgl_unavailable");
      setInitialBBox(bbox);
      setNoWebgl(true);
      // The app still subscribes for what it lists beside the map.
      p.onViewport?.(p.initial, bbox);
      return;
    }
    applied.current = {
      info: infoRef.current,
      lang: p.lang,
      scheme: p.scheme,
    };
    mapRef.current = m;
    m.on("style.load", () => {
      styleLoaded.current = true;
      if (!loaded.current) return;
      for (const h of handlers.current) h(m);
    });
    m.once("load", () => {
      loaded.current = true;
      // Layers that registered before load are added now; later ones are
      // added when they register (onStyleLoad).
      for (const h of handlers.current) h(m);
      setInitialBBox(bbox);
      setMap(m);
      latest.current.onLoad?.(m);
      latest.current.onViewport?.(viewportOf(m), bboxOf(m));
    });
    m.on("moveend", () => {
      if (loaded.current) {
        latest.current.onViewport?.(viewportOf(m), bboxOf(m));
      }
    });
    return () => {
      m.remove();
      mapRef.current = null;
      loaded.current = false;
      styleLoaded.current = false;
    };
  }, [ready]);

  // Re-apply the style when the language, the scheme or the basemap info
  // changes, and only then: every kit layer is re-added on `style.load`.
  useEffect(() => {
    if (map === null || map !== mapRef.current || info === undefined) return;
    const a = applied.current;
    if (a && a.info === info && a.lang === lang && a.scheme === scheme) return;
    applied.current = { info, lang, scheme };
    styleLoaded.current = false;
    map.setStyle(basemapStyle(latest.current.basemap, info, lang, scheme), {
      diff: false,
    });
  }, [map, info, lang, scheme]);

  const onStyleLoad = useCallback((h: StyleLoadHandler) => {
    handlers.current.add(h);
    const m = mapRef.current;
    if (m !== null && loaded.current && styleLoaded.current) h(m);
    return () => {
      handlers.current.delete(h);
    };
  }, []);

  const ctx = useMemo<MapContextValue>(
    () => ({ map, lang, scheme, initial, initialBBox, onStyleLoad }),
    [map, lang, scheme, initial, initialBBox, onStyleLoad],
  );

  return (
    <div
      className={className ? `us-map ${className}` : "us-map"}
      data-scheme={scheme}
      data-theme={scheme}
      lang={lang}
    >
      <div
        ref={container}
        className="us-map-canvas"
        role="region"
        aria-label={mapText(lang, "map.region")}
      />
      {info === undefined && (
        <p className="us-map-notice" role="status">
          {mapText(lang, "map.loading")}
        </p>
      )}
      {info === null && !noWebgl && (
        <p className="us-map-notice" role="status" data-notice="no-basemap">
          {mapText(lang, "map.no_basemap")}
        </p>
      )}
      {noWebgl && (
        <p
          className="us-map-notice us-map-notice-webgl"
          role="status"
          data-notice="no-webgl"
        >
          {mapText(lang, "map.webgl_unavailable")}{" "}
          <span data-bbox="">
            {mapText(lang, "map.bbox", bboxText(initialBBox))}
          </span>
        </p>
      )}
      <MapContext.Provider value={ctx}>{children}</MapContext.Provider>
    </div>
  );
}

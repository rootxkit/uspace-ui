"use client";
// Zoom, compass, scale, scheme and layer toggles. No geolocation control:
// a console is a desk, and a browser prompt for location would be a
// surprise on a state workstation (WP-3 safety notes).
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import type { MapScheme } from "./basemap.js";
import { useMapContext } from "./context.js";
import { maplibre } from "./maplibre.js";
import { mapText, type MapLang } from "./messages.js";

export interface LayerToggle {
  id: string;
  /** A catalogue key; rendered through `translate`. */
  labelKey: string;
  visible: boolean;
  onChange(v: boolean): void;
}

/** Resolves a layer's `labelKey`. Interim until WP-2's `useT()`. */
export type Translate = (key: string) => string;

export interface LayerPanelProps {
  layers: LayerToggle[];
  translate?: Translate;
  /** Defaults to the enclosing MapView's language. */
  lang?: MapLang;
}

/** The layer toggles as a sheet, opened by a "Layers" button. */
export function LayerPanel(props: LayerPanelProps): ReactNode {
  const { layers, translate = (k: string) => k } = props;
  const ctx = useMapContext();
  const lang = props.lang ?? ctx.lang;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = (): void => {
    setOpen(false);
    button.current?.focus();
  };

  // Focus moves into the sheet when it opens; Escape closes it and returns
  // focus to the button.
  useEffect(() => {
    const el = panel.current;
    if (!open || el === null) return;
    el.querySelector("input")?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="us-map-layers">
      <button
        ref={button}
        type="button"
        className="us-map-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {mapText(lang, "map.layers")}
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          className="us-map-sheet"
          role="dialog"
          aria-modal="false"
          aria-label={mapText(lang, "map.layers")}
        >
          <ul>
            {layers.map((l) => (
              <li key={l.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={l.visible}
                    onChange={(e) => l.onChange(e.currentTarget.checked)}
                  />
                  {translate(l.labelKey)}
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="us-map-button" onClick={close}>
            {mapText(lang, "map.layers_close")}
          </button>
        </div>
      )}
    </div>
  );
}

export interface MapControlsProps {
  layers: LayerToggle[];
  /** Show the light/dark toggle; it needs `onSchemeChange`. */
  scheme?: boolean;
  onSchemeChange?(scheme: MapScheme): void;
  /** There is no geolocation control; the type admits only `false`. */
  locate?: false;
  translate?: Translate;
}

export function MapControls(props: MapControlsProps): ReactNode {
  const { layers, scheme = false, onSchemeChange, translate } = props;
  const ctx = useMapContext();
  const { map, lang } = ctx;
  const [bearing, setBearing] = useState(0);

  useEffect(() => {
    if (map === null) return;
    const scale = new maplibre.ScaleControl({ unit: "metric" });
    map.addControl(scale, "bottom-left");
    const onRotate = (): void => setBearing(map.getBearing());
    onRotate();
    map.on("rotate", onRotate);
    return () => {
      map.off("rotate", onRotate);
      // MapView's own cleanup may have removed the map, and its controls
      // with it, first.
      if (map.hasControl(scale)) map.removeControl(scale);
    };
  }, [map]);

  const disabled = map === null;
  const next: MapScheme = ctx.scheme === "dark" ? "light" : "dark";
  return (
    <div
      className="us-map-controls"
      role="group"
      aria-label={mapText(lang, "map.controls")}
    >
      <button
        type="button"
        className="us-map-button"
        aria-label={mapText(lang, "map.zoom_in")}
        disabled={disabled}
        onClick={() => map?.zoomIn()}
      >
        <span aria-hidden="true">+</span>
      </button>
      <button
        type="button"
        className="us-map-button"
        aria-label={mapText(lang, "map.zoom_out")}
        disabled={disabled}
        onClick={() => map?.zoomOut()}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        className="us-map-button"
        aria-label={mapText(lang, "map.north")}
        disabled={disabled}
        onClick={() => map?.resetNorth()}
      >
        <span
          aria-hidden="true"
          className="us-map-compass"
          style={{ transform: `rotate(${-bearing}deg)` }}
        >
          N
        </span>
      </button>
      {scheme && onSchemeChange !== undefined && (
        <button
          type="button"
          className="us-map-button"
          aria-pressed={ctx.scheme === "dark"}
          onClick={() => onSchemeChange(next)}
        >
          {mapText(lang, "map.scheme_dark")}
        </button>
      )}
      {layers.length > 0 && (
        <LayerPanel
          layers={layers}
          {...(translate === undefined ? {} : { translate })}
        />
      )}
    </div>
  );
}

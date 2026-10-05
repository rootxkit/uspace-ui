"use client";
// Zoom, compass, scale, scheme and layer toggles. No geolocation control:
// a console is a desk, and a browser prompt for location would be a
// surprise on a state workstation (WP-3 safety notes).
import { useEffect, useId, useState, type ReactNode } from "react";

import { useTFor } from "../i18n/I18nProvider.js";
import type { Lang } from "../i18n/lang.js";
import {
  Button,
  Checkbox,
  Label,
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/index.js";
import type { MapScheme } from "./basemap.js";
import { useMapContext } from "./context.js";
import { maplibre } from "./maplibre.js";

/** @public */
export interface LayerToggle {
  id: string;
  /**
   * A catalogue key (the kit's or the app's, through the I18nProvider's
   * catalogues), or resolved by `translate` when that is given.
   */
  labelKey: string;
  visible: boolean;
  onChange(v: boolean): void;
}

/**
 * Resolves a layer's `labelKey` instead of the catalogues.
 *
 * @public
 */
export type Translate = (key: string) => string;

/** @public */
export interface LayerPanelProps {
  layers: LayerToggle[];
  translate?: Translate;
  /** Defaults to the enclosing MapView's language. */
  lang?: Lang;
}

/**
 * The layer toggles as a sheet (the kit's shadcn/ui `Sheet`), opened by a
 * "Layers" button. The sheet traps focus while open; Escape and the close
 * button return focus to the button.
 *
 * @public
 */
export function LayerPanel(props: LayerPanelProps): ReactNode {
  const ctx = useMapContext();
  const lang = props.lang ?? ctx.lang;
  const t = useTFor(lang);
  const { layers, translate = (k: string) => t(k) } = props;
  const idPrefix = useId();
  const title = t("map.layers");

  return (
    <div className="us-map-layers">
      <Sheet>
        <SheetTrigger className="us-map-button">{title}</SheetTrigger>
        {/* The upstream close button reads "Close" in English, so the
            sheet renders its own, translated one. */}
        <SheetContent
          lang={lang}
          showCloseButton={false}
          aria-describedby={undefined}
          className="us-map-sheet"
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <ul className="flex flex-col gap-2 px-4">
            {layers.map((l) => {
              const id = `${idPrefix}-${l.id}`;
              return (
                <li key={l.id} className="flex min-h-7 items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={l.visible}
                    onCheckedChange={(v) => l.onChange(v === true)}
                  />
                  <Label htmlFor={id}>{translate(l.labelKey)}</Label>
                </li>
              );
            })}
          </ul>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="outline">{t("map.layers_close")}</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** @public */
export interface MapControlsProps {
  layers: LayerToggle[];
  /** Show the light/dark toggle; it needs `onSchemeChange`. */
  scheme?: boolean;
  onSchemeChange?(scheme: MapScheme): void;
  /** There is no geolocation control; the type admits only `false`. */
  locate?: false;
  translate?: Translate;
}

/** @public */
export function MapControls(props: MapControlsProps): ReactNode {
  const { layers, scheme = false, onSchemeChange, translate } = props;
  const ctx = useMapContext();
  const { map, lang } = ctx;
  const t = useTFor(lang);
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
      aria-label={t("map.controls")}
    >
      <button
        type="button"
        className="us-map-button"
        aria-label={t("map.zoom_in")}
        disabled={disabled}
        onClick={() => map?.zoomIn()}
      >
        <span aria-hidden="true">+</span>
      </button>
      <button
        type="button"
        className="us-map-button"
        aria-label={t("map.zoom_out")}
        disabled={disabled}
        onClick={() => map?.zoomOut()}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        className="us-map-button"
        aria-label={t("map.north")}
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
          {t("map.scheme_dark")}
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

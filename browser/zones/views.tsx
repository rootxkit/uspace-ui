import type { Map as MapLibreMap } from "maplibre-gl";
import { waitFor, within } from "@testing-library/react";
import { useMemo, useState } from "react";
import { expect } from "vitest";
import { userEvent } from "vitest/browser";

import { useLang, type Lang } from "../../src/i18n/index.js";
import {
  RestrictionLayer,
  ZoneCard,
  ZoneLayer,
  restrictionLayerIds,
  zoneLayerIds,
} from "../../src/layers/index.js";
import { ZoneLegend } from "../../src/legend/index.js";
import { MapView } from "../../src/map/index.js";
import type { ZoneType } from "../../src/model/index.js";
import "../../styles/map.css";
import { basemapBaseUrl } from "../map/basemap.js";
import { fixtureRestrictions, fixtureZones } from "./zones.js";

// WP-6: the five zone types over the Tbilisi extract, the restriction
// trio, the hover card and the legend, in both languages and both
// schemes. The map renders on SwiftShader for smoke only (PLAN D9): the
// checks read what MapLibre holds, never pixels. Shared by zones.test.tsx
// and the golden set.

// Display-only sample camera over the committed extract.
const TBILISI = {
  center: [44.8, 41.705] as [number, number],
  zoom: 13.4,
  bearing: 0,
  pitch: 0,
};

interface Loaded {
  map: MapLibreMap;
  errors: string[];
}
const maps = new WeakMap<Element, Loaded>();

export function ZoneMap(props: {
  restrictions?: boolean;
  scheme: "light" | "dark";
}) {
  const { lang } = useLang();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const zones = useMemo(() => fixtureZones(lang), [lang]);
  const restrictions = useMemo(() => fixtureRestrictions(lang), [lang]);
  // The app counts what it shows; the legend displays the counts.
  const counts: Partial<Record<ZoneType, number>> = {};
  for (const z of zones) counts[z.type] = (counts[z.type] ?? 0) + 1;
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
      <div ref={setHost} style={{ height: 480 }} data-testid="map-host">
        <MapView
          basemap={{ baseUrl: basemapBaseUrl() }}
          initial={TBILISI}
          lang={lang}
          scheme={props.scheme}
          onLoad={(m) => {
            if (host === null) return;
            const errors: string[] = [];
            m.on("error", (e: { error?: Error }) => {
              errors.push(String(e.error?.message ?? e.error));
            });
            maps.set(host, { map: m, errors });
            host.setAttribute("data-loaded", "true");
          }}
        >
          {props.restrictions === true ? (
            <RestrictionLayer restrictions={restrictions} />
          ) : (
            <ZoneLayer
              zones={zones}
              selectedId={selected}
              onSelect={setSelected}
            />
          )}
        </MapView>
      </div>
      {props.restrictions !== true && <ZoneLegend counts={counts} />}
    </div>
  );
}

async function loaded(canvasElement: HTMLElement): Promise<Loaded> {
  const host = within(canvasElement).getByTestId("map-host");
  await waitFor(() => expect(host.getAttribute("data-loaded")).toBe("true"), {
    timeout: 20000,
  });
  const l = maps.get(host);
  if (l === undefined) throw new Error("onLoad did not hand over the map");
  return l;
}

const zoneIds = zoneLayerIds("us-zones");

export async function checkZoneMap(canvasElement: HTMLElement): Promise<void> {
  const { map, errors } = await loaded(canvasElement);
  for (const id of [
    zoneIds.fill,
    zoneIds.pattern,
    zoneIds.line,
    zoneIds.label,
  ]) {
    expect(map.getLayer(id)).toBeDefined();
  }
  expect(map.hasImage("us-zone-pattern-REQ_AUTHORIZATION")).toBe(true);
  expect(map.hasImage("us-zone-pattern-CONDITIONAL")).toBe(true);
  // The five types reached the map's source, MultiPolygon included.
  await waitFor(
    async () => {
      const types = new Set(
        map
          .querySourceFeatures("us-zones")
          .map((f) => String(f.properties["type"])),
      );
      expect(types.size).toBe(5);
    },
    { timeout: 20000 },
  );
  // MapLibre accepted every layer, expression and image.
  expect(errors).toEqual([]);
  const legend = within(canvasElement).getByRole("region", {
    name: /Zone types|ზონების ტიპები/,
  });
  expect(legend.querySelectorAll("li")).toHaveLength(5);
}

const restrictionIds = restrictionLayerIds("us-restrictions");

/** The three restriction states reached the map, each drawn its own way. */
export async function checkRestrictions(
  canvasElement: HTMLElement,
): Promise<void> {
  const { map, errors } = await loaded(canvasElement);
  expect(
    map.getPaintProperty(restrictionIds.lines.planned, "line-dasharray"),
  ).toEqual([3, 2]);
  expect(
    map.getPaintProperty(restrictionIds.lines.active, "line-dasharray"),
  ).toBeUndefined();
  await waitFor(
    async () => {
      const states = map
        .querySourceFeatures("us-restrictions")
        .map((f) => String(f.properties["restrictionState"]));
      expect(new Set(states)).toEqual(new Set(["planned", "active", "ended"]));
    },
    { timeout: 20000 },
  );
  expect(errors).toEqual([]);
}

/** MapLibre accepted the restriction layers. */
export async function checkRestrictionsLoaded(
  canvasElement: HTMLElement,
): Promise<void> {
  const { errors } = await loaded(canvasElement);
  expect(errors).toEqual([]);
}

// --- the hover card and the legend, on their own -----------------------------

export function Cards() {
  const { lang } = useLang();
  const zones = fixtureZones(lang);
  const [restriction] = fixtureRestrictions(lang).slice(1);
  return (
    <div className="flex flex-wrap items-start gap-3" data-testid="cards">
      {/* applies: true, applies: null, applies: false */}
      {[zones[1], zones[2], zones[3]].map(
        (z) => z && <ZoneCard key={z.identifier} zone={z} lang={lang} />,
      )}
      {restriction && <ZoneCard zone={restriction} lang={lang} restriction />}
    </div>
  );
}

export function checkCards(canvasElement: HTMLElement, lang: Lang): void {
  const cards = canvasElement.querySelectorAll(".us-zone-card");
  expect(cards).toHaveLength(4);
  const applicability = [...cards].map(
    (c) =>
      c.querySelector('[data-field="applicability"] dd')?.textContent ?? null,
  );
  expect(applicability[0]).toMatch(
    lang === "en" ? /^Applies now/ : /^ახლა მოქმედებს/,
  );
  // applies: null says nothing about applicability.
  expect(applicability[1]).toBeNull();
  expect(applicability[2]).toMatch(
    lang === "en" ? /^Does not apply now/ : /^ახლა არ მოქმედებს/,
  );
  expect(cards[0]?.textContent).toContain("UTC");
}

export function LegendBox() {
  return (
    <div style={{ maxWidth: 320 }}>
      <ZoneLegend counts={{ PROHIBITED: 1, REQ_AUTHORIZATION: 1, USPACE: 1 }} />
    </div>
  );
}

/** The legend folds and unfolds from the keyboard. */
export async function checkLegend(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole("button", {
    name: /Zone types|ზონების ტიპები/,
  });
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  await userEvent.tab();
  expect(toggle).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await userEvent.keyboard("{Enter}");
  expect(toggle).toHaveAttribute("aria-expanded", "true");
}

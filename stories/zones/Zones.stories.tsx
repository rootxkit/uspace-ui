import type { Map as MapLibreMap } from "maplibre-gl";
import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

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
import { storyRestrictions, storyZones } from "./zones.js";

// WP-6: the five zone types over the Tbilisi extract, the restriction
// trio, the hover card and the legend, in both languages and both schemes
// (the scheme and language come from the preview's globals). The map
// stories run on SwiftShader for smoke only (PLAN D9): the play functions
// check what MapLibre holds, never pixels.

function storyBaseUrl(): string {
  const { href, origin, pathname } = window.location;
  return pathname.endsWith("iframe.html") ? new URL(".", href).href : origin;
}

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

function ZoneMap(props: { restrictions?: boolean; scheme: "light" | "dark" }) {
  const { lang } = useLang();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const zones = useMemo(() => storyZones(lang), [lang]);
  const restrictions = useMemo(() => storyRestrictions(lang), [lang]);
  // The app counts what it shows; the legend displays the counts.
  const counts: Partial<Record<ZoneType, number>> = {};
  for (const z of zones) counts[z.type] = (counts[z.type] ?? 0) + 1;
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
      <div ref={setHost} style={{ height: 480 }} data-testid="map-host">
        <MapView
          basemap={{ baseUrl: storyBaseUrl() }}
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

const meta = {
  title: "layers/Zones",
  component: ZoneMap,
  args: { scheme: "light" },
} satisfies Meta<typeof ZoneMap>;

export default meta;
type Story = StoryObj<typeof meta>;

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

const zonesPlay: Story["play"] = async ({ canvasElement }) => {
  const { map, errors } = await loaded(canvasElement);
  for (const id of [
    zoneIds.fill,
    zoneIds.pattern,
    zoneIds.line,
    zoneIds.label,
  ]) {
    await expect(map.getLayer(id)).toBeDefined();
  }
  await expect(map.hasImage("us-zone-pattern-REQ_AUTHORIZATION")).toBe(true);
  await expect(map.hasImage("us-zone-pattern-CONDITIONAL")).toBe(true);
  // The five types reached the map's source, MultiPolygon included.
  await waitFor(
    async () => {
      const types = new Set(
        map
          .querySourceFeatures("us-zones")
          .map((f) => String(f.properties["type"])),
      );
      await expect(types.size).toBe(5);
    },
    { timeout: 20000 },
  );
  // MapLibre accepted every layer, expression and image.
  await expect(errors).toEqual([]);
  const legend = within(canvasElement).getByRole("region", {
    name: /Zone types|ზონების ტიპები/,
  });
  await expect(legend.querySelectorAll("li")).toHaveLength(5);
};

export const ZonesEnglishLight: Story = {
  globals: { lang: "en", scheme: "light" },
  args: { scheme: "light" },
  play: zonesPlay,
};

export const ZonesGeorgianDark: Story = {
  globals: { lang: "ka", scheme: "dark" },
  args: { scheme: "dark" },
  play: zonesPlay,
};

const restrictionIds = restrictionLayerIds("us-restrictions");

export const RestrictionTrio: Story = {
  globals: { lang: "en", scheme: "light" },
  args: { scheme: "light", restrictions: true },
  play: async ({ canvasElement }) => {
    const { map, errors } = await loaded(canvasElement);
    await expect(
      map.getPaintProperty(restrictionIds.lines.planned, "line-dasharray"),
    ).toEqual([3, 2]);
    await expect(
      map.getPaintProperty(restrictionIds.lines.active, "line-dasharray"),
    ).toBeUndefined();
    await waitFor(
      async () => {
        const states = map
          .querySourceFeatures("us-restrictions")
          .map((f) => String(f.properties["restrictionState"]));
        await expect(new Set(states)).toEqual(
          new Set(["planned", "active", "ended"]),
        );
      },
      { timeout: 20000 },
    );
    await expect(errors).toEqual([]);
  },
};

export const RestrictionTrioGeorgianDark: Story = {
  globals: { lang: "ka", scheme: "dark" },
  args: { scheme: "dark", restrictions: true },
  play: async ({ canvasElement }) => {
    const { errors } = await loaded(canvasElement);
    await expect(errors).toEqual([]);
  },
};

// --- the hover card and the legend, on their own -----------------------------

function Cards() {
  const { lang } = useLang();
  const zones = storyZones(lang);
  const [restriction] = storyRestrictions(lang).slice(1);
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

const cardsPlay =
  (lang: Lang): NonNullable<StoryObj["play"]> =>
  async ({ canvasElement }) => {
    const cards = canvasElement.querySelectorAll(".us-zone-card");
    await expect(cards).toHaveLength(4);
    const applicability = [...cards].map(
      (c) =>
        c.querySelector('[data-field="applicability"] dd')?.textContent ?? null,
    );
    await expect(applicability[0]).toMatch(
      lang === "en" ? /^Applies now/ : /^ახლა მოქმედებს/,
    );
    // applies: null says nothing about applicability.
    await expect(applicability[1]).toBeNull();
    await expect(applicability[2]).toMatch(
      lang === "en" ? /^Does not apply now/ : /^ახლა არ მოქმედებს/,
    );
    await expect(cards[0]?.textContent).toContain("UTC");
  };

export const HoverCardEnglish: StoryObj = {
  render: () => <Cards />,
  globals: { lang: "en", scheme: "light" },
  play: cardsPlay("en"),
};

export const HoverCardGeorgian: StoryObj = {
  render: () => <Cards />,
  globals: { lang: "ka", scheme: "dark" },
  play: cardsPlay("ka"),
};

function Legend() {
  return (
    <div style={{ maxWidth: 320 }}>
      <ZoneLegend counts={{ PROHIBITED: 1, REQ_AUTHORIZATION: 1, USPACE: 1 }} />
    </div>
  );
}

const legendPlay: NonNullable<StoryObj["play"]> = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole("button", {
    name: /Zone types|ზონების ტიპები/,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await userEvent.tab();
  await expect(toggle).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await userEvent.keyboard("{Enter}");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
};

export const LegendEnglishLight: StoryObj = {
  render: () => <Legend />,
  globals: { lang: "en", scheme: "light" },
  play: legendPlay,
};

export const LegendGeorgianDark: StoryObj = {
  render: () => <Legend />,
  globals: { lang: "ka", scheme: "dark" },
  play: legendPlay,
};

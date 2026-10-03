import type { Map as MapLibreMap } from "maplibre-gl";
import { waitFor, within } from "@testing-library/react";
import { useMemo, useState } from "react";
import { expect } from "vitest";
import { userEvent } from "vitest/browser";

import {
  AlertList,
  AlertSummary,
  AlertToaster,
} from "../../src/alerts/index.js";
import { useLang } from "../../src/i18n/index.js";
import {
  AlertLayer,
  TrackLayer,
  alertLayerIds,
  layerCounters,
} from "../../src/layers/index.js";
import { MapView } from "../../src/map/index.js";
import type { AlertView } from "../../src/model/index.js";
import "../../styles/map.css";
import { basemapBaseUrl } from "../map/basemap.js";
import { STALE_AFTER_S, fixtureTracks } from "../tracks/tracks.js";
import {
  EVERY_KIND,
  FIXED_NOW_MS,
  SERVER_REPEAT_MS,
  everyKind,
  skyAlerts,
} from "./alerts.js";

// WP-11: the alert list with every kind raised and cleared, one summary
// per kind, the toaster with its sound control, and the alert layer over
// the WP-7 fixture sky, in both languages and both schemes. The map
// renders on SwiftShader for smoke only (PLAN D9): the checks read what
// MapLibre holds, never pixels. Shared by alerts.test.tsx and the golden
// set.

export const LOST = /lost|დაკარგ/i;

/** The list with acknowledge and select wired to local state. */
export function ListView(props: { canAcknowledge?: boolean }) {
  const [alerts, setAlerts] = useState(everyKind);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div style={{ maxWidth: 720 }} data-selected={selected ?? ""}>
      <AlertList
        alerts={alerts}
        nowMs={FIXED_NOW_MS}
        canAcknowledge={props.canAcknowledge ?? true}
        onAcknowledge={(a) => {
          setAlerts((list) =>
            list.map((x) =>
              x.alertId === a.alertId ? { ...x, acknowledged: true } : x,
            ),
          );
        }}
        onSelect={(a) => {
          setSelected(a.alertId);
        }}
      />
    </div>
  );
}

/** Every kind raised and cleared: present, in words, with no key shown. */
export function checkList(canvas: HTMLElement): void {
  const rows = [...canvas.querySelectorAll<HTMLElement>("li[data-alert-id]")];
  expect(rows).toHaveLength(EVERY_KIND.length * 2);
  const seen = (state: string) =>
    new Set(
      rows
        .filter((r) => r.dataset["state"] === state)
        .map((r) => r.querySelector('[data-part="kind"]')?.textContent),
    ).size;
  expect(seen("raised")).toBe(EVERY_KIND.length);
  expect(seen("cleared")).toBe(EVERY_KIND.length);
  // Critical rows first.
  const severities = rows.map((r) => r.dataset["severity"]);
  expect(severities.indexOf("critical")).toBe(0);
  expect(severities.lastIndexOf("critical")).toBeLessThan(
    severities.indexOf("warning"),
  );
  for (const r of rows) {
    expect(r.textContent).not.toMatch(/alert\.|[{}]/);
    expect(r.querySelector("[data-glyph]")).not.toBeNull();
  }
  expect(canvas.textContent).not.toMatch(LOST);
}

/** Acknowledge by mouse and select by keyboard (Tab, Enter). */
export async function checkListActions(canvas: HTMLElement): Promise<void> {
  const first = canvas.querySelector<HTMLElement>("li[data-alert-id]");
  if (first === null) throw new Error("no rows");
  const buttons = within(first).getAllByRole("button");
  const [ack, show] = buttons as [HTMLElement, HTMLElement];
  await userEvent.click(ack);
  await waitFor(() => expect(first.dataset["acknowledged"]).toBe("true"));
  // The acknowledge button is gone; "show" is the row's one button now.
  expect(within(first).getAllByRole("button")).toHaveLength(1);
  (within(first).getByRole("button") as HTMLElement).focus();
  expect(document.activeElement?.textContent).toBe(show.textContent);
  await userEvent.keyboard("{Enter}");
  const host = canvas.querySelector<HTMLElement>("[data-selected]");
  await waitFor(() =>
    expect(host?.dataset["selected"]).toBe(first.dataset["alertId"]),
  );
}

/** One summary per kind, raised and cleared (golden). */
export function Summaries() {
  const { lang } = useLang();
  const alerts = useMemo(() => everyKind(), []);
  return (
    <ul
      className="m-0 grid list-none gap-1 p-0 text-sm"
      data-testid="summaries"
    >
      {alerts.map((a: AlertView) => (
        <li key={a.alertId} data-kind={a.kind} data-state={a.state}>
          <AlertSummary alert={a} lang={lang} />
        </li>
      ))}
    </ul>
  );
}

export function checkSummaries(canvas: HTMLElement, unit: RegExp): void {
  const items = [
    ...within(canvas)
      .getByTestId("summaries")
      .querySelectorAll<HTMLElement>("li"),
  ];
  expect(items).toHaveLength(EVERY_KIND.length * 2);
  for (const li of items) {
    expect(li.textContent?.trim()).not.toBe("");
    expect(li.textContent).not.toMatch(/alert\.|[{}]/);
  }
  const proximity = items.find(
    (li) =>
      li.dataset["kind"] === "proximity" && li.dataset["state"] === "raised",
  );
  expect(proximity?.textContent).toMatch(unit);
}

/** The toaster over every kind, the tone governed by the server's period. */
export function ToasterView() {
  const alerts = useMemo(() => everyKind().slice(0, 4), []);
  return (
    <div style={{ minHeight: 480 }}>
      <AlertToaster
        alerts={alerts}
        critical={{ tone: true, repeatMs: SERVER_REPEAT_MS }}
      />
    </div>
  );
}

export async function checkToaster(
  canvas: HTMLElement,
  enable: RegExp,
): Promise<void> {
  const toaster = canvas.querySelector<HTMLElement>("[data-alert-toaster]");
  if (toaster === null) throw new Error("no toaster");
  // One notice per alert, none stacked.
  const toasts = [...toaster.querySelectorAll<HTMLElement>("li[data-toast]")];
  expect(new Set(toasts.map((t) => t.dataset["toast"])).size).toBe(
    toasts.length,
  );
  expect(toasts.length).toBeGreaterThan(0);
  // Muted until a gesture: a visible state with its control.
  const control = toaster.querySelector<HTMLElement>("[data-tone]");
  expect(control?.dataset["tone"]).toBe("needs_gesture");
  await userEvent.click(within(toaster).getByRole("button", { name: enable }));
  await waitFor(() => expect(control?.dataset["tone"]).toBe("on"));
  expect(control?.dataset["sounding"]).toBe("true");
}

interface Loaded {
  map: MapLibreMap;
  errors: string[];
}
const maps = new WeakMap<Element, Loaded>();

// Display-only sample camera over the committed extract.
const TBILISI = {
  center: [44.799, 41.7015] as [number, number],
  zoom: 12.8,
  bearing: 0,
  pitch: 0,
};

/** The alert layer over the WP-7 fixture sky. */
export function AlertMap(props: { scheme: "light" | "dark" }) {
  const { lang } = useLang();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const tracks = useMemo(() => fixtureTracks(), []);
  const byId = useMemo(
    () => new Map(tracks.map((t) => [t.trackId, t])),
    [tracks],
  );
  const alerts = useMemo(() => skyAlerts(), []);
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_22rem]">
      <div ref={setHost} style={{ height: 520 }} data-testid="map-host">
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
          <TrackLayer
            tracks={tracks}
            staleAfterS={STALE_AFTER_S}
            nowMs={FIXED_NOW_MS}
          />
          <AlertLayer alerts={alerts} tracks={byId} />
        </MapView>
      </div>
      <AlertList
        alerts={alerts}
        tracks={byId}
        nowMs={FIXED_NOW_MS}
        canAcknowledge={false}
      />
    </div>
  );
}

type Props = Record<string, unknown>;

export async function checkAlertMap(canvas: HTMLElement): Promise<void> {
  const host = within(canvas).getByTestId("map-host");
  await waitFor(() => expect(host.getAttribute("data-loaded")).toBe("true"), {
    timeout: 20000,
  });
  const loaded = maps.get(host);
  if (loaded === undefined) throw new Error("onLoad did not hand over the map");
  const { map, errors } = loaded;
  const ids = alertLayerIds("us-alerts");
  for (const id of [ids.line, ids.lineDashed, ids.ring]) {
    expect(map.getLayer(id)).toBeDefined();
  }
  await waitFor(
    () => {
      const features = map.querySourceFeatures("us-alerts");
      const lines = features.filter((f) => f.geometry.type === "LineString");
      const rings = features.filter((f) => f.geometry.type === "Point");
      // A feature crossing tiles comes back once per tile: one per alert.
      const props = (fs: typeof features): Props[] => [
        ...new Map(
          fs.map((f) => {
            const p = f.properties as Props;
            return [String(p["alertId"]), p] as const;
          }),
        ).values(),
      ];
      // A dashed line (broadcast party) and a solid one.
      expect(
        props(lines)
          .map((p) => p["dashed"])
          .sort(),
      ).toEqual([false, true]);
      // A ring for the missing peer's known party, the zone and the
      // height alerts; nothing for the cleared one.
      expect(
        props(rings)
          .map((p) => p["alertId"])
          .sort(),
      ).toEqual(["TEST-ALR-0003", "TEST-ALR-0004", "TEST-ALR-0005"]);
    },
    { timeout: 20000 },
  );
  expect(layerCounters().alert_peer_missing).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  // The list beside the map says the broadcast party is unverified.
  const caveats = canvas.querySelectorAll('[data-part="caveat"]');
  expect(caveats.length).toBeGreaterThan(0);
}

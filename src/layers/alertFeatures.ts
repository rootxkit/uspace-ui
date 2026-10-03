// What AlertLayer puts on the map (docs/PLAN.md §3.9, WP-11): for a
// `proximity` alert a line between the two aircraft positions, for every
// other kind a ring on each aircraft, nothing for a cleared alert.
// Positions are the tracks' as the API sent them, looked up by id;
// nothing here computes a position, a distance or a closest point. A
// party that is not in the track map is never guessed: the line becomes
// a ring on the party that is, and the gap is counted.
import type * as GeoJSON from "geojson";

import { alertPeer } from "../alerts/summary.js";
import type { AlertView, Severity, TrackView } from "../model/index.js";
import { countLayer } from "./counters.js";

export interface AlertFeatureProperties {
  alertId: string;
  kind: AlertView["kind"];
  severity: Severity;
  /** True when a party is broadcast and unverified (R-05): drawn dashed. */
  dashed: boolean;
  /** The track the ring sits on; absent on a line. */
  trackId?: string;
}

export type AlertFeature = GeoJSON.Feature<
  GeoJSON.LineString | GeoJSON.Point,
  AlertFeatureProperties
>;

export type AlertFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString | GeoJSON.Point,
  AlertFeatureProperties
>;

/**
 * The ids of the alerts currently counted as missing a party, so each is
 * counted once while it stays so (CLAUDE.md rule 9) and not on every
 * frame.
 */
export class AlertGaps {
  readonly peer = new Set<string>();
  readonly aircraft = new Set<string>();

  note(set: Set<string>, id: string, missing: boolean): void {
    if (!missing) {
      set.delete(id);
      return;
    }
    if (set.has(id)) return;
    set.add(id);
    countLayer(
      set === this.peer ? "alert_peer_missing" : "alert_aircraft_missing",
    );
  }

  /** Forgets alerts that are no longer passed. */
  keep(ids: ReadonlySet<string>): void {
    for (const set of [this.peer, this.aircraft]) {
      for (const id of [...set]) if (!ids.has(id)) set.delete(id);
    }
  }
}

const point = (t: TrackView): [number, number] => [t.lng, t.lat];

/** The parties of an alert: its aircraft, then the proximity peer. */
function parties(a: AlertView): string[] {
  const out = [...new Set(a.aircraft)];
  const peer = alertPeer(a).trackId;
  if (peer !== null && !out.includes(peer)) out.push(peer);
  return out;
}

export function alertFeatureCollection(
  alerts: Iterable<AlertView>,
  tracks: ReadonlyMap<string, TrackView>,
  gaps: AlertGaps,
): AlertFeatureCollection {
  const features: AlertFeature[] = [];
  const ids = new Set<string>();
  for (const a of alerts) {
    ids.add(a.alertId);
    if (a.state === "cleared") {
      gaps.note(gaps.peer, a.alertId, false);
      gaps.note(gaps.aircraft, a.alertId, false);
      continue;
    }
    const all = parties(a);
    const present = all
      .map((id) => tracks.get(id))
      .filter((t): t is TrackView => t !== undefined);
    const dashed =
      alertPeer(a).trust === "broadcast" ||
      present.some((t) => t.trust === "broadcast");
    const base = { alertId: a.alertId, kind: a.kind, severity: a.severity };
    gaps.note(gaps.aircraft, a.alertId, present.length === 0);
    if (a.kind === "proximity") {
      const [one, two] = present;
      gaps.note(gaps.peer, a.alertId, all.length < 2 || two === undefined);
      if (one !== undefined && two !== undefined) {
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [point(one), point(two)],
          },
          properties: { ...base, dashed },
        });
        continue;
      }
    }
    for (const t of present) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: point(t) },
        properties: { ...base, dashed, trackId: t.trackId },
      });
    }
  }
  gaps.keep(ids);
  return { type: "FeatureCollection", features };
}

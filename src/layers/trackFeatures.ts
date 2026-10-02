// What TrackLayer holds between frames and the features it puts on the
// map (docs/PLAN.md §3.9, WP-7). The hold is display hygiene, not a
// judgement: it keeps each track's newest sample so that a sample the
// socket delivered late cannot move the symbol backwards (LESSONS T-13,
// counted, never reordered), sends `backlog` samples to the trail only
// (T-04: history is never drawn as live), and bounds every trail (E-10).
// Positions are the API's, passed through; nothing here computes one.
import type * as GeoJSON from "geojson";

import { DASH, fmtRegistrationNumber } from "../i18n/format.js";
import type { Translate } from "../i18n/translate.js";
import type { TrackView } from "../model/index.js";
import type { AgeBucket } from "../theme/tokens.js";
import { ageBucket } from "../symbology/age.js";
import {
  IDENT_STATUS_KEYS,
  identDrawn,
  identMark,
  type IdentKey,
} from "../symbology/ident.js";
import type {
  TrackFeatureProperties,
  TrailFeatureProperties,
} from "../symbology/track.js";
import { countLayer } from "./counters.js";

// RFC 3339 UTC with `Z` (spec 02 §1), any number of fraction digits.
const UTC = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/;

/**
 * Orders two `capturedAt` values as written, without a clock or a `Date`:
 * the seconds part compares as text, the fraction padded to nanoseconds.
 * Negative when `a` is older, 0 when equal, positive when newer; null when
 * either is not RFC 3339 UTC, so the two cannot be ordered.
 */
export function compareCapturedAt(a: string, b: string): number | null {
  const ma = UTC.exec(a);
  const mb = UTC.exec(b);
  if (ma === null || mb === null) return null;
  const sa = ma[1] ?? "";
  const sb = mb[1] ?? "";
  if (sa !== sb) return sa < sb ? -1 : 1;
  const fa = (ma[2] ?? "").padEnd(9, "0");
  const fb = (mb[2] ?? "").padEnd(9, "0");
  return fa === fb ? 0 : fa < fb ? -1 : 1;
}

interface Held {
  /** The newest live sample; null while only backlog has arrived. */
  view: TrackView | null;
  /** The newest sample of any kind, for the trail's colour. */
  latest: TrackView;
  /** The last sample object handed over, applied or not. */
  lastSeen: TrackView;
  /** Trail positions, oldest first, at most `trailPoints`. */
  trail: [number, number][];
}

/**
 * The per-id state of one TrackLayer. `apply` takes every track the app
 * shows, each time it changes; an id the app no longer passes is dropped
 * with its trail (the store removed it, with its reason, WP-8).
 */
export class TrackHold {
  private readonly held = new Map<string, Held>();
  private trailPoints = 0;
  private version = 0;

  /** Applies `tracks`; returns a number that changes when the hold did. */
  apply(tracks: readonly TrackView[], trailPoints: number): number {
    let changed = false;
    if (trailPoints !== this.trailPoints) {
      this.trailPoints = trailPoints;
      for (const h of this.held.values()) this.trim(h);
      changed = true;
    }
    const seen = new Set<string>();
    for (const t of tracks) {
      seen.add(t.trackId);
      const h = this.held.get(t.trackId);
      if (h === undefined) {
        this.held.set(t.trackId, {
          view: t.times.backlog ? null : t,
          latest: t,
          lastSeen: t,
          trail: [],
        });
        this.push(this.held.get(t.trackId) as Held, t);
        changed = true;
        continue;
      }
      // The same object again (the app re-rendered with its snapshot):
      // already applied, or already ignored and counted.
      if (h.lastSeen === t) continue;
      h.lastSeen = t;
      if (t.times.backlog) {
        h.latest = t;
        this.push(h, t);
        changed = true;
        continue;
      }
      if (h.view !== null) {
        const order = compareCapturedAt(
          t.times.capturedAt,
          h.view.times.capturedAt,
        );
        if (order === null) {
          countLayer("track_time_unordered");
        } else if (order < 0) {
          countLayer("track_out_of_order");
          continue;
        } else if (order === 0) {
          // The same sample with other fields (an identification update):
          // no new trail point.
          h.view = t;
          h.latest = t;
          changed = true;
          continue;
        }
      }
      h.view = t;
      h.latest = t;
      this.push(h, t);
      changed = true;
    }
    for (const id of [...this.held.keys()]) {
      if (!seen.has(id)) {
        this.held.delete(id);
        changed = true;
      }
    }
    if (changed) this.version += 1;
    return this.version;
  }

  private push(h: Held, t: TrackView): void {
    if (this.trailPoints <= 0) return;
    h.trail.push([t.lng, t.lat]);
    this.trim(h);
  }

  private trim(h: Held): void {
    const over = h.trail.length - (this.trailPoints > 0 ? this.trailPoints : 0);
    if (over <= 0) return;
    h.trail.splice(0, over);
    for (let i = 0; i < over; i++) countLayer("trail_point_evicted");
  }

  /** Tests and features: what is held, by id. */
  entries(): IterableIterator<[string, Readonly<Held>]> {
    return this.held.entries();
  }
}

export type TrackFeature = GeoJSON.Feature<
  GeoJSON.Point,
  TrackFeatureProperties
>;
export type TrailFeature = GeoJSON.Feature<
  GeoJSON.LineString,
  TrailFeatureProperties
>;
export type TrackFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point | GeoJSON.LineString,
  TrackFeatureProperties | TrailFeatureProperties
>;

/**
 * Seconds since this console received the sample: two readings of the
 * browser clock (`receivedAtMs`, stamped by the live store, and the app's
 * `nowMs` tick), never the server's times (04 §2: an age counts from
 * receipt or from capture, never a mix).
 */
export function receivedAgeS(t: TrackView, nowMs: number): number | null {
  const age = (nowMs - t.receivedAtMs) / 1000;
  return Number.isFinite(age) ? age : null;
}

/**
 * The label: the registration number's public part, else the serial, else
 * "unidentified"; an unidentified track or one with no identification
 * says so whatever it broadcast (I-02). Further lines carry what must not
 * be lost when the label is read alone: a status that is not registered,
 * a mismatch (G-02), the broadcast or provider caveat (R-05, PLAN §14
 * Q18) and an emergency.
 */
export function trackLabel(
  t: TrackView,
  drawn: IdentKey,
  tr: Translate,
): string {
  const id = t.identification;
  const lines: string[] = [];
  if (drawn === "unidentified" || drawn === "none" || id === null) {
    lines.push(tr(IDENT_STATUS_KEYS[drawn]));
  } else {
    const reg = fmtRegistrationNumber(id.operatorReg);
    const serial = id.serial?.trim() ?? "";
    lines.push(
      reg !== DASH
        ? reg
        : serial !== ""
          ? serial
          : tr("track.label.unidentified"),
    );
    if (drawn !== "registered") lines.push(tr(IDENT_STATUS_KEYS[drawn]));
  }
  if (id?.mismatch === true) lines.push(tr("ident.mismatch_short"));
  if (t.trust === "broadcast") lines.push(tr("track.broadcast"));
  if (t.trust === "provider") lines.push(tr("track.provider"));
  if (t.emergency) lines.push(tr("track.emergency"));
  return lines.join("\n");
}

export interface FeatureOptions {
  nowMs: number;
  staleAfterS: number;
  selectedId: string | null;
  t: Translate;
}

/**
 * One point per track with a live sample and one line per trail of two
 * points or more. A track that has only sent backlog has a trail and no
 * point (T-04), and its trail draws as `stale`: it is history.
 */
export function trackFeatureCollection(
  hold: TrackHold,
  opts: FeatureOptions,
): TrackFeatureCollection {
  const trails: TrailFeature[] = [];
  const points: TrackFeature[] = [];
  for (const [id, h] of hold.entries()) {
    const age: AgeBucket =
      h.view === null
        ? "stale"
        : ageBucket(receivedAgeS(h.view, opts.nowMs), opts.staleAfterS);
    if (h.trail.length >= 2) {
      trails.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: h.trail.map((p) => [...p]),
        },
        properties: {
          kind: "trail",
          identifier: id,
          ident: identDrawn(h.latest.identification),
          age,
        },
      });
    }
    const v = h.view;
    if (v === null) continue;
    const drawn = identDrawn(v.identification);
    points.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [v.lng, v.lat] },
      properties: {
        kind: "track",
        identifier: id,
        trust: v.trust,
        ident: drawn,
        mark: identMark(drawn),
        trackDeg: v.trackDeg,
        emergency: v.emergency,
        selected: id === opts.selectedId,
        age,
        label: trackLabel(v, drawn, opts.t),
      },
    });
  }
  return { type: "FeatureCollection", features: [...trails, ...points] };
}

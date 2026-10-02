// PLAN §8 "WS frame to painted position": 200 tracks in view, 400 upserts
// handed to TrackLayer in one burst (one second of the budget's message
// rate, 200 tracks x 2 Hz, arriving at once: the worst case for a frame),
// timed from the first upsert until the source has the data and the next
// animation frame has run. Reported, not gated (PLAN §9): the play
// function prints the numbers to the test log and the story shows them.
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import { TrackLayer } from "../../src/layers/index.js";
import { MapView } from "../../src/map/index.js";
import type { TrackView } from "../../src/model/index.js";
import "../../styles/map.css";
import { STORY_NOW_MS, STORY_STALE_AFTER_S, storyTracks } from "./tracks.js";

const TRACKS = 200;
const UPSERTS = 400;
const ROUNDS = 20;

// Synthetic display positions around the extract's centre: data to draw,
// not a judgement.
function initial(): TrackView[] {
  const sky = storyTracks();
  return Array.from({ length: TRACKS }, (_, i) => {
    const base = sky[i % sky.length] as TrackView;
    return {
      ...base,
      trackId: `TEST-BENCH-${i}`,
      lng: 44.775 + (i % 20) * 0.0025,
      lat: 41.683 + Math.floor(i / 20) * 0.0042,
    };
  });
}

function upserted(t: TrackView, round: number, k: number): TrackView {
  const capturedAt = new Date(STORY_NOW_MS + round * 1000 + k).toISOString();
  return {
    ...t,
    lng: t.lng + 1e-5,
    times: { ...t.times, capturedAt, backlog: false },
  };
}

interface Result {
  meanMs: number;
  p99Ms: number;
  maxMs: number;
}

function storyBaseUrl(): string {
  const { href, origin, pathname } = window.location;
  return pathname.endsWith("iframe.html") ? new URL(".", href).href : origin;
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

function TrackBenchmark() {
  const start = useMemo(() => initial(), []);
  const [tracks, setTracks] = useState(start);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const current = useRef(start);
  useEffect(() => {
    if (map === null) return;
    let cancelled = false;
    void (async () => {
      const times: number[] = [];
      for (let round = 1; round <= ROUNDS && !cancelled; round++) {
        const loaded = new Promise<void>((resolve) => {
          const onData = (e: {
            sourceId?: string;
            isSourceLoaded?: boolean;
          }) => {
            if (e.sourceId !== "us-tracks" || e.isSourceLoaded !== true) return;
            map.off("sourcedata", onData);
            resolve();
          };
          map.on("sourcedata", onData);
        });
        const t0 = performance.now();
        // 400 upserts, each a new snapshot as a store would hand over.
        for (let k = 0; k < UPSERTS; k++) {
          const i = k % TRACKS;
          const next = current.current.slice();
          next[i] = upserted(next[i] as TrackView, round, k);
          current.current = next;
          setTracks(next);
        }
        await loaded;
        await nextFrame();
        times.push(performance.now() - t0);
      }
      if (cancelled) return;
      times.sort((a, b) => a - b);
      setResult({
        meanMs: times.reduce((a, b) => a + b, 0) / times.length,
        p99Ms: times[Math.floor(times.length * 0.99)] ?? Number.NaN,
        maxMs: times.at(-1) ?? Number.NaN,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [map]);
  return (
    <main>
      <h1>TrackLayer benchmark</h1>
      <p data-testid="result">
        {result === null
          ? "running"
          : `${UPSERTS} upserts on ${TRACKS} tracks to the next frame, over ${ROUNDS} rounds: mean ${result.meanMs.toFixed(1)} ms, p99 ${result.p99Ms.toFixed(1)} ms, max ${result.maxMs.toFixed(1)} ms`}
      </p>
      <div style={{ width: 480, height: 360 }}>
        <MapView
          basemap={{ baseUrl: storyBaseUrl() }}
          initial={{ center: [44.8, 41.704], zoom: 13.5, bearing: 0, pitch: 0 }}
          lang="en"
          scheme="light"
          onLoad={setMap}
        >
          <TrackLayer
            tracks={tracks}
            staleAfterS={STORY_STALE_AFTER_S}
            nowMs={STORY_NOW_MS}
          />
        </MapView>
      </div>
    </main>
  );
}

const meta = {
  title: "layers/Benchmarks",
  component: TrackBenchmark,
} satisfies Meta<typeof TrackBenchmark>;

export default meta;

export const TrackLayer400Upserts: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const out = within(canvasElement).getByTestId("result");
    await waitFor(() => expect(out.textContent).toContain("mean"), {
      timeout: 25000,
    });
    // Reported in the test log, not gated.
    console.info(`[bench] ${out.textContent ?? ""}`);
  },
};

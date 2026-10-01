// PLAN §8 "GeoJSON source update": the cost of one `setData` on a GeoJSON
// source holding 200 point features, on a real MapLibre map in Chromium.
// 400 calls per second is the budget's message rate (200 tracks x 2 Hz).
// Reported, not gated (PLAN §9): the play function prints the numbers to
// the test log and the story shows them. A story rather than a vitest
// `bench` because Vitest 4's browser mode returned no samples for a bench.
import type { FeatureCollection, Point } from "geojson";
import type { GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import { maplibre } from "../../src/map/maplibre.js";
import "../../styles/map.css";

const FEATURES = 200;
const CALLS = 400;

// Synthetic display positions around the extract's centre: data to draw,
// not a judgement.
function collection(step: number): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: Array.from({ length: FEATURES }, (_, i) => ({
      type: "Feature",
      id: i,
      geometry: {
        type: "Point",
        coordinates: [
          44.75 + (i % 20) * 0.005 + step * 1e-5,
          41.68 + Math.floor(i / 20) * 0.005,
        ],
      },
      properties: { trackId: `TEST${i}` },
    })),
  };
}

interface Result {
  meanMs: number;
  p99Ms: number;
  totalMs: number;
  /** setData to the source reporting loaded, MapLibre's worker included. */
  loadedMeanMs: number;
}

// Calls timed end to end: each waits for the worker to finish the last.
const LOADED_SAMPLES = 50;

function SetDataBenchmark() {
  const container = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    const el = container.current;
    if (el === null) return;
    const map = new maplibre.Map({
      container: el,
      style: { version: 8, sources: {}, layers: [] },
      center: [44.8, 41.7],
      zoom: 12,
    });
    const frames = Array.from({ length: CALLS }, (_, i) => collection(i));
    map.once("load", async () => {
      map.addSource("tracks", { type: "geojson", data: collection(0) });
      map.addLayer({ id: "tracks", type: "circle", source: "tracks" });
      const source = map.getSource("tracks") as GeoJSONSource;
      const times: number[] = [];
      for (const frame of frames) {
        const t0 = performance.now();
        source.setData(frame);
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      const totalMs = times.reduce((a, b) => a + b, 0);
      // MapLibre coalesces setData and hands the work to a worker, so the
      // call alone is cheap; this times the whole update.
      let loadedMs = 0;
      for (let i = 0; i < LOADED_SAMPLES; i += 1) {
        const t0 = performance.now();
        await new Promise<void>((resolve) => {
          const onData = (e: {
            sourceId?: string;
            isSourceLoaded?: boolean;
          }) => {
            if (e.sourceId !== "tracks" || e.isSourceLoaded !== true) return;
            map.off("sourcedata", onData);
            resolve();
          };
          map.on("sourcedata", onData);
          source.setData(frames[i] as FeatureCollection<Point>);
        });
        loadedMs += performance.now() - t0;
      }
      setResult({
        meanMs: totalMs / CALLS,
        p99Ms: times[Math.floor(CALLS * 0.99)] ?? Number.NaN,
        totalMs,
        loadedMeanMs: loadedMs / LOADED_SAMPLES,
      });
    });
    return () => map.remove();
  }, []);
  return (
    <main>
      <h1>setData benchmark</h1>
      <p data-testid="result">
        {result === null
          ? "running"
          : `${CALLS} setData calls on ${FEATURES} features: mean ${result.meanMs.toFixed(3)} ms, p99 ${result.p99Ms.toFixed(3)} ms, total ${result.totalMs.toFixed(1)} ms; setData to source loaded: mean ${result.loadedMeanMs.toFixed(2)} ms over ${LOADED_SAMPLES}`}
      </p>
      <div ref={container} style={{ width: 400, height: 300 }} />
    </main>
  );
}

const meta = {
  title: "map/Benchmarks",
  component: SetDataBenchmark,
} satisfies Meta<typeof SetDataBenchmark>;

export default meta;

export const SetData200Features: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const out = within(canvasElement).getByTestId("result");
    await waitFor(() => expect(out.textContent).toContain("mean"), {
      timeout: 20000,
    });
    // Reported in the test log, not gated.
    console.info(`[bench] ${out.textContent ?? ""}`);
  },
};

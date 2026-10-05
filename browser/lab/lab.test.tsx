import { within } from "@testing-library/react";
import { expect, it } from "vitest";

import { AlertList } from "../../src/alerts/index.js";
import { useLang } from "../../src/i18n/index.js";
import { ZoneCard } from "../../src/layers/index.js";
import { utcMs } from "../../src/live/index.js";
import type { TrackView } from "../../src/model/index.js";
import {
  FeedStatusBar,
  SourcesPanel,
  TrackDetail,
} from "../../src/status/index.js";
import { fixtures } from "../../src/test/index.js";
import { EN_LIGHT, KA_DARK, renderKit } from "../kit.js";

// WP-14: the components a console builds its picture from, rendered from
// the lab-derived fixtures (the lab's schema examples through the
// reference adapters) in both languages and both schemes, axe after each
// (browser/setup.ts). A shape the lab can emit that the kit renders badly
// shows up here as an axe failure, a missing key or a thrown error.

const lab = fixtures({ source: "lab" });
// The fixtures' own clock: the newest server time they carry.
const NOW_MS = utcMs(lab.status.serverTs ?? "") ?? 0;
const tracks: ReadonlyMap<string, TrackView> = new Map(
  lab.tracks.map((t) => [t.trackId, t]),
);

function Picture() {
  const { lang } = useLang();
  return (
    <div className="grid gap-4" style={{ maxWidth: 520 }}>
      <FeedStatusBar status={lab.status} nowMs={NOW_MS} />
      <AlertList
        alerts={lab.alerts}
        tracks={tracks}
        nowMs={NOW_MS}
        canAcknowledge={false}
      />
      <SourcesPanel sources={lab.sources} nowMs={NOW_MS} canSwitch={false} />
      {[...lab.tracks, ...lab.manned].map((t) => (
        <div key={t.trackId} data-lab-track={t.trackId}>
          <TrackDetail
            track={t}
            nowMs={NOW_MS}
            staleAfterS={lab.status.staleAfterS}
          />
        </div>
      ))}
      {lab.zones.map((z) => (
        <div key={z.identifier} data-lab-zone={z.identifier}>
          <ZoneCard zone={z} lang={lang} />
        </div>
      ))}
    </div>
  );
}

function check(container: HTMLElement): void {
  expect(container.querySelectorAll("[data-lab-track]")).toHaveLength(
    lab.tracks.length + lab.manned.length,
  );
  expect(container.querySelectorAll("[data-lab-zone]")).toHaveLength(
    lab.zones.length,
  );
  // Nothing the adapters left null reads as a number or a word it is not.
  expect(container.textContent ?? "").not.toMatch(/undefined|NaN|null/);
}

it("the lab's picture (en light)", () => {
  const { container } = renderKit(<Picture />, EN_LIGHT);
  check(container);
  // A broadcast track says so (R-05), as the lab's direct RID example is.
  expect(within(container).getAllByText(/unverified/).length).toBeGreaterThan(
    0,
  );
});

it("the lab's picture (ka dark)", () => {
  const { container } = renderKit(<Picture />, KA_DARK);
  check(container);
  expect(within(container).getAllByText(/დაუდასტურებ/).length).toBeGreaterThan(
    0,
  );
});

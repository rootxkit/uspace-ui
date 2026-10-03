// TrackDetail (WP-12), in jsdom, in both languages: the R-05 pair (a
// broadcast registration says "as broadcast and unverified", an
// authenticated one does not), the R-09 pair (a pressure source reads
// "pressure altitude", never AMSL; a geodetic one reads AMSL), R-12 (over
// take-off is not "above ground", and the twin), every altitude row
// carrying its datum in the same string, every `Times` field labelled,
// the backlog badge with its twin, nulls as dashes, public registration
// parts only, the identification block, manned tracks, the app's links,
// and axe.
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { I18nProvider } from "../i18n/I18nProvider.js";
import { en } from "../i18n/en.js";
import { ka } from "../i18n/ka.js";
import type { Lang } from "../i18n/lang.js";
import {
  TRAFFIC_NOW_MS as NOW_MS,
  TRAFFIC_STALE_AFTER_S as STALE_AFTER_S,
  broadcastTrack,
  mannedTrack,
  uasTrack,
} from "../layers/traffic.testing.js";
import { TIME_SOURCES, type TrackView } from "../model/index.js";
import { axeCheck } from "../test/axe.js";
import type { MannedTrack } from "../symbology/manned.js";
import {
  TIME_SOURCE_KEYS,
  TrackDetail,
  isMannedTrack,
  sourceClassLabel,
  type TrackDetailProps,
} from "./TrackDetail.js";

afterEach(() => {
  cleanup();
});

function show(
  track: TrackView | MannedTrack,
  lang: Lang = "en",
  over: Partial<TrackDetailProps> = {},
) {
  const wrap = (ui: ReactNode) => (
    <I18nProvider lang={lang}>
      <div lang={lang}>{ui}</div>
    </I18nProvider>
  );
  const r = render(
    wrap(
      <TrackDetail
        track={track}
        nowMs={NOW_MS}
        staleAfterS={STALE_AFTER_S}
        {...over}
      />,
    ),
  );
  return r.container;
}

const field = (root: HTMLElement, name: string): HTMLElement | null =>
  root.querySelector(`[data-field="${name}"]`);
const value = (root: HTMLElement, name: string): string =>
  field(root, name)?.querySelector("dd")?.textContent ?? "(no row)";
const label = (root: HTMLElement, name: string): string =>
  field(root, name)?.querySelector("dt")?.textContent ?? "(no row)";

// The datum words of every altitude format (src/i18n/catalogue.test.ts
// pins the catalogue side).
const DATUM = {
  en: /AMSL|AGL|WGS84 ellipsoid|pressure altitude|above take-off|above ground/,
  ka: /ზღვის დონიდან|მიწიდან|ელიფსოიდიდან|ბარომეტრული სიმაღლე|აფრენის წერტილიდან/,
} as const;

describe("R-05: the broadcast caveat", () => {
  for (const lang of ["en", "ka"] as const) {
    it(`a broadcast registered track says as broadcast and unverified (${lang})`, () => {
      const root = show(broadcastTrack(), lang);
      const c = lang === "en" ? en : ka;
      expect(
        root.querySelector('[data-part="basis-caveat"]')?.textContent,
      ).toBe(c["ident.registered_as_broadcast"]);
      expect(
        root.querySelector('[data-part="broadcast-caveat"]')?.textContent,
      ).toBe(c["track.broadcast_caveat"]);
      expect(label(root, "instance")).toBe(c["detail.heard_by"]);
    });

    it(`an authenticated track does not (the twin, ${lang})`, () => {
      const root = show(uasTrack(), lang);
      expect(root.querySelector('[data-part="basis-caveat"]')).toBeNull();
      expect(root.querySelector('[data-part="broadcast-caveat"]')).toBeNull();
      expect(root.textContent).not.toMatch(/unverified|დაუდასტურებ/);
    });
  }

  it("a provider basis carries the provider caveat", () => {
    const t = uasTrack({ trust: "provider" });
    const root = show({
      ...t,
      identification: {
        ...(t.identification as NonNullable<TrackView["identification"]>),
        basis: "provider" as const,
      },
    });
    expect(root.querySelector('[data-part="basis-caveat"]')?.textContent).toBe(
      en["ident.caveat.provider"],
    );
  });
});

describe("altitudes and their datums", () => {
  it("a pressure altSource row says pressure altitude and not AMSL (R-09)", () => {
    const root = show(broadcastTrack());
    expect(label(root, "alt-amsl")).toBe("Pressure altitude");
    expect(value(root, "alt-amsl")).toBe("598 m pressure altitude");
    expect(field(root, "alt-amsl")?.textContent).not.toMatch(/AMSL|sea level/);
    expect(root.querySelector('[data-part="pressure-note"]')).not.toBeNull();
  });

  it("a geodetic altSource row says AMSL (the twin)", () => {
    const root = show(uasTrack());
    expect(label(root, "alt-amsl")).toBe("Altitude");
    expect(value(root, "alt-amsl")).toBe("552 m AMSL");
    expect(root.querySelector('[data-part="pressure-note"]')).toBeNull();
  });

  it("a network altSource says whose AMSL it is; none is a dash", () => {
    expect(value(show(uasTrack({ altSource: "network" })), "alt-amsl")).toMatch(
      /AMSL, as the network provider reported/,
    );
    cleanup();
    expect(value(show(uasTrack({ altSource: "none" })), "alt-amsl")).toBe("—");
  });

  it("TakeoffLocation says above take-off and never above ground (R-12)", () => {
    const root = show(uasTrack({ heightRef: "TakeoffLocation" }));
    expect(value(root, "height")).toBe("42 m above take-off");
    expect(value(root, "height")).not.toMatch(/ground|AGL/);
  });

  it("GroundLevel says above ground (the twin)", () => {
    const root = show(uasTrack({ heightRef: "GroundLevel" }));
    expect(value(root, "height")).toBe("42 m above ground");
  });

  it("the ellipsoid altitude says so", () => {
    expect(value(show(uasTrack()), "alt-wgs84")).toBe(
      "571 m above the WGS84 ellipsoid",
    );
  });

  const cases: [string, TrackView | MannedTrack][] = [
    ["authenticated", uasTrack()],
    ["broadcast", broadcastTrack()],
    ["manned", mannedTrack()],
  ];
  for (const lang of ["en", "ka"] as const) {
    for (const [name, track] of cases) {
      it(`every altitude line carries its datum in the same string (${name}, ${lang})`, () => {
        const root = show(track, lang);
        const rows = [
          ...root.querySelectorAll<HTMLElement>('[data-kind="altitude"]'),
        ];
        expect(rows.length).toBeGreaterThanOrEqual(2);
        for (const r of rows) {
          const v = r.querySelector("dd")?.textContent ?? "";
          if (v === "—") continue;
          expect(v, r.dataset["field"]).toMatch(DATUM[lang]);
        }
        // And no other line shows metres without a datum: every "N m"
        // (or "N მ") outside an altitude row is a speed or a distance.
        for (const dd of root.querySelectorAll("dd")) {
          if (dd.closest('[data-kind="altitude"]') !== null) continue;
          expect(dd.textContent ?? "").not.toMatch(/\d m$|\d m |\d მ$|\d მ /);
        }
      });
    }
  }
});

describe("times", () => {
  it("labels every Times field with its clock", () => {
    const root = show(uasTrack());
    expect(label(root, "ts")).toBe(en["detail.ts"]);
    expect(label(root, "rx-ts")).toBe(en["detail.rx_ts"]);
    expect(label(root, "captured-at")).toBe(en["detail.captured_at"]);
    expect(label(root, "time-source")).toBe(en["detail.time_source"]);
    for (const f of ["ts", "rx-ts", "captured-at"]) {
      expect(value(root, f), f).toMatch(/UTC$/);
    }
    expect(value(root, "captured-at")).toBe("2026-01-01 11:59:57 UTC");
  });

  it("names every time source", () => {
    for (const s of TIME_SOURCES) {
      const t = uasTrack();
      const root = show({ ...t, times: { ...t.times, timeSource: s } });
      expect(value(root, "time-source")).toBe(en[TIME_SOURCE_KEYS[s]]);
      cleanup();
    }
  });

  it("backlog: true shows the history badge", () => {
    const t = uasTrack();
    const root = show({ ...t, times: { ...t.times, backlog: true } });
    expect(root.querySelector('[data-part="backlog"]')?.textContent).toBe(
      en["detail.backlog"],
    );
  });

  it("a live sample has no history badge (the twin)", () => {
    expect(show(uasTrack()).querySelector('[data-part="backlog"]')).toBeNull();
  });

  it("the age since received carries its bucket; since captured needs the clock offset", () => {
    const root = show(uasTrack());
    expect(value(root, "age-received")).toBe("2 s · Live");
    expect(value(root, "age-captured")).toBe("—");
    cleanup();
    const withOffset = show(uasTrack(), "en", { clockOffsetMs: 0 });
    expect(value(withOffset, "age-captured")).toBe("2 s");
  });

  it("a stale track reads stale, never live", () => {
    const root = show(uasTrack({ receivedAtMs: NOW_MS - 600_000 }));
    expect(value(root, "age-received")).toBe("10 min · Stale");
    expect(
      root
        .querySelector('[data-field="age-received"] [data-age]')
        ?.getAttribute("data-age"),
    ).toBe("stale");
  });

  it("without a stale threshold the age is shown without a bucket", () => {
    const root = show(uasTrack(), "en", { staleAfterS: null });
    expect(value(root, "age-received")).toBe("2 s");
  });
});

describe("nulls are dashes", () => {
  it("every unknown number and string of an unmanned track is a dash", () => {
    const t = uasTrack({
      altAmslM: null,
      altWgs84M: null,
      heightM: null,
      heightRef: null,
      speedMs: null,
      trackDeg: null,
      vspeedMs: null,
      status: null,
      flightId: null,
      intentId: null,
      identification: {
        status: "unidentified",
        reason: "no_serial",
        serial: null,
        operatorReg: null,
        registeredOperatorReg: null,
        mismatch: false,
        basis: "as_broadcast",
      },
    });
    const root = show({ ...t, times: { ...t.times, ts: null } });
    for (const f of [
      "alt-amsl",
      "alt-wgs84",
      "height",
      "speed",
      "track",
      "vspeed",
      "operational-status",
      "flight",
      "intent",
      "serial",
      "registration",
      "ts",
    ]) {
      expect(value(root, f), f).toBe("—");
    }
    expect(root.textContent).not.toMatch(/\b0 m\b|0\.0 m\/s|000°/);
  });

  it("every unknown of a manned track is a dash", () => {
    const root = show(
      mannedTrack({
        callsign: null,
        icao24: null,
        altPressureM: null,
        altWgs84M: null,
        gsMs: null,
        trackDeg: null,
        vrateMs: null,
        sourceClass: "",
      }),
    );
    for (const f of [
      "callsign",
      "icao24",
      "alt-pressure",
      "alt-wgs84",
      "speed",
      "track",
      "vspeed",
      "source-class",
    ]) {
      expect(value(root, f), f).toBe("—");
    }
    expect(screen.getByRole("heading", { level: 3 }).textContent).toMatch(
      /no callsign or address/,
    );
  });
});

describe("identification", () => {
  it("shows the status, its hint, the reason, the basis, the serial and the public part", () => {
    const root = show(uasTrack());
    expect(value(root, "ident-status")).toMatch(/^registered/);
    expect(value(root, "ident-reason")).toBe(
      en["ident.reason.session_binding"],
    );
    expect(value(root, "ident-basis")).toBe(en["ident.basis.authenticated"]);
    expect(value(root, "serial")).toBe("TEST-SN-0101");
    expect(value(root, "registration")).toBe("GEO-TEST-OP-0101");
  });

  it("shows only the public part of a registration that carries a secret one", () => {
    const t = uasTrack();
    const root = show({
      ...t,
      identification: {
        ...(t.identification as NonNullable<TrackView["identification"]>),
        operatorReg: "GEOTESTOP0101-x7z",
      },
    });
    expect(value(root, "registration")).toBe("GEOTESTOP0101");
    expect(root.textContent).not.toMatch(/x7z/);
  });

  it("a mismatch is never shown as registered, and names the registered operator", () => {
    const t = uasTrack();
    const root = show({
      ...t,
      identification: {
        ...(t.identification as NonNullable<TrackView["identification"]>),
        mismatch: true,
        registeredOperatorReg: "GEO-TEST-OP-0999",
      },
    });
    expect(
      root
        .querySelector('[data-field="ident-status"] [data-ident]')
        ?.getAttribute("data-ident"),
    ).toBe("unknown_operator");
    expect(root.querySelector('[data-part="mismatch"]')?.textContent).toBe(
      en["ident.mismatch"],
    );
    expect(value(root, "registered-operator")).toBe("GEO-TEST-OP-0999");
  });

  it("without a mismatch there is no mismatch line nor registered operator (the twin)", () => {
    const root = show(uasTrack());
    expect(root.querySelector('[data-part="mismatch"]')).toBeNull();
    expect(field(root, "registered-operator")).toBeNull();
  });

  it("a track with no identification block says so", () => {
    const root = show(uasTrack({ identification: null }));
    expect(value(root, "ident-status")).toBe(en["ident.status.none"]);
  });
});

describe("source, trust, motion and links", () => {
  it("shows the trust class with its meaning, the source and the instance", () => {
    const root = show(uasTrack());
    expect(value(root, "trust")).toBe(
      `${en["trust.authenticated"]}${en["trust.authenticated.meaning"]}`,
    );
    expect(value(root, "source")).toBe("operator_ws");
    expect(label(root, "instance")).toBe(en["detail.instance"]);
    expect(value(root, "instance")).toBe("TEST-CLIENT-1");
  });

  it("formats speed, course and vertical speed (positive up)", () => {
    const root = show(uasTrack());
    expect(value(root, "speed")).toBe("8.4 m/s");
    expect(value(root, "track")).toBe("090°");
    expect(value(root, "vspeed")).toBe("1.5 m/s");
    expect(label(root, "vspeed")).toMatch(/positive up/);
  });

  it("an emergency is declared; none is none reported", () => {
    expect(value(show(uasTrack({ emergency: true })), "emergency")).toBe(
      "declared",
    );
    cleanup();
    expect(value(show(uasTrack()), "emergency")).toBe("none reported");
  });

  it("renders the flight and intent ids through the app's render prop", () => {
    const seen: string[] = [];
    const root = show(uasTrack(), "en", {
      renderLink: (l) => {
        seen.push(`${l.kind}:${l.id}`);
        return <a href={`#${l.kind}-${l.id}`}>{l.id}</a>;
      },
    });
    expect(seen.sort()).toEqual([
      "flight:TEST-FLT-0101",
      "intent:TEST-INT-0001",
    ]);
    expect(
      field(root, "flight")?.querySelector("a")?.getAttribute("href"),
    ).toBe("#flight-TEST-FLT-0101");
  });

  it("without the render prop the ids are plain text (the twin)", () => {
    const root = show(uasTrack());
    expect(field(root, "flight")?.querySelector("a")).toBeNull();
    expect(value(root, "flight")).toBe("TEST-FLT-0101");
  });
});

describe("manned", () => {
  it("is told apart by its source class", () => {
    expect(isMannedTrack(mannedTrack())).toBe(true);
    expect(isMannedTrack(uasTrack())).toBe(false);
  });

  it("shows both altitudes by datum, the source class, and the trust meaning", () => {
    const root = show(mannedTrack());
    expect(value(root, "alt-pressure")).toBe("914 m pressure altitude");
    expect(label(root, "alt-pressure")).toBe("Pressure altitude");
    expect(value(root, "alt-wgs84")).toBe("962 m above the WGS84 ellipsoid");
    expect(value(root, "source-class")).toBe("ATM surveillance feed");
    expect(value(root, "trust")).toMatch(/Surveillance/);
    expect(value(root, "speed")).toBe("61.7 m/s");
    expect(value(root, "vspeed")).toBe("-2.5 m/s");
  });

  it("a manned track with no trust class says it is shown as broadcast", () => {
    const m = mannedTrack();
    delete m.trust;
    const root = show(m);
    expect(value(root, "trust")).toMatch(/Broadcast \(unverified\)/);
    expect(value(root, "trust")).toMatch(/trust class not provided/);
  });

  it("shows an anomaly when the server sent one, and no row when it did not", () => {
    expect(
      value(
        show(mannedTrack({ anomaly: "two identities on 4c0001" })),
        "anomaly",
      ),
    ).toBe("two identities on 4c0001");
    cleanup();
    expect(field(show(mannedTrack()), "anomaly")).toBeNull();
  });

  it("an unknown source class is shown as the server named it", () => {
    const t = (k: string, v?: Record<string, string | number>) =>
      k === "manned.source_class.other" ? `${String(v?.["value"])} (sent)` : k;
    expect(sourceClassLabel("flarm", t)).toBe("flarm (sent)");
    expect(sourceClassLabel("ads_b", t)).toBe("manned.source_class.ads_b");
  });

  it("is in Georgian", () => {
    const root = show(mannedTrack(), "ka");
    expect(value(root, "alt-pressure")).toBe("914 მ ბარომეტრული სიმაღლე");
  });
});

describe("compact and language", () => {
  it("compact keeps position, motion, trust and age, and drops the rest", () => {
    const root = show(uasTrack(), "en", { compact: true });
    expect(field(root, "alt-amsl")).not.toBeNull();
    expect(field(root, "age-received")).not.toBeNull();
    expect(field(root, "trust")).not.toBeNull();
    for (const f of [
      "ident-status",
      "ts",
      "source",
      "flight",
      "age-captured",
    ]) {
      expect(field(root, f), f).toBeNull();
    }
  });

  it("takes a lang prop without a provider", () => {
    const r = render(
      <TrackDetail
        track={uasTrack()}
        nowMs={NOW_MS}
        staleAfterS={STALE_AFTER_S}
        lang="ka"
      />,
    );
    expect(r.container.textContent).toMatch(/ზღვის დონიდან/);
  });

  it("refuses to render with neither a provider nor a lang", () => {
    expect(() =>
      render(
        <TrackDetail
          track={uasTrack()}
          nowMs={NOW_MS}
          staleAfterS={STALE_AFTER_S}
        />,
      ),
    ).toThrow(/I18nProvider or a `lang` prop/);
  });
});

describe("accessibility", () => {
  for (const lang of ["en", "ka"] as const) {
    const history = broadcastTrack();
    const flagged: TrackView = {
      ...history,
      identification: {
        ...(history.identification as NonNullable<TrackView["identification"]>),
        mismatch: true,
        registeredOperatorReg: "GEO-TEST-OP-0999",
      },
      times: { ...history.times, backlog: true },
    };
    for (const [name, track] of [
      ["uas", broadcastTrack()],
      ["uas with a mismatch, as history", flagged],
      ["manned", mannedTrack()],
    ] as const) {
      it(`passes axe (${name}, ${lang})`, async () => {
        const root = show(track, lang);
        await axeCheck(root);
      });
    }
  }
});

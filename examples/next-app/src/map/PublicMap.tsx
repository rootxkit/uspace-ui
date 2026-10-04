"use client";

// The public zone map: the zones fetched through the typed client, their
// freshness read with `freshnessOf` and shown as "version V, updated T",
// drawn by the kit's ZoneLayer under its legend and controls. The page
// renders what the API said and judges nothing.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ApiError, freshnessOf, type Freshness } from "@rootxkit/uspace-ui/api";
import { fmtTimeUTC, useLang, useT } from "@rootxkit/uspace-ui/i18n";
import { ZoneLayer } from "@rootxkit/uspace-ui/layers";
import { ZoneLegend } from "@rootxkit/uspace-ui/legend";
import { MapControls, MapView } from "@rootxkit/uspace-ui/map";
import type { ZoneType, ZoneView } from "@rootxkit/uspace-ui/model";
import { useTheme } from "@rootxkit/uspace-ui/theme";
import { browserClient } from "../api/client";
import type { components } from "../api/generated/openapi";
import { MAP_INITIAL } from "../config";
import { toZoneView } from "./adapt";

type Collection = components["schemas"]["ZoneCollection"];

type Loaded =
  | { state: "loading" }
  | { state: "error"; detail: string }
  | { state: "ok"; collection: Collection; freshness: Freshness };

/** The instant the API is asked to annotate applicability at: now, to the second. */
function nowRfc3339(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function noSubscribe(): () => void {
  return () => undefined;
}

export function PublicMap() {
  const t = useT();
  const { lang } = useLang();
  const { resolved } = useTheme();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zonesVisible, setZonesVisible] = useState(true);
  // The basemap is same-origin (/basemap/, served by the deployment); the
  // map renders in the browser only, where the origin is known.
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => null,
  );

  useEffect(() => {
    const api = browserClient(() => lang);
    let live = true;
    api
      .GET("/v1/zones", { params: { query: { applies_at: nowRfc3339() } } })
      .then(({ data, response }) => {
        if (!live || data === undefined) return;
        setLoaded({
          state: "ok",
          collection: data,
          freshness: freshnessOf(response, data),
        });
      })
      .catch((err: unknown) => {
        if (!live) return;
        const detail =
          err instanceof ApiError
            ? (err.problem?.detail ?? String(err.status))
            : String(err);
        setLoaded({ state: "error", detail });
      });
    return () => {
      live = false;
    };
  }, [lang]);

  const zones: ZoneView[] = useMemo(() => {
    if (loaded.state !== "ok") return [];
    const meta = {
      version: loaded.freshness.version,
      updatedAt: loaded.freshness.updatedAt,
    };
    return loaded.collection.features.map((f) => toZoneView(f, meta, lang));
  }, [loaded, lang]);

  // The app counts what it shows; the legend displays the counts.
  const counts: Partial<Record<ZoneType, number>> = {};
  for (const z of zones) counts[z.type] = (counts[z.type] ?? 0) + 1;

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_18rem]">
      <section aria-labelledby="zones-heading" className="flex flex-col gap-2">
        <h1 id="zones-heading" className="text-xl font-bold">
          {t("example.map.heading")}
        </h1>
        <p data-testid="freshness" role="status">
          {loaded.state === "loading" && t("example.map.loading")}
          {loaded.state === "error" &&
            t("example.map.error", { detail: loaded.detail })}
          {loaded.state === "ok" &&
            t("example.map.freshness", {
              version: loaded.freshness.version ?? "—",
              updatedAt: fmtTimeUTC(loaded.freshness.updatedAt, lang),
            })}
        </p>
        {loaded.state === "ok" && loaded.freshness.etag !== null && (
          <p data-testid="etag" className="text-sm text-muted-foreground">
            {t("example.map.etag", { etag: loaded.freshness.etag })}
          </p>
        )}
        <div className="h-[480px]" data-testid="map-host">
          {origin !== null && (
            <MapView
              basemap={{ baseUrl: origin }}
              initial={MAP_INITIAL}
              lang={lang}
              scheme={resolved}
            >
              <ZoneLayer
                zones={zones}
                visible={zonesVisible}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              <MapControls
                layers={[
                  {
                    id: "zones",
                    labelKey: "example.map.heading",
                    visible: zonesVisible,
                    onChange: setZonesVisible,
                  },
                ]}
              />
            </MapView>
          )}
        </div>
      </section>
      <ZoneLegend counts={counts} />
    </div>
  );
}

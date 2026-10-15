"use client";

// The public zone map: the zones fetched through the typed client, their
// freshness read with `freshnessOf` and shown as "version V, updated T",
// drawn by the kit's ZoneLayer in a MapPanel, under its legend and
// controls. The page renders what the API said and judges nothing.
import { useState } from "react";
import { fmtTimeUTC, useLang, useT } from "@rootxkit/uspace-ui/i18n";
import { ZoneLayer } from "@rootxkit/uspace-ui/layers";
import { ZoneLegend } from "@rootxkit/uspace-ui/legend";
import { MapControls, MapView } from "@rootxkit/uspace-ui/map";
import { useTheme } from "@rootxkit/uspace-ui/theme";
import { MapPanel, PageHeader } from "@rootxkit/uspace-ui/ui";
import { MAP_INITIAL } from "../config";
import { useOrigin, useZones } from "./useZones";

export function PublicMap() {
  const t = useT();
  const { lang } = useLang();
  const { resolved } = useTheme();
  const { loaded, zones, counts } = useZones();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zonesVisible, setZonesVisible] = useState(true);
  const origin = useOrigin();

  return (
    <>
      <PageHeader
        title={t("example.map.heading")}
        description={
          <>
            <span data-testid="freshness" role="status">
              {loaded.state === "loading" && t("example.map.loading")}
              {loaded.state === "error" &&
                t("example.map.error", { detail: loaded.detail })}
              {loaded.state === "ok" &&
                t("example.map.freshness", {
                  version: loaded.freshness.version ?? "—",
                  updatedAt: fmtTimeUTC(loaded.freshness.updatedAt, lang),
                })}
            </span>
            {loaded.state === "ok" && loaded.freshness.etag !== null && (
              <span data-testid="etag" className="block text-xs">
                {t("example.map.etag", { etag: loaded.freshness.etag })}
              </span>
            )}
          </>
        }
      />
      <MapPanel
        legend={<ZoneLegend counts={counts} />}
        mapClassName="h-[min(70vh,44rem)]"
      >
        <div className="absolute inset-0" data-testid="map-host">
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
      </MapPanel>
    </>
  );
}

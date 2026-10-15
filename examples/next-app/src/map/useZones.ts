"use client";

// The zones of the stub API through the typed client, with their
// freshness read by `freshnessOf`, adapted to the kit's ZoneView and
// counted per type for the legend. Shared by the public map and the
// dashboard. It copies what the API said and judges nothing.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ApiError, freshnessOf, type Freshness } from "@rootxkit/uspace-ui/api";
import { useLang } from "@rootxkit/uspace-ui/i18n";
import type { ZoneType, ZoneView } from "@rootxkit/uspace-ui/model";
import { browserClient } from "../api/client";
import type { components } from "../api/generated/openapi";
import { toZoneView } from "./adapt";

type Collection = components["schemas"]["ZoneCollection"];

export type Loaded =
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

/**
 * The page's origin in the browser, null on the server: the basemap is
 * same-origin (/basemap/, served by the deployment), so the map renders in
 * the browser only, where the origin is known.
 */
export function useOrigin(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => null,
  );
}

export function useZones(): {
  loaded: Loaded;
  zones: ZoneView[];
  counts: Partial<Record<ZoneType, number>>;
} {
  const { lang } = useLang();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

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

  return { loaded, zones, counts };
}

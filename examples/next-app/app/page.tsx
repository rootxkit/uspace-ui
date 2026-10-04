import type { Metadata } from "next";
import { pageTitle } from "@/src/i18n/server";
import { PublicMap } from "@/src/map/PublicMap";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("example.nav.map") };
}

// The public zone map: the kit's MapView, ZoneLayer, ZoneLegend and
// MapControls over the zones the API serves.
export default function Home() {
  return <PublicMap />;
}

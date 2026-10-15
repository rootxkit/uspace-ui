import type { Metadata } from "next";
import { DashboardPage } from "@/src/components/DashboardPage";
import { pageTitle } from "@/src/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("example.nav.dashboard") };
}

// Every component of the kit's console frame, over demo data.
export default function Dashboard() {
  return <DashboardPage />;
}

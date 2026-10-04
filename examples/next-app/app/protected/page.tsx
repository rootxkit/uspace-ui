import type { Metadata } from "next";
import { ProtectedPage } from "@/src/components/ProtectedPage";
import { pageTitle } from "@/src/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("example.protected.heading") };
}

export default function Protected() {
  return <ProtectedPage />;
}

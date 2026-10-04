import type { Metadata } from "next";
import { LoginPage } from "@/src/components/LoginPage";
import { pageTitle } from "@/src/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("example.login.heading") };
}

export default function Login() {
  return <LoginPage />;
}

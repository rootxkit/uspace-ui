"use client";

// The page frame: skip link, brand, navigation, language switch, session.
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@rootxkit/uspace-ui/auth/client";
import { LANGS, useLang, useT } from "@rootxkit/uspace-ui/i18n";
import { useTheme } from "@rootxkit/uspace-ui/theme";
import { Button } from "@rootxkit/uspace-ui/ui";
import { POLICY } from "../config";

export function Shell({ children }: { children: ReactNode }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const { session, signOut } = useSession();
  const { brand } = useTheme();
  const router = useRouter();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:p-2"
      >
        {t("example.skip")}
      </a>
      <header className="flex flex-wrap items-center gap-4 border-b border-border px-4 py-2">
        <span className="font-bold">{brand.name}</span>
        <nav aria-label={t("example.nav.label")} className="flex gap-3">
          <Link href="/" className="underline underline-offset-2">
            {t("example.nav.map")}
          </Link>
          <Link href="/protected" className="underline underline-offset-2">
            {t("example.nav.protected")}
          </Link>
          {session === null && (
            <Link href="/login" className="underline underline-offset-2">
              {t("example.nav.login")}
            </Link>
          )}
        </nav>
        <div
          role="group"
          aria-label={t("example.lang.label")}
          className="ml-auto flex gap-2"
        >
          {LANGS.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={l === lang ? "default" : "outline"}
              lang={l}
              aria-pressed={l === lang}
              onClick={() => setLang(l)}
            >
              {t(`example.lang.${l}`)}
            </Button>
          ))}
        </div>
        {session !== null && (
          <div className="flex items-center gap-2 text-sm">
            <span>
              {t("example.session.signed_in_as", { sub: session.sub })}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void signOut().then(() => router.refresh());
              }}
            >
              {t("example.nav.sign_out")}
            </Button>
          </div>
        )}
      </header>
      <main id="main" className="p-4">
        {children}
      </main>
      <footer className="border-t border-border px-4 py-2 text-sm text-muted-foreground">
        {t("example.footer.a11y", {
          target: POLICY.accessibilityTarget.value,
          status: POLICY.accessibilityTarget.status,
        })}
      </footer>
    </>
  );
}

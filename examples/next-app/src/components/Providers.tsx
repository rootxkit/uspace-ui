"use client";

// The kit's providers in the order a `web/` mounts them: the CSP nonce
// (Radix ScrollArea's injected style), the theme with the brand from the
// environment, the language negotiated on the server, the session's
// display claims (decoded unverified, display only).
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider } from "@rootxkit/uspace-ui/auth/client";
import { I18nProvider, LANG_COOKIE, type Lang } from "@rootxkit/uspace-ui/i18n";
import type { SessionDisplay } from "@rootxkit/uspace-ui/model";
import { ThemeProvider, type Brand } from "@rootxkit/uspace-ui/theme";
import { CspNonceProvider } from "@rootxkit/uspace-ui/ui";
import { catalogues } from "../i18n/catalogues";

export function Providers(props: {
  lang: Lang;
  brand: Brand;
  nonce: string | undefined;
  session: SessionDisplay | null;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <CspNonceProvider nonce={props.nonce}>
      <ThemeProvider brand={props.brand}>
        <I18nProvider
          lang={props.lang}
          catalogues={catalogues}
          onLangChange={(l) => {
            // The kit never writes the cookie; the app persists the choice
            // and asks the server to render in it.
            document.cookie = `${LANG_COOKIE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;
            router.refresh();
          }}
        >
          <SessionProvider session={props.session}>
            {props.children}
          </SessionProvider>
        </I18nProvider>
      </ThemeProvider>
    </CspNonceProvider>
  );
}

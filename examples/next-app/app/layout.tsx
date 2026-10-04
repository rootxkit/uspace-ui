import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import {
  CSP_NONCE_HEADER,
  readSessionToken,
  sessionDisplay,
} from "@rootxkit/uspace-ui/auth/server";
import { fontClassName } from "@rootxkit/uspace-ui/fonts";
import { LANG_COOKIE, negotiateLang } from "@rootxkit/uspace-ui/i18n";
import {
  SCHEME_COOKIE,
  brandFromEnv,
  parseScheme,
  schemeAttribute,
} from "@rootxkit/uspace-ui/theme";
import { Providers } from "@/src/components/Providers";
import { Shell } from "@/src/components/Shell";
import "./globals.css";

// Every page reads the request: the language, the session, the nonce.
export const dynamic = "force-dynamic";

// The example opens no WebSocket in 0.1.0. An app that uses `live` opens
// its system's WebSocket same-origin, and the uspace_session cookie rides
// the upgrade; never a ticket route, never a token in a URL (PLAN §6.3).
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const jar = await cookies();
  const h = await headers();
  const lang = negotiateLang(
    h.get("accept-language"),
    jar.get(LANG_COOKIE)?.value ?? null,
  );
  // Display only, decoded unverified; the API decides every request.
  const session = sessionDisplay(readSessionToken(jar));
  const nonce = h.get(CSP_NONCE_HEADER) ?? undefined;
  // UI_BRAND_* from the environment, read at request time (06 §4).
  const brand = brandFromEnv(process.env);
  // An explicit scheme is painted from the first byte; `system` (or none)
  // leaves data-theme off, and the kit's tokens follow the preference
  // until ThemeProvider sets it (docs/ACCESSIBILITY.md A5).
  const scheme = schemeAttribute(parseScheme(jar.get(SCHEME_COOKIE)?.value));
  return (
    <html
      lang={lang}
      className={fontClassName}
      data-theme={scheme}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <Providers lang={lang} brand={brand} nonce={nonce} session={session}>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}

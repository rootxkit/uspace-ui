// The typed client over the kit's adapter: the generated `paths` (never
// hand-written; `pnpm gen:api`), the BFF as the base, the CSRF cookie on
// unsafe methods, the page's language as Accept-Language.
import { createClient, type Client } from "@rootxkit/uspace-ui/api";
import { csrfToken } from "@rootxkit/uspace-ui/auth/client";
import type { Lang } from "@rootxkit/uspace-ui/i18n";
import type { paths } from "./generated/openapi";

export type ExampleClient = Client<paths>;

export function browserClient(lang: () => Lang): ExampleClient {
  return createClient<paths>({
    baseUrl: "/_bff/api",
    csrfToken: () => csrfToken(),
    lang,
  });
}

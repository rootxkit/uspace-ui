import { noBusinessLogicInRoutes } from "./noBusinessLogicInRoutes.js";
import { ruleTester } from "./ruleTester.testing.js";

const err = (source: string) => ({ messageId: "forbidden", data: { source } });

ruleTester().run("no-business-logic-in-routes", noBusinessLogicInRoutes, {
  valid: [
    {
      filename: "web/app/api/x/route.ts",
      code: 'import { bffHandlers } from "@rootxkit/uspace-ui/auth/server";',
    },
    {
      filename: "web/app/_bff/[...route]/route.ts",
      code: 'import { NextResponse } from "next/server";\nimport { bffHandlers } from "@rootxkit/uspace-ui/auth/server";',
    },
    {
      filename: "app/api/x/route.ts",
      code: 'import { allowPaths } from "../../../lib/bff/paths";',
    },
    {
      filename: "app/api/x/route.ts",
      code: 'import { allowPaths } from "@/lib/bff/paths";',
    },
    { filename: "C:\\web\\app\\api\\x\\route.ts", code: 'import "next";' },
    // The folder the /_bff/* URLs are really served from (WP-5): the
    // permitted imports pass there too.
    {
      filename: "web/src/app/%5Fbff/login/route.ts",
      code: 'import { bffHandlers } from "@rootxkit/uspace-ui/auth/server";\nimport { bff } from "@/lib/bff/handlers";',
    },
    // A folder that only looks like it stays outside the rule.
    {
      filename: "web/app/x%5Fbff/route.ts",
      code: 'import { zones } from "../../lib/zones";',
    },
    // Outside the route directories the rule says nothing.
    {
      filename: "web/app/zones/page.tsx",
      code: 'import { zones } from "../../lib/zones";',
    },
    {
      filename: "web/lib/bff/paths.ts",
      code: 'import { zones } from "../zones";',
    },
    // An explicit allow-list entry from the app.
    {
      filename: "web/app/api/health/route.ts",
      code: 'import { version } from "../../../lib/version";',
      options: [{ allow: ["/lib/version$"] }],
    },
  ],
  invalid: [
    {
      filename: "app/api/x/route.ts",
      code: 'import { inZone } from "../../lib/zones";',
      errors: [err("../../lib/zones")],
    },
    {
      filename: "web/app/_bff/login/route.ts",
      code: 'import { createClient } from "@rootxkit/uspace-ui/api";',
      errors: [err("@rootxkit/uspace-ui/api")],
    },
    // The App Router serves /_bff/* from %5Fbff, in either case of the
    // encoding (WP-5); a forbidden import there is reported.
    {
      filename: "web/src/app/%5Fbff/login/route.ts",
      code: 'import { inZone } from "../../../lib/zones";',
      errors: [err("../../../lib/zones")],
    },
    {
      filename: "C:\\web\\app\\%5fbff\\api\\[...path]\\route.ts",
      code: 'import { createClient } from "@rootxkit/uspace-ui/api";',
      errors: [err("@rootxkit/uspace-ui/api")],
    },
    {
      filename: "C:\\web\\app\\api\\x\\route.ts",
      code: 'import { z } from "zod";',
      errors: [err("zod")],
    },
    {
      filename: "web/app/api/x/route.ts",
      code: 'export { GET } from "../../../lib/handlers";',
      errors: [err("../../../lib/handlers")],
    },
  ],
});

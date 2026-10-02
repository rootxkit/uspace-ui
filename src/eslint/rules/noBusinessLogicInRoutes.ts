import type { Rule } from "eslint";

import { posixFilename, visitSources } from "./sources.js";

// Spec 07 KT-3 and 02 §3: route handlers under app/api/** and the BFF's
// /_bff/** are a cookie-forwarding proxy. They import the kit's BFF
// helpers, Next.js and the app's own lib/bff/*, and nothing else.
//
// The App Router ignores a folder whose name starts with `_` (a private
// folder), so the URL /_bff/* is served from a folder named `%5Fbff`
// (WP-5). Both spellings match, the encoding in either case.
export const ROUTE_FILE = /(?:^|\/)app\/(?:api|_bff|%5[Ff]bff)\//;

export const DEFAULT_ALLOWED: readonly RegExp[] = [
  /^@rootxkit\/uspace-ui\/auth\/server$/,
  /^next(?:\/|$)/,
  /(?:^|\/)lib\/bff(?:\/|$)/,
];

interface Options {
  allow?: string[];
}

export const noBusinessLogicInRoutes: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Route handlers under app/api/** and app/%5Fbff/** (the /_bff/* routes) import only the BFF helpers, next/* and lib/bff/* (07 KT-3).",
    },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden:
        "'{{source}}' is not allowed in a route handler. The BFF forwards with @rootxkit/uspace-ui/auth/server; business logic belongs to the system's API.",
    },
  },
  create(context) {
    if (!ROUTE_FILE.test(posixFilename(context))) return {};
    const options = (context.options[0] ?? {}) as Options;
    const allowed = [
      ...DEFAULT_ALLOWED,
      ...(options.allow ?? []).map((p) => new RegExp(p)),
    ];
    return visitSources((source, node) => {
      if (!allowed.some((re) => re.test(source))) {
        context.report({ node, messageId: "forbidden", data: { source } });
      }
    });
  },
};

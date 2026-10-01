// `@rootxkit/uspace-ui/eslint`: the flat config every web/ extends
// (docs/PLAN.md §3.17, D11), and the kit's own lint config.
//
//   import kit from "@rootxkit/uspace-ui/eslint";
//   export default [...kit, /* app rules */];
import type { ESLint, Linter } from "eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

import {
  noBusinessLogicInRoutes,
  noGeometryImports,
  noHandWrittenApiTypes,
  noServerClientsInWeb,
} from "./rules/index.js";

export const rules = {
  noGeometryImports,
  noServerClientsInWeb,
  noBusinessLogicInRoutes,
  noHandWrittenApiTypes,
};

/** The plugin the config registers under the `uspace-ui/` prefix. */
export const plugin: ESLint.Plugin = {
  meta: { name: "@rootxkit/uspace-ui/eslint" },
  rules: {
    "no-geometry-imports": noGeometryImports,
    "no-server-clients-in-web": noServerClientsInWeb,
    "no-business-logic-in-routes": noBusinessLogicInRoutes,
    "no-hand-written-api-types": noHandWrittenApiTypes,
  },
};

const config: Linter.Config[] = [
  ...(tseslint.configs.strict as Linter.Config[]),
  reactHooks.configs.flat.recommended as Linter.Config,
  jsxA11y.flatConfigs.recommended as Linter.Config,
  {
    name: "@rootxkit/uspace-ui/rules",
    plugins: { "uspace-ui": plugin },
    rules: {
      "uspace-ui/no-geometry-imports": "error",
      "uspace-ui/no-server-clients-in-web": "error",
      "uspace-ui/no-business-logic-in-routes": "error",
      "uspace-ui/no-hand-written-api-types": "error",
    },
  },
];

export default config;

// The kit obeys its own rules (PLAN §7, §10 job 1): this repository is
// linted with the config it ships as `@rootxkit/uspace-ui/eslint`, from the
// compiled output, so `pnpm build` runs first (`pnpm check` does).
import kit from "./dist/eslint/index.js";

export default [
  {
    ignores: [
      "dist/",
      "coverage/",
      "storybook-static/",
      ".cache/",
      "node_modules/",
      "**/*.d.ts",
      "**/*.d.mts",
    ],
  },
  ...kit,
];

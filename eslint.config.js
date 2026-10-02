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
      "src/api/test/generated/",
      "**/*.d.ts",
      "**/*.d.mts",
    ],
  },
  ...kit,
  {
    // Vendored shadcn/ui output (src/ui/UPGRADING.md): kept unchanged, so a
    // rule it trips is relaxed here, for that file only, with the reason.
    // PaginationLink renders its children through a props spread, which
    // the rule cannot see.
    files: ["src/ui/pagination.tsx"],
    rules: { "jsx-a11y/anchor-has-content": "off" },
  },
];

// The kit's ESLint config, exactly as every `web/` extends it (PLAN §11):
// no geometry or geodesy import, no database or bus client, no business
// logic in a route handler, no hand-written type in the generated directory.
import kit from "@rootxkit/uspace-ui/eslint";

export default [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  ...kit,
];

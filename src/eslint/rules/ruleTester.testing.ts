// Test helper: an ESLint RuleTester wired to vitest and the TypeScript
// parser. Not exported from the package.
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { describe, it } from "vitest";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

export function ruleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
  });
}

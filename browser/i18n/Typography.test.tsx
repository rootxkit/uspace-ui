import { expect, it } from "vitest";

import { EN_DARK, EN_LIGHT, KA_DARK, KA_LIGHT, renderKit } from "../kit.js";
import { checkEnglish, checkGeorgian } from "./checks.js";
import { Typography } from "./Typography.js";

// The kit's font stack in each language (WP-2). The light renderings are
// also in the golden set (browser/golden/).

it("Georgian (ka light)", async () => {
  await checkGeorgian(renderKit(<Typography />, KA_LIGHT).container);
});

it("English (en light)", async () => {
  await checkEnglish(renderKit(<Typography />, EN_LIGHT).container);
});

it("Georgian (ka dark)", () => {
  const { container } = renderKit(<Typography />, KA_DARK);
  expect(container.querySelector("article")?.getAttribute("lang")).toBe("ka");
});

it("English (en dark)", () => {
  const { container } = renderKit(<Typography />, EN_DARK);
  expect(container.querySelector("article")?.getAttribute("lang")).toBe("en");
});

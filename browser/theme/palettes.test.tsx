import { it } from "vitest";

import { EN_DARK, EN_LIGHT, renderKit } from "../kit.js";
import { checkPalettes, Palettes } from "./Palettes.js";

it("palettes (en light)", () => {
  checkPalettes(renderKit(<Palettes />, EN_LIGHT).container);
});

it("palettes (en dark)", () => {
  checkPalettes(renderKit(<Palettes />, EN_DARK).container);
});

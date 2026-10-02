import { it } from "vitest";

import { EN_LIGHT, KA_DARK, renderKit } from "../kit.js";
import {
  Cards,
  LegendBox,
  ZoneMap,
  checkCards,
  checkLegend,
  checkRestrictions,
  checkRestrictionsLoaded,
  checkZoneMap,
} from "./views.js";

// WP-6: the five zone types over the Tbilisi extract, the restriction
// trio, the hover card and the legend, in both languages and both
// schemes. The cards and the legend in each look are also in the golden
// set (browser/golden/).

it("zones over the map (en light)", async () => {
  await checkZoneMap(renderKit(<ZoneMap scheme="light" />, EN_LIGHT).container);
});

it("zones over the map (ka dark)", async () => {
  await checkZoneMap(renderKit(<ZoneMap scheme="dark" />, KA_DARK).container);
});

it("restriction trio (en light)", async () => {
  await checkRestrictions(
    renderKit(<ZoneMap scheme="light" restrictions />, EN_LIGHT).container,
  );
});

it("restriction trio (ka dark)", async () => {
  await checkRestrictionsLoaded(
    renderKit(<ZoneMap scheme="dark" restrictions />, KA_DARK).container,
  );
});

it("hover card (en light)", () => {
  checkCards(renderKit(<Cards />, EN_LIGHT).container, "en");
});

it("hover card (ka dark)", () => {
  checkCards(renderKit(<Cards />, KA_DARK).container, "ka");
});

it("legend (en light)", async () => {
  await checkLegend(renderKit(<LegendBox />, EN_LIGHT).container);
});

it("legend (ka dark)", async () => {
  await checkLegend(renderKit(<LegendBox />, KA_DARK).container);
});

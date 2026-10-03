import { it } from "vitest";

import { EN_LIGHT, KA_DARK, renderKit } from "../kit.js";
import { Details, Sky, checkDetails, checkSky } from "./views.js";

// WP-12: the mixed sky over the Tbilisi extract and the detail of each
// class, in both languages and both schemes. The details in each look are
// also in the golden set (browser/golden/).

it("mixed sky over the map (en light)", async () => {
  await checkSky(renderKit(<Sky scheme="light" />, EN_LIGHT).container);
});

it("mixed sky over the map (ka dark)", async () => {
  await checkSky(renderKit(<Sky scheme="dark" />, KA_DARK).container);
});

it("details of each class (en light)", () => {
  checkDetails(renderKit(<Details />, EN_LIGHT).container, /unverified/);
});

it("details of each class (ka dark)", () => {
  checkDetails(renderKit(<Details />, KA_DARK).container, /დაუდასტურებ/);
});

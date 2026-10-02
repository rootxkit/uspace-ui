import { it } from "vitest";

import { EN_LIGHT, KA_DARK, renderKit } from "../kit.js";
import {
  IdentHints,
  LegendsBox,
  TrackMap,
  checkHints,
  checkLegends,
  checkTrackMap,
} from "./views.js";

// WP-7: the fixture sky over the Tbilisi extract, the four legends, and
// the identification wording, in both languages and both schemes. The
// legends in each look are also in the golden set (browser/golden/).

it("tracks over the map (en light)", async () => {
  await checkTrackMap(
    renderKit(<TrackMap scheme="light" />, EN_LIGHT).container,
  );
});

it("tracks over the map (ka dark)", async () => {
  await checkTrackMap(renderKit(<TrackMap scheme="dark" />, KA_DARK).container);
});

it("legends (en light)", async () => {
  await checkLegends(
    renderKit(<LegendsBox />, EN_LIGHT).container,
    /Broadcast and unverified/,
  );
});

it("legends (ka dark)", async () => {
  await checkLegends(
    renderKit(<LegendsBox />, KA_DARK).container,
    /დაუდასტურებელი/,
  );
});

it("identification wording (en light)", () => {
  checkHints(renderKit(<IdentHints />, EN_LIGHT).container);
});

it("identification wording (ka dark)", () => {
  checkHints(renderKit(<IdentHints />, KA_DARK).container);
});

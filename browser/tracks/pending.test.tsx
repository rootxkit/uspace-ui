import { it } from "vitest";

import { en } from "../../src/i18n/en.js";
import { ka } from "../../src/i18n/ka.js";
import { EN_LIGHT, KA_DARK, renderKit } from "../kit.js";
import { Pending, checkPending } from "./pending.js";

// A block that was not judged (spec 04 §3.2, G-13) beside a judged
// unidentified one, in the legend, the table and the detail, in both
// languages and both schemes; the setup runs axe after each. The same view
// is in the golden set (browser/golden/).

it("pending identification (en light)", () => {
  checkPending(renderKit(<Pending />, EN_LIGHT).container, {
    pending: en["ident.status.pending"],
    unidentified: en["ident.status.unidentified"],
  });
});

it("pending identification (ka dark)", () => {
  checkPending(renderKit(<Pending />, KA_DARK).container, {
    pending: ka["ident.status.pending"],
    unidentified: ka["ident.status.unidentified"],
  });
});

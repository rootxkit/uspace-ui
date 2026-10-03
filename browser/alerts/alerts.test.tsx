import { it } from "vitest";

import { EN_LIGHT, KA_DARK, renderKit } from "../kit.js";
import {
  AlertMap,
  ListView,
  Summaries,
  ToasterView,
  checkAlertMap,
  checkList,
  checkListActions,
  checkSummaries,
  checkToaster,
} from "./views.js";

// WP-11: the alert list with every kind in both states, acknowledge by
// mouse and select by keyboard, one summary per kind, the toaster and its
// gesture-gated sound control, and the alert layer over the WP-7 fixture
// sky, in both languages and both schemes; axe runs after each (setup).
// The list and the summaries are also in the golden set.

it("alert list, every kind raised and cleared (en light)", () => {
  checkList(renderKit(<ListView />, EN_LIGHT).container);
});

it("alert list, every kind raised and cleared (ka dark)", () => {
  checkList(renderKit(<ListView />, KA_DARK).container);
});

it("acknowledge and select by keyboard (en light)", async () => {
  await checkListActions(renderKit(<ListView />, EN_LIGHT).container);
});

it("acknowledge and select by keyboard (ka dark)", async () => {
  await checkListActions(renderKit(<ListView />, KA_DARK).container);
});

it("summaries per kind (en light)", () => {
  checkSummaries(
    renderKit(<Summaries />, EN_LIGHT).container,
    / m horizontally in /,
  );
});

it("summaries per kind (ka dark)", () => {
  checkSummaries(renderKit(<Summaries />, KA_DARK).container, / წმ-ში/);
});

it("toaster and the sound control (en light)", async () => {
  await checkToaster(
    renderKit(<ToasterView />, EN_LIGHT).container,
    /^Enable alert sound$/,
  );
});

it("toaster and the sound control (ka dark)", async () => {
  await checkToaster(
    renderKit(<ToasterView />, KA_DARK).container,
    /^გაფრთხილების ხმის ჩართვა$/,
  );
});

it("alerts over the fixture sky (en light)", async () => {
  await checkAlertMap(
    renderKit(<AlertMap scheme="light" />, EN_LIGHT).container,
  );
});

it("alerts over the fixture sky (ka dark)", async () => {
  await checkAlertMap(renderKit(<AlertMap scheme="dark" />, KA_DARK).container);
});

import { within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { EN_LIGHT, KA_DARK, renderKit } from "../kit.js";
import {
  Degraded,
  FrozenMap,
  Sources,
  StatusBars,
  checkBars,
  checkDegraded,
  checkFrozen,
  checkSources,
} from "./views.js";

// WP-8: the status components in both languages and both schemes. The
// status bars, the sources panel and the degraded banner in each look are
// also in the golden set (browser/golden/).

it("status bar (en light)", () => {
  checkBars(renderKit(<StatusBars />, EN_LIGHT).container);
});

it("status bar (ka dark)", () => {
  checkBars(renderKit(<StatusBars />, KA_DARK).container);
});

it("sources (en light)", () => {
  checkSources(
    renderKit(<Sources />, EN_LIGHT).container,
    /disabled by admin:test-1/,
    /silent since/,
  );
});

it("sources (ka dark)", () => {
  checkSources(
    renderKit(<Sources />, KA_DARK).container,
    /admin:test-1/,
    /დუმს/,
  );
});

it("source switch dialog", async () => {
  const switched = vi.fn();
  const canvasElement = renderKit(
    <Sources onSwitch={switched} />,
    EN_LIGHT,
  ).container;
  const root = within(canvasElement);
  await userEvent.click(
    root.getByRole("button", { name: "Switch off rx-test-01" }),
  );
  const body = within(canvasElement.ownerDocument.body);
  const dialog = await body.findByRole("dialog");
  // Without a reason, Confirm is disabled and a click on it does nothing.
  const confirm = within(dialog).getByRole("button", { name: "Confirm" });
  expect(confirm).toBeDisabled();
  await userEvent.click(confirm, { force: true });
  expect(switched).not.toHaveBeenCalled();
  await userEvent.type(
    within(dialog).getByLabelText("Reason (required)"),
    "receiver maintenance",
  );
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Confirm" }),
  );
  expect(switched).toHaveBeenCalledTimes(1);
});

it("degraded (en light)", () => {
  checkDegraded(renderKit(<Degraded />, EN_LIGHT).container);
});

it("degraded (ka dark)", () => {
  checkDegraded(renderKit(<Degraded />, KA_DARK).container);
});

it("frozen over the map (en light)", async () => {
  await checkFrozen(
    renderKit(<FrozenMap scheme="light" />, EN_LIGHT).container,
  );
});

it("frozen over the map (ka dark)", async () => {
  await checkFrozen(renderKit(<FrozenMap scheme="dark" />, KA_DARK).container);
});

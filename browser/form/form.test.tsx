import { waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { EN_LIGHT, KA_DARK, renderKit, type Look } from "../kit.js";
import {
  IntentForm,
  SourceSwitch,
  ZoneForm,
  checkIntentForm,
  checkZoneForm,
} from "./views.js";

// WP-10: the form kit in both languages and both schemes. The zone and
// intent forms in each look are also in the golden set (browser/golden/).

it("zone form (en light)", async () => {
  await checkZoneForm(
    renderKit(<ZoneForm />, EN_LIGHT).container,
    /^Upper limit \(m, AMSL\)/,
    /Publish zone/,
  );
});

it("zone form (ka dark)", async () => {
  await checkZoneForm(
    renderKit(<ZoneForm />, KA_DARK).container,
    /^ზედა ზღვარი \(მ, ზღვის დონიდან\)/,
    /ზონის გამოქვეყნება/,
  );
});

it("intent form (en light)", () => {
  checkIntentForm(
    renderKit(<IntentForm />, EN_LIGHT).container,
    /^4D trajectory: start/,
  );
});

it("intent form (ka dark)", () => {
  checkIntentForm(
    renderKit(<IntentForm />, KA_DARK).container,
    /^4D ტრაექტორია: დაწყება/,
  );
});

it("intent submits", async () => {
  const sent = vi.fn();
  const root = within(
    renderKit(<IntentForm onSent={sent} />, EN_LIGHT).container,
  );
  await userEvent.click(
    root.getByRole("button", { name: "Request authorisation" }),
  );
  await waitFor(() => expect(sent).toHaveBeenCalledTimes(1));
  const v = sent.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(v["volume"]).toEqual([44.78, 41.69, 44.81, 41.71]);
  expect(v["start"]).toBe("2026-10-02T09:00:00Z");
  expect(v["lower"]).toBeNull();
  expect(root.getByRole("status").textContent).toBe("Saved");
});

async function checkSwitch(
  look: Look,
  open: string,
  confirm: string,
  reason: RegExp,
): Promise<void> {
  const switched = vi.fn();
  const canvasElement = renderKit(
    <SourceSwitch onConfirm={switched} />,
    look,
  ).container;
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: open }),
  );
  const body = within(canvasElement.ownerDocument.body);
  const dialog = await body.findByRole("alertdialog");
  // Destructive: the confirm button is not where focus starts.
  const confirmButton = within(dialog).getByRole("button", { name: confirm });
  expect(canvasElement.ownerDocument.activeElement).not.toBe(confirmButton);
  // Without a reason, a click on confirm does nothing.
  await userEvent.click(confirmButton, { force: true });
  expect(switched).not.toHaveBeenCalled();
  await userEvent.type(
    within(dialog).getByLabelText(reason),
    "receiver maintenance",
  );
  await userEvent.click(confirmButton);
  expect(switched).toHaveBeenCalledWith("receiver maintenance");
}

it("source switch (en light)", async () => {
  await checkSwitch(EN_LIGHT, "Switch off rx-test-01", "Confirm", /^Reason/);
});

it("source switch (ka dark)", async () => {
  await checkSwitch(KA_DARK, "rx-test-01: გათიშვა", "დადასტურება", /^მიზეზი/);
});

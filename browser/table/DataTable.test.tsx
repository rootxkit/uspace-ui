import { waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { EN_LIGHT, KA_DARK, renderKit, type Look } from "../kit.js";
import {
  Deliveries,
  Registry,
  SourcesTable,
  WithCatalogues,
  checkDeliveries,
  checkEmpty,
  checkError,
  checkRegistry,
  checkSourcesTable,
} from "./views.js";

// WP-9: the data table in both languages and both schemes. A page of the
// registry, its empty state and the refused read are also in the golden
// set (browser/golden/).

const renderTable = (ui: ReactNode, look: Look): HTMLElement =>
  renderKit(<WithCatalogues>{ui}</WithCatalogues>, look).container;

it("registry (en light)", async () => {
  await checkRegistry(
    renderTable(<Registry />, EN_LIGHT),
    "Registered aircraft",
    /^Ceiling \(m AMSL\)$/,
  );
});

it("registry (ka dark)", async () => {
  await checkRegistry(
    renderTable(<Registry />, KA_DARK),
    "რეგისტრირებული საჰაერო ხომალდები",
    /^ჭერი \(მ ზღვის დონიდან\)$/,
  );
});

it("registry keyboard", async () => {
  const selected = vi.fn();
  const canvasElement = renderTable(<Registry onSelect={selected} />, EN_LIGHT);
  const root = within(canvasElement);
  const grid = root.getByRole("grid");
  // The grid has one tab stop (roving tabindex): the select-all box.
  const stops = grid.querySelectorAll<HTMLElement>('[tabindex="0"]');
  expect(stops).toHaveLength(1);
  stops[0]?.focus();
  const active = () => canvasElement.ownerDocument.activeElement;
  await userEvent.keyboard("{Control>}{Home}{/Control}");
  expect(active()?.getAttribute("data-grid-cell")).toBe("0:0");
  await userEvent.keyboard("{ArrowDown}{ArrowRight}");
  expect(active()?.getAttribute("data-grid-cell")).toBe("1:1");
  expect(selected).not.toHaveBeenCalled();
  await userEvent.keyboard("{Enter}");
  expect(selected).toHaveBeenCalledTimes(1);
  expect(
    grid
      .querySelector('tr[data-row-id="reg-00001"]')
      ?.getAttribute("aria-selected"),
  ).toBe("true");
  // Space on the row's checkbox toggles it (the browser's own button).
  await userEvent.keyboard("{ArrowLeft}");
  expect(active()?.getAttribute("role")).toBe("checkbox");
  await userEvent.keyboard(" ");
  expect(active()?.getAttribute("aria-checked")).toBe("true");
  await userEvent.keyboard("{PageDown}");
  expect(active()?.getAttribute("data-grid-cell")).toBe("11:0");
  await userEvent.keyboard("{End}");
  expect(active()?.getAttribute("data-grid-cell")).toBe("11:7");
});

it("sources (en light)", () => {
  checkSourcesTable(renderTable(<SourcesTable />, EN_LIGHT));
});

it("sources (ka dark)", () => {
  checkSourcesTable(renderTable(<SourcesTable />, KA_DARK));
});

it("deliveries (en light)", () => {
  checkDeliveries(renderTable(<Deliveries />, EN_LIGHT), /As of version 42/);
});

it("deliveries (ka dark)", () => {
  checkDeliveries(renderTable(<Deliveries />, KA_DARK), /ვერსია 42/);
});

it("deliveries refused (en light)", () => {
  checkError(renderTable(<Deliveries error />, EN_LIGHT), /wait 30 seconds/);
});

it("deliveries refused (ka dark)", () => {
  checkError(renderTable(<Deliveries error />, KA_DARK), /30 წამის/);
});

it("empty (en light)", () => {
  checkEmpty(
    renderTable(<Registry rows={0} />, EN_LIGHT),
    /No registrations yet/,
  );
});

it("empty (ka dark)", () => {
  checkEmpty(
    renderTable(<Registry rows={0} />, KA_DARK),
    /რეგისტრაციები ჯერ არ არის/,
  );
});

it("10 000 rows virtualised", async () => {
  const canvasElement = renderTable(<Registry rows={10_000} />, EN_LIGHT);
  const root = within(canvasElement).getByTestId("registry");
  const rendered = () => root.querySelectorAll("tbody tr[data-row-id]");
  await waitFor(() => expect(rendered().length).toBeGreaterThan(0));
  expect(rendered().length).toBeLessThanOrEqual(60);
  const scroller = root.querySelector<HTMLElement>('[data-part="scroll"]');
  if (scroller === null) throw new Error("no scroller");
  scroller.scrollTop = scroller.scrollHeight;
  await waitFor(() =>
    expect(root.querySelector('tr[data-row-id="reg-10000"]')).not.toBeNull(),
  );
  expect(rendered().length).toBeLessThanOrEqual(60);
  // Ctrl+Home from the last row scrolls back and focuses the first cell.
  const last = root.querySelector<HTMLElement>(
    'tr[data-row-id="reg-10000"] td[data-grid-cell]',
  );
  last?.focus();
  await userEvent.keyboard("{Control>}{Home}{/Control}");
  await waitFor(() =>
    expect(
      canvasElement.ownerDocument.activeElement?.getAttribute("data-grid-cell"),
    ).toBe("0:0"),
  );
  await userEvent.keyboard("{Control>}{End}{/Control}");
  await waitFor(() =>
    expect(
      canvasElement.ownerDocument.activeElement?.getAttribute("data-grid-cell"),
    ).toBe("10000:7"),
  );
});

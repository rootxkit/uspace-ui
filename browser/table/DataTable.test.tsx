import { waitFor, within } from "@testing-library/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

/**
 * Re-renders the registry once, from a timer (a render that is not a
 * discrete event, so its effects are left pending, as a virtualiser
 * re-render after a measurement leaves them on a slow runner), and from
 * that render's commit presses the key `keyInit` names on the focused
 * cell, once, before those effects have run.
 */
function KeyBeforeEffects(props: {
  rows: number;
  keyInit: KeyboardEventInit;
  onPressed: (e: KeyboardEvent) => void;
}) {
  const { rows, keyInit, onPressed } = props;
  const [tick, setTick] = useState(0);
  const sent = useRef(false);
  useEffect(() => {
    const id = setTimeout(() => {
      setTick(1);
    }, 0);
    return () => {
      clearTimeout(id);
    };
  }, []);
  useLayoutEffect(() => {
    if (tick === 0 || sent.current) return;
    sent.current = true;
    queueMicrotask(() => {
      const target = document.activeElement;
      if (target === null) return;
      const e = new KeyboardEvent("keydown", {
        ...keyInit,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(e);
      onPressed(e);
    });
  }, [tick, keyInit, onPressed]);
  // A new handler on each render, so the table renders with this one.
  return <Registry rows={rows} onSelect={() => tick} />;
}

it("a key pressed while an earlier render's effects are pending still moves focus", async () => {
  // The CI flake of "10 000 rows virtualised": React ran the pending
  // effect of the render before the move, which took the focus request
  // and focused the cell the move had left. Forced here: the cell is
  // focused, the table re-renders, and Ctrl+Home arrives first.
  const pressed: KeyboardEvent[] = [];
  const canvasElement = renderTable(
    <KeyBeforeEffects
      rows={30}
      keyInit={{ key: "Home", ctrlKey: true }}
      onPressed={(e) => pressed.push(e)}
    />,
    EN_LIGHT,
  );
  const active = () =>
    canvasElement.ownerDocument.activeElement?.getAttribute("data-grid-cell");
  const cell = within(canvasElement)
    .getByRole("grid")
    .querySelector<HTMLElement>('[data-grid-cell="5:2"]');
  if (cell === null) throw new Error("no cell 5:2");
  cell.focus();
  expect(active()).toBe("5:2");
  await waitFor(() => expect(pressed).toHaveLength(1));
  // The grid took the key (presence: the move ran) ...
  expect(pressed[0]?.defaultPrevented).toBe(true);
  // ... and focus went where it asked.
  await waitFor(() => expect(active()).toBe("0:0"));
});

it("a key pressed while an earlier render's effects are pending reaches an unrendered row", async () => {
  // The same ordering on the virtualised table, with the step that failed
  // in CI: Ctrl+End from the first cell, to a row that renders only after
  // the scroll. The request outlives the pending effect and the renders
  // before the row arrives.
  const pressed: KeyboardEvent[] = [];
  const canvasElement = renderTable(
    <KeyBeforeEffects
      rows={10_000}
      keyInit={{ key: "End", ctrlKey: true }}
      onPressed={(e) => pressed.push(e)}
    />,
    EN_LIGHT,
  );
  const active = () =>
    canvasElement.ownerDocument.activeElement?.getAttribute("data-grid-cell");
  const grid = within(canvasElement).getByRole("grid");
  const first = grid.querySelector<HTMLElement>('[data-grid-cell="0:0"]');
  if (first === null) throw new Error("no cell 0:0");
  first.focus();
  expect(active()).toBe("0:0");
  expect(grid.querySelector('tr[data-row-id="reg-10000"]')).toBeNull();
  await waitFor(() => expect(pressed).toHaveLength(1));
  expect(pressed[0]?.defaultPrevented).toBe(true);
  await waitFor(() => expect(active()).toBe("10000:7"));
});

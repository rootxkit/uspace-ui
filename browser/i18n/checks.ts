// What the typography sample must show in each language, measured in the
// browser; shared by the tests and the golden set.
import { within } from "@testing-library/react";
import { expect } from "vitest";

import { loadKitFaces, textWidth as width } from "./probe.js";

// Mkhedruli sample; its Mtavruli (upper case) is U+1C90 onwards.
const KA = "ქართული დამწერლობა";
const EN = "Broadcast and unverified";

export async function checkGeorgian(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const body = canvas.getByTestId("body");
  expect(body.textContent).toMatch(/დაუდასტურებელი/);
  // All four bundled faces load from the package's files.
  expect(await loadKitFaces()).toBe(4);
  // The stack in effect on the page sets Georgian letters in the
  // Georgian face and the space between words in Noto Sans (the Georgian
  // face's unicode-range excludes it). A stack without the Georgian face
  // would set the letters in a platform font (the twin).
  const stack = getComputedStyle(body).fontFamily;
  expect(stack).toContain("Noto Sans Georgian");
  const inStack = width(canvasElement, stack, KA);
  expect(inStack).toBe(
    width(canvasElement, '"Noto Sans Georgian", "Noto Sans"', KA),
  );
  expect(inStack).not.toBe(width(canvasElement, '"Noto Sans", serif', KA));
  expect(inStack).not.toBe(width(canvasElement, "serif", KA));
  // Mtavruli (upper-case Georgian, U+1C90 on) is drawn by the same face.
  expect("ა".toUpperCase()).toBe("Ა");
  const mtavruli = canvas.getByTestId("mtavruli").textContent ?? "";
  expect(mtavruli).toMatch(/^[Ა-Ჿ ]+$/);
  expect(width(canvasElement, stack, mtavruli)).toBe(
    width(canvasElement, '"Noto Sans Georgian", "Noto Sans"', mtavruli),
  );
  expect(width(canvasElement, stack, mtavruli)).not.toBe(
    width(canvasElement, '"Noto Sans", serif', mtavruli),
  );
  // Observed in Chromium: text-transform: uppercase does not map
  // Mkhedruli to Mtavruli (it does upper-case Latin). If this starts
  // failing, Chromium changed, and the CSS heading becomes Mtavruli.
  expect(width(canvasElement, stack, KA, true)).toBe(inStack);
  expect(getComputedStyle(canvas.getByTestId("upper")).textTransform).toBe(
    "uppercase",
  );
}

export async function checkEnglish(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const body = canvas.getByTestId("body");
  expect(body.textContent).toMatch(/unverified/);
  expect(await loadKitFaces()).toBe(4);
  const stack = getComputedStyle(body).fontFamily;
  const inStack = width(canvasElement, stack, EN);
  expect(inStack).toBe(width(canvasElement, '"Noto Sans"', EN));
  expect(inStack).not.toBe(width(canvasElement, "serif", EN));
  // text-transform: uppercase does upper-case Latin (the twin of the
  // Georgian observation above).
  expect(width(canvasElement, stack, EN, true)).toBe(
    width(canvasElement, stack, EN.toUpperCase()),
  );
  expect(width(canvasElement, stack, EN, true)).not.toBe(inStack);
}

import { within } from "@testing-library/react";
import { expect, it } from "vitest";

import { loadKitFaces, textWidth } from "./i18n/probe.js";
import { renderKit } from "./kit.js";
import { Welcome } from "./Welcome.js";

it("entry points", async () => {
  const canvasElement = renderKit(
    <Welcome entries={["./model", "./eslint", "./test"]} />,
  ).container;
  const canvas = within(canvasElement);
  expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(
    "@rootxkit/uspace-ui",
  );
  expect(canvas.getAllByRole("listitem")).toHaveLength(3);
  // The Georgian run is set in Noto Sans Georgian, from the bundled file.
  const georgian = canvas.getByText("ქართული");
  expect(await loadKitFaces()).toBe(4);
  const stack = getComputedStyle(georgian).fontFamily;
  expect(textWidth(canvasElement, stack, "ქართული")).toBe(
    textWidth(canvasElement, '"Noto Sans Georgian"', "ქართული"),
  );
  expect(textWidth(canvasElement, "serif", "ქართული")).not.toBe(
    textWidth(canvasElement, '"Noto Sans Georgian"', "ქართული"),
  );
});

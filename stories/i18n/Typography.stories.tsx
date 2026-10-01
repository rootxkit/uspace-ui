import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { loadKitFaces, textWidth as width } from "./probe.js";
import { Typography } from "./Typography.js";

const meta = {
  title: "i18n/Typography",
  component: Typography,
} satisfies Meta<typeof Typography>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mkhedruli sample; its Mtavruli (upper case) is U+1C90 onwards.
const KA = "ქართული დამწერლობა";
const EN = "Broadcast and unverified";

export const Georgian: Story = {
  globals: { lang: "ka", scheme: "light" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = canvas.getByTestId("body");
    await expect(body.textContent).toMatch(/დაუდასტურებელი/);
    // All four bundled faces load from the package's files.
    await expect(await loadKitFaces()).toBe(4);
    // The stack in effect on the page sets Georgian letters in the
    // Georgian face and the space between words in Noto Sans (the Georgian
    // face's unicode-range excludes it). A stack without the Georgian face
    // would set the letters in a platform font (the twin).
    const stack = getComputedStyle(body).fontFamily;
    await expect(stack).toContain("Noto Sans Georgian");
    const inStack = width(canvasElement, stack, KA);
    await expect(inStack).toBe(
      width(canvasElement, '"Noto Sans Georgian", "Noto Sans"', KA),
    );
    await expect(inStack).not.toBe(
      width(canvasElement, '"Noto Sans", serif', KA),
    );
    await expect(inStack).not.toBe(width(canvasElement, "serif", KA));
    // Mtavruli (upper-case Georgian, U+1C90 on) is drawn by the same face.
    await expect("ა".toUpperCase()).toBe("Ა");
    const mtavruli = canvas.getByTestId("mtavruli").textContent ?? "";
    await expect(mtavruli).toMatch(/^[Ა-Ჿ ]+$/);
    await expect(width(canvasElement, stack, mtavruli)).toBe(
      width(canvasElement, '"Noto Sans Georgian", "Noto Sans"', mtavruli),
    );
    await expect(width(canvasElement, stack, mtavruli)).not.toBe(
      width(canvasElement, '"Noto Sans", serif', mtavruli),
    );
    // Observed in Chromium: text-transform: uppercase does not map
    // Mkhedruli to Mtavruli (it does upper-case Latin). If this starts
    // failing, Chromium changed, and the CSS heading becomes Mtavruli.
    await expect(width(canvasElement, stack, KA, true)).toBe(inStack);
    await expect(
      getComputedStyle(canvas.getByTestId("upper")).textTransform,
    ).toBe("uppercase");
  },
};

export const English: Story = {
  globals: { lang: "en", scheme: "light" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = canvas.getByTestId("body");
    await expect(body.textContent).toMatch(/unverified/);
    await expect(await loadKitFaces()).toBe(4);
    const stack = getComputedStyle(body).fontFamily;
    const inStack = width(canvasElement, stack, EN);
    await expect(inStack).toBe(width(canvasElement, '"Noto Sans"', EN));
    await expect(inStack).not.toBe(width(canvasElement, "serif", EN));
    // text-transform: uppercase does upper-case Latin (the twin of the
    // Georgian observation above).
    await expect(width(canvasElement, stack, EN, true)).toBe(
      width(canvasElement, stack, EN.toUpperCase()),
    );
    await expect(width(canvasElement, stack, EN, true)).not.toBe(inStack);
  },
};

export const GeorgianDark: Story = {
  globals: { lang: "ka", scheme: "dark" },
};

export const EnglishDark: Story = {
  globals: { lang: "en", scheme: "dark" },
};

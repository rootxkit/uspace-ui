// DOM snapshots of the golden set (docs/PLAN.md D9, §9). A snapshot
// changes only with a reviewed reason; update it with
// `pnpm test:browser -u` and say why in the PR.
import { composeStories } from "@storybook/react-vite";
import { render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import {
  I18nProvider,
  missingKeys,
  resetI18nCounters,
  useT,
} from "../../src/i18n/index.js";
import * as typography from "../i18n/Typography.stories.js";
import * as palettes from "./Palettes.stories.js";

const { PalettesLight, PalettesDark } = composeStories(palettes);
const { Georgian, English } = composeStories(typography);

// One element per line, so a reviewed diff reads line by line.
const pretty = (html: string): string => `${html.replace(/></g, ">\n<")}\n`;

let canvas: HTMLElement | null = null;

afterEach(() => {
  canvas?.remove();
  canvas = null;
  document.documentElement.removeAttribute("data-theme");
});

async function snapshot(
  story: typeof PalettesLight,
  scheme: "light" | "dark",
): Promise<string> {
  canvas = document.createElement("div");
  document.body.append(canvas);
  await story.run({ canvasElement: canvas });
  expect(document.documentElement.getAttribute("data-theme")).toBe(scheme);
  // The DOM is the same in both schemes; the colours each swatch resolves
  // to are what differs, so they are part of the snapshot.
  const colours = [...canvas.querySelectorAll<HTMLElement>("[data-token]")]
    .map(
      (el) => `${el.dataset["token"]}: ${getComputedStyle(el).backgroundColor}`,
    )
    .join("\n");
  return `${pretty(canvas.innerHTML)}<!-- resolved in ${scheme}\n${colours}\n-->\n`;
}

it("palettes.light", async () => {
  await expect(await snapshot(PalettesLight, "light")).toMatchFileSnapshot(
    "./__snapshots__/palettes.light.html",
  );
});

it("palettes.dark", async () => {
  await expect(await snapshot(PalettesDark, "dark")).toMatchFileSnapshot(
    "./__snapshots__/palettes.dark.html",
  );
});

async function snapshotStory(story: typeof Georgian): Promise<string> {
  canvas = document.createElement("div");
  document.body.append(canvas);
  await story.run({ canvasElement: canvas });
  return pretty(canvas.innerHTML);
}

it("typography.ka", async () => {
  await expect(await snapshotStory(Georgian)).toMatchFileSnapshot(
    "./__snapshots__/typography.ka.html",
  );
});

it("typography.en", async () => {
  await expect(await snapshotStory(English)).toMatchFileSnapshot(
    "./__snapshots__/typography.en.html",
  );
});

// The presence twin of the setup's missingKeys() check: a key that `ka`
// lacks is counted in the browser too. Reset after, so the setup's own
// afterEach sees the zero it requires.
it("counts a key missing in ka", () => {
  function Probe() {
    return <p>{useT()("story.only_en")}</p>;
  }
  const view = render(
    <I18nProvider lang="ka" catalogues={{ en: { "story.only_en": "English" } }}>
      <Probe />
    </I18nProvider>,
  );
  expect(view.container.textContent).toBe("English");
  expect(missingKeys()).toBe(1);
  view.unmount();
  resetI18nCounters();
});

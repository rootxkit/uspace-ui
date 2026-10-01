import { createElement } from "react";
import type { Decorator, Preview } from "@storybook/react-vite";

import { I18nProvider } from "../src/i18n/index.js";
import { ThemeProvider, type Brand } from "../src/theme/index.js";
import { TooltipProvider } from "../src/ui/index.js";
import "./preview.css";

// The role brand, never an organisation (PLAN §3.2).
const STORY_BRAND: Brand = {
  name: "U-space",
  shortName: "U-space",
  logoUrl: null,
  contact: null,
  accent: null,
};

// Every story runs inside the kit's ThemeProvider and I18nProvider;
// `globals.scheme` and `globals.lang` choose the scheme and the language,
// from the toolbar or per story (`globals: { scheme: "dark", lang: "ka" }`),
// so a story file exports one story per scheme and each one runs axe
// (WP-1). The fonts come from fonts/fonts.css (preview.css), as in an app
// without Next.js.
const withKit: Decorator = (Story, context) => {
  const scheme = context.globals["scheme"] === "dark" ? "dark" : "light";
  const lang = context.globals["lang"] === "ka" ? "ka" : "en";
  return createElement(
    ThemeProvider,
    { brand: STORY_BRAND, scheme },
    createElement(
      I18nProvider,
      { lang },
      createElement(
        TooltipProvider,
        null,
        createElement(
          "div",
          { lang, className: "bg-background p-4 text-foreground" },
          createElement(Story),
        ),
      ),
    ),
  );
};

const preview: Preview = {
  decorators: [withKit],
  initialGlobals: { scheme: "light", lang: "en" },
  globalTypes: {
    scheme: {
      description: "Colour scheme",
      toolbar: {
        title: "Scheme",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
    lang: {
      description: "Language",
      toolbar: {
        title: "Language",
        items: [
          { value: "en", title: "English" },
          { value: "ka", title: "Georgian" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    a11y: {
      // Every story passes axe at WCAG 2.2 AA; a violation fails the test.
      test: "error",
      options: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      },
    },
  },
};

export default preview;

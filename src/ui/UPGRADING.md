# Upgrading the vendored shadcn/ui components

`src/ui/*.tsx` is the output of the shadcn CLI, committed as the CLI
wrote it except for the import paths and the two patches listed below
(docs/PLAN.md D5, §3.3). The kit's own files sit beside it and are not
CLI output: `cn.ts`, `next-themes.ts`, `index.ts`, `extra/` and this
file. Additions go into `extra/`, never into a vendored file.

## Current vendoring

- CLI: `shadcn@4.21.1`, run on 2026-10-02.
- Registry style: `new-york` with Tailwind v4 (`tailwind.config` empty),
  which the CLI resolves to `new-york-v4`; primitives from the unified
  `radix-ui` package; icons from `lucide-react`.
- Components (PLAN §3.3): button badge card dialog alert-dialog sheet
  tabs tooltip popover dropdown-menu command select checkbox radio-group
  switch input textarea label separator scroll-area table skeleton
  sonner breadcrumb pagination collapsible.

## Procedure

Never run the CLI inside this repository: it rewrites `package.json`
and installs packages. Run it in a scratch directory and diff.

1. Make a scratch project:

   ```sh
   mkdir -p /tmp/shadcn/src/ui && cd /tmp/shadcn
   echo '{"name":"shadcn-vendor","private":true,"type":"module","dependencies":{"react":"19.3.0","react-dom":"19.3.0","tailwindcss":"4.3.3"}}' > package.json
   echo '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./src/*"]},"jsx":"react-jsx"}}' > tsconfig.json
   echo '@import "tailwindcss";' > src/app.css
   ```

   and this `components.json` (`rsc: true` keeps the `"use client"`
   directives upstream has):

   ```json
   {
     "$schema": "https://ui.shadcn.com/schema.json",
     "style": "new-york",
     "rsc": true,
     "tsx": true,
     "tailwind": {
       "config": "",
       "css": "src/app.css",
       "baseColor": "neutral",
       "cssVariables": true,
       "prefix": ""
     },
     "iconLibrary": "lucide",
     "aliases": {
       "components": "@/components",
       "utils": "@/ui/cn",
       "ui": "@/ui",
       "lib": "@/lib",
       "hooks": "@/hooks"
     }
   }
   ```

2. Run the CLI at the new version with the list above:

   ```sh
   pnpm dlx shadcn@<version> add button badge card dialog alert-dialog \
     sheet tabs tooltip popover dropdown-menu command select checkbox \
     radio-group switch input textarea label separator scroll-area table \
     skeleton sonner breadcrumb pagination collapsible --yes
   ```

3. Rewrite the import paths, and nothing else:

   ```sh
   for f in src/ui/*.tsx; do
     sed -e 's#from "cn"#from "./cn.js"#' \
         -e 's#from "@/ui/\([a-z-]*\)"#from "./\1.js"#' \
         -e 's#from "next-themes"#from "./next-themes.js"#' \
         "$f" > "<repo>/src/ui/$(basename "$f")"
   done
   ```

4. Re-apply the patches below, then read `git diff src/ui`: every change
   is upstream's. Check the scratch `package.json` for a new or bumped
   dependency; a new one needs a row in PLAN §4 and a reason in the
   commit body, and the pins in this repo's `package.json` move with it.
5. Run `pnpm check`, `pnpm test` and `pnpm test:browser` (every `ui`
   story runs axe in both schemes), regenerate the API report, and say
   in the PR which upstream changes came in.

## Import paths

| Upstream      | Here               | Why                                                                                                                                                                                                                               |
| ------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cn`          | `./cn.js`          | The `new-york-v4` registry imports `cn` from a bare `cn` and lists `cn` as a dependency, so the CLI installs the unrelated npm package `cn`. Never add that package; `cn.ts` is shadcn's own `lib/utils`.                         |
| `@/ui/<name>` | `./<name>.js`      | The package is built by `tsc` with NodeNext resolution (PLAN D3): relative paths with the `.js` extension, no path aliases.                                                                                                       |
| `next-themes` | `./next-themes.js` | `sonner.tsx` reads the theme from `next-themes`, which keeps it in `localStorage` (forbidden by PLAN §6.1) and would be a second theme owner. `next-themes.ts` answers the same `useTheme()` call from the kit's `ThemeProvider`. |

## Local patches

Each is one inserted line, re-applied by hand after step 3:

- `dropdown-menu.tsx`, before `<DropdownMenuPrimitive.CheckboxItem` in
  `DropdownMenuCheckboxItem`, and `sonner.tsx`, before `<Sonner`:
  `// @ts-expect-error exactOptionalPropertyTypes: local patch, see UPGRADING.md`.
  Upstream passes a possibly `undefined` value to an optional prop,
  which the kit's `exactOptionalPropertyTypes` refuses. If upstream fixes
  it, `tsc` reports the directive as unused and the line is dropped.

Outside the files: `.prettierignore` leaves `src/ui/*.tsx` as the CLI
formatted it, and `eslint.config.js` turns off
`jsx-a11y/anchor-has-content` for `pagination.tsx` only (its link
content arrives through a props spread the rule cannot see).

## Known upstream behaviour to remember

- Some vendored components carry English text, mostly for screen
  readers. The files stay as upstream wrote them, so a console in `ka`
  replaces the text through props or by composing the parts, with the
  `ui.*` keys of the kit's catalogues (`src/i18n/en.ts`, `ka.ts`):

  | Component                              | Upstream text                                                         | Replace with                                                                              | Key                                                          |
  | -------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
  | `DialogContent`, `SheetContent`        | "Close" (icon button)                                                 | `showCloseButton={false}` and a `DialogClose` / `SheetClose` of your own                  | `ui.close`                                                   |
  | `DialogFooter showCloseButton`         | "Close" (button)                                                      | leave `showCloseButton` off; render a `DialogClose`                                       | `ui.close`                                                   |
  | `Breadcrumb`                           | `aria-label="breadcrumb"`                                             | `aria-label` prop                                                                         | `ui.breadcrumb`                                              |
  | `BreadcrumbEllipsis`                   | "More"                                                                | a `<span>` with your own text; the text is not a prop                                     | `ui.more`                                                    |
  | `Pagination`                           | `aria-label="pagination"`                                             | `aria-label` prop                                                                         | `ui.pagination`                                              |
  | `PaginationPrevious`, `PaginationNext` | "Previous", "Next"; `aria-label` "Go to previous/next page"           | a `PaginationLink` with your own content and `aria-label`; the visible text is not a prop | `ui.previous`, `ui.next`, `ui.previous_page`, `ui.next_page` |
  | `PaginationEllipsis`                   | "More pages"                                                          | a `<span>` with your own text; the text is not a prop                                     | `ui.more_pages`                                              |
  | `CommandDialog`                        | title "Command Palette", description "Search for a command to run..." | `title` and `description` props                                                           | `ui.command_title`, `ui.command_description`                 |

  The `ui` stories do this in both languages (`stories/ui/texts.ts`).

- `ScrollArea` (Radix) injects a `<style>` element to hide the native
  scrollbar. Under the PLAN §7 CSP (`style-src 'self'`, no
  `'unsafe-inline'`) the browser refuses it, and the native scrollbar
  shows next to the custom one; the content still scrolls. The CSP story
  (`stories/csp/`) checks which components render with no violation.
- The open and close animations use the `tw-animate-css` classes
  (`animate-in`, `fade-in-0`, ...). The kit does not depend on it; an
  app that wants the animations imports `tw-animate-css` after
  Tailwind. Without it the components open and close without animation.

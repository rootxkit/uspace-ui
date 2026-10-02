import { expect } from "vitest";

import { AGE_BUCKETS, tokens } from "../../src/theme/index.js";

// The four semantic palettes and the age buckets with their variable
// names (WP-1). Meaning is WP-6's and WP-7's; this page shows what the
// tokens are, per scheme. Golden: browser/golden/golden.test.tsx keeps a
// DOM snapshot of each scheme.

interface Palette {
  title: string;
  names: Readonly<Record<string, string>>;
}

const PALETTES: readonly Palette[] = [
  { title: "Severity", names: tokens.severity },
  { title: "Trust class", names: tokens.trust },
  {
    title: "Identification status",
    names: { ...tokens.ident, none: tokens.identNone },
  },
  { title: "Zone type", names: tokens.zone },
  {
    title: "Age",
    names: Object.fromEntries(
      AGE_BUCKETS.map((b, i) => [b, tokens.age[i] ?? ""]),
    ),
  },
];

export function Palettes() {
  return (
    <div className="grid gap-6">
      {PALETTES.map((p) => (
        <section key={p.title} aria-label={p.title}>
          <h2 className="mb-2 text-base font-semibold">{p.title}</h2>
          <ul className="grid gap-1">
            {Object.entries(p.names).map(([key, name]) => (
              <li key={key} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  data-token={name}
                  className="inline-block h-5 w-10 rounded-sm"
                  style={{ background: `var(${name})` }}
                />
                <span className="w-44 font-medium">{key}</span>
                <code className="text-sm text-muted-foreground">{name}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Every swatch resolves to a colour from styles/tokens.css: a missing
 * variable would leave it transparent.
 */
export function checkPalettes(canvasElement: HTMLElement): void {
  const swatches = canvasElement.querySelectorAll<HTMLElement>("[data-token]");
  expect(swatches.length).toBe(
    PALETTES.reduce((n, p) => n + Object.keys(p.names).length, 0),
  );
  for (const s of swatches) {
    expect(getComputedStyle(s).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  }
}

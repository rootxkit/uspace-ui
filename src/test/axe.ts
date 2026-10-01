import axe from "axe-core";

// WCAG 2.2 AA: the success criteria of levels A and AA up to 2.2 (PLAN §8
// accessibility row, §14 Q11 default).
export const WCAG_22_AA_TAGS: readonly string[] = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
];

/** Formats axe violations one per line: rule id, impact, help and targets. */
export function formatViolations(violations: readonly axe.Result[]): string {
  return violations
    .map((v) => {
      const targets = v.nodes.map((n) => n.target.join(" ")).join(", ");
      return `${v.id} (${v.impact ?? "unknown"}): ${v.help} [${targets}]`;
    })
    .join("\n");
}

/**
 * Runs axe on `container` and rejects on any WCAG 2.2 AA violation, with
 * the violations listed in the error. Resolves with nothing otherwise.
 */
export async function axeCheck(container: HTMLElement): Promise<void> {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: [...WCAG_22_AA_TAGS] },
    resultTypes: ["violations"],
  });
  if (result.violations.length > 0) {
    throw new Error(
      `axe: ${result.violations.length} WCAG 2.2 AA violation(s)\n${formatViolations(result.violations)}`,
    );
  }
}

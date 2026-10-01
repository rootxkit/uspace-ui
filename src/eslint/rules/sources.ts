import type { Rule } from "eslint";

/** Called with every module specifier a file imports, re-exports or requires. */
export type SourceVisitor = (source: string, node: Rule.Node) => void;

function literal(node: unknown): string | null {
  if (typeof node !== "object" || node === null) return null;
  const n = node as { type?: unknown; value?: unknown };
  return n.type === "Literal" && typeof n.value === "string" ? n.value : null;
}

/**
 * Listeners that report every static module specifier: `import`, `export
 * ... from`, `import()` with a string literal and `require()` with one.
 */
export function visitSources(visit: SourceVisitor): Rule.RuleListener {
  const fromSource = (node: Rule.Node & { source?: unknown }): void => {
    const s = literal(node.source);
    if (s !== null) visit(s, node);
  };
  return {
    ImportDeclaration: fromSource,
    ExportNamedDeclaration: fromSource,
    ExportAllDeclaration: fromSource,
    ImportExpression: fromSource,
    CallExpression(node) {
      const callee = node.callee;
      if (callee.type !== "Identifier" || callee.name !== "require") return;
      const s = literal(node.arguments[0]);
      if (s !== null) visit(s, node);
    },
  };
}

/** The file name with forward slashes, so path rules read the same on Windows. */
export function posixFilename(context: Rule.RuleContext): string {
  return context.filename.replace(/\\/g, "/");
}

// Field paths both ways (docs/PLAN.md §3.15, §8.7 of uspace-core): the API
// names a refused field by its JSON path as `core.FieldError` writes it
// (`features[3].properties.name`), and react-hook-form registers
// it with dots (`features.3.properties.name`). A JSON Pointer
// (`/features/3/geometry`) and a `$.`-rooted path are read too. Nothing
// here guesses: a path that does not normalise onto a registered field
// is listed as it came, never dropped.

const BRACKET_INDEX = /\[(\d+)\]/g;
const BRACKET_KEY = /\[(?:"([^"]*)"|'([^']*)')\]/g;

/** A JSON path or pointer as a react-hook-form field name. */
export function toFieldName(path: string): string {
  let p = path.trim();
  if (p.startsWith("/")) {
    return p
      .slice(1)
      .split("/")
      .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
      .join(".");
  }
  if (p.startsWith("$")) p = p.slice(1);
  p = p
    .replace(BRACKET_INDEX, ".$1")
    .replace(
      BRACKET_KEY,
      (_m, dq?: string, sq?: string) => `.${dq ?? sq ?? ""}`,
    );
  return p.replace(/^\.+/, "");
}

/** A field name as the API's JSON path: numeric segments in brackets. */
export function toJsonPath(name: string): string {
  return name
    .split(".")
    .filter((s) => s !== "")
    .map((s, i) => (/^\d+$/.test(s) ? `[${s}]` : i === 0 ? s : `.${s}`))
    .join("");
}

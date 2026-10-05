export interface GoToken {
  kind: "ident" | "string" | "number" | "punct";
  value: string;
}
export function tokenize(src: string): GoToken[];
export function parseConsts(
  src: string,
): { name: string; type: string; value: string }[];
export function structFields(src: string, name: string): string[];
export function extract(checkout: string, packages: string[]): string[];

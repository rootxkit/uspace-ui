export function planNames(plan: string): Set<string>;
export function decide(
  entry: string,
  name: string,
  file: string,
  names: Set<string>,
): "public" | "beta";
export function promote(promoted: Set<string>): Set<string>;

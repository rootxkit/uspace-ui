export interface Budget {
  paths: string[];
  maxGzipBytes: number;
}
export interface Row {
  name: string;
  files: number;
  gzipBytes: number;
  maxGzipBytes: number;
  status: "ok" | "over" | "empty";
}
export function jsFiles(dir: string): string[];
export function measure(budgets: Record<string, Budget>, root: string): Row[];
export function report(rows: Row[]): [string, boolean];

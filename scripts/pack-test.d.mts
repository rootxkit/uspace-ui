export interface Manifest {
  files: string[];
  exports?: Record<string, unknown>;
  bin?: Record<string, string>;
}
export const ALWAYS: string[];
export const REQUIRED: string[];
export const FORBIDDEN: RegExp[];
export function readTarEntries(
  gz: Uint8Array,
): { path: string; size: number }[];
export function expectedFiles(root: string, pkg: Manifest): string[];
export function exportTargets(
  exportsMap: Record<string, unknown>,
): { key: string; target: string }[];
export function packProblems(
  actual: string[],
  expected: string[],
  pkg: Manifest,
): string[];
export function pack(root: string, outDir: string): string;

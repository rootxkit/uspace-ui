export const API_REPORT: string;
export const TOKENS: string;
export const CHANGELOG: string;
export const SYMBOLOGY_DIR: string;
export const LEGEND_TOKEN: RegExp;
export const LEGEND_FUNCTION: RegExp;
export const CITATION: RegExp;

export function diffLines(
  a: readonly string[],
  b: readonly string[],
): { removed: number[]; added: number[] };

export type ReportLine =
  | { kind: "ignore" }
  | { kind: "decl"; name: string; tag: string }
  | { kind: "member"; name: string }
  | { kind: "namespace"; name: string };
export function classifyReport(text: string): {
  lines: string[];
  classes: ReportLine[];
  tags: Map<string, string>;
};

export interface ApiChange {
  line: number;
  text: string;
  name: string | undefined;
}
export function apiReportChanges(
  baseText: string,
  headText: string,
): { breaking: ApiChange[]; beta: ApiChange[] };

export function tokenChanges(
  baseText: string,
  headText: string,
): { line: number; text: string }[];

export function legendFunctionRanges(
  source: string,
  fileName?: string,
): { name: string; from: number; to: number }[];

export function symbologyChanges(
  path: string,
  baseText: string,
  headText: string,
): { path: string; fn: string; line: number; text: string }[];

export function versionHeadings(
  text: string,
): { major: number; minor: number; patch: number }[];

export function breakingHeading(
  baseVersion: string,
  baseChangelog: string,
  headChangelog: string,
): { need: string; found: string | null; fresh: string[] };

export function citations(
  baseChangelog: string,
  headChangelog: string,
): string[];

export interface GateInput {
  baseVersion: string;
  base: { report: string; tokens: string; changelog: string };
  head: { report: string; tokens: string; changelog: string };
  symbology: { path: string; base: string; head: string }[];
  labels: string[];
}
export function evaluate(input: GateInput): { ok: boolean; report: string[] };

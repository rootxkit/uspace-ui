export interface KitImport {
  entry: string;
  name: string;
}
export interface PinnedImports {
  consumers: Record<
    string,
    { commit: string; imports: Record<string, readonly string[]> }
  >;
}
export function kitImports(fileName: string, text: string): KitImport[];
export function problems(
  pinned: PinnedImports,
  tags: ReadonlyMap<string, string>,
): string[];
export function exportTags(): Map<string, string>;
export function check(): string[];

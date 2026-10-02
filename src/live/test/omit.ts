// `o` without `keys`, typed, for tests that need a view model short of a
// field (a plain `FeedStatus`, a `SourceView` without the store's age).
export function omit<T extends object, K extends keyof T>(
  o: T,
  ...keys: K[]
): Omit<T, K> {
  const drop = new Set<PropertyKey>(keys);
  return Object.fromEntries(
    Object.entries(o).filter(([k]) => !drop.has(k)),
  ) as Omit<T, K>;
}

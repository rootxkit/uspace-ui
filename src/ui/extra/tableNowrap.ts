// The opt-out from wrapping for the vendored table (1.1.1). `TableHead`
// and `TableCell` wrap by default (a local patch, src/ui/UPGRADING.md):
// text breaks between words and a long token (a URL, a hash, a list with
// no spaces) breaks anywhere, so a table fits its container instead of
// widening past it. A column whose value must read as one unit, such as
// an id, a timestamp or a number, keeps to one line with this class.

/**
 * The `className` that keeps a `TableHead`, a `TableCell`, or any element
 * inside one, on one line: `<TableCell className={TABLE_NOWRAP}>`.
 * Combine it with other classes through `cn()`. Use it for ids, codes,
 * timestamps and numbers, where a line break would change how the value
 * reads; leave prose and lists to wrap. A `DataTable` column made by
 * `columns.num`, `columns.utc`, `columns.age` or `columns.text` with
 * `mono` stays on one line already (`ColumnOptions.nowrap`).
 *
 * @public
 */
export const TABLE_NOWRAP: string = "whitespace-nowrap wrap-normal";

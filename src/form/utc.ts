// A time typed in UTC (spec 02 §1: RFC 3339 UTC with `Z`; LESSONS S-16).
// The box is a `datetime-local`, whose value is a wall-clock string with
// no zone. The label says UTC, so that string is read as UTC by text
// alone: no `Date` in the browser's zone touches it, and a daylight-saving
// change in the person's zone cannot move the instant.

const LOCAL =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
const ZONED =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i;

/** True for an RFC 3339 date-time with a zone designator. */
export function isRfc3339(v: string): boolean {
  return ZONED.test(v);
}

/** True for an RFC 3339 date-time in UTC (`Z`). */
export function isRfc3339Utc(v: string): boolean {
  return ZONED.test(v) && /z$/i.test(v);
}

const two = (n: number): string => String(n).padStart(2, "0");

/**
 * The box's text for an RFC 3339 time: its UTC wall clock to the minute,
 * with seconds when they are not zero. "" for null and for a string that
 * is not an RFC 3339 time with a zone (a time without one has no instant).
 */
export function utcToInput(iso: string | null): string {
  if (iso === null || !isRfc3339(iso.trim())) return "";
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return "";
  const date = `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;
  const time = `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  const s = d.getUTCSeconds();
  return `${date}T${time}${s === 0 ? "" : `:${two(s)}`}`;
}

/**
 * The RFC 3339 UTC time for the box's text ("2026-03-29T00:30" ->
 * "2026-03-29T00:30:00Z"); null for an empty or partial box.
 */
export function inputToUtc(local: string): string | null {
  const m = LOCAL.exec(local.trim());
  if (m === null) return null;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s ?? "00"}Z`;
}

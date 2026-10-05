// The reference adapters (WP-14, PLAN §6.3 "app adapter to TrackView"):
// what a system's `web/` writes once, from its generated API types to the
// kit's view models, here written against the lab's schema examples and
// exported from `/test` as examples. They read; they never judge,
// convert a unit or a datum, or fill in a value the message did not carry
// (an absent number is null). An enumeration value the kit cannot name is
// not mapped to a neighbour: the adapter refuses the message and names
// the field and the value, which is the conformance hook of spec 04 §4 (a
// shape the bus can carry and the kit cannot show is found in a test, not
// on a console).

/**
 * An adapter's answer: the view model, or the field it could not map.
 *
 * @public
 */
export type Adapted<T> =
  | { ok: true; value: T }
  | { ok: false; field: string; value: unknown; reason: string };

/** @beta */
export const adapted = <T>(value: T): Adapted<T> => ({ ok: true, value });

/** @beta */
export function refused<T>(
  field: string,
  value: unknown,
  reason: string,
): Adapted<T> {
  return { ok: false, field, value, reason };
}

/**
 * Thrown by `unwrap` with the refusal it found.
 *
 * @beta
 */
export class AdapterRefusal extends Error {
  readonly field: string;
  readonly value: unknown;
  constructor(field: string, value: unknown, reason: string) {
    super(`${field}: ${reason} (${JSON.stringify(value)})`);
    this.name = "AdapterRefusal";
    this.field = field;
    this.value = value;
  }
}

/**
 * The value, or a thrown AdapterRefusal naming the field.
 *
 * @beta
 */
export function unwrap<T>(a: Adapted<T>): T {
  if (a.ok) return a.value;
  throw new AdapterRefusal(a.field, a.value, a.reason);
}

export type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export const obj = (v: unknown): Obj => (isObj(v) ? v : {});
/** A finite number, or null: never a zero for an absent value. */
export const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
export const str = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

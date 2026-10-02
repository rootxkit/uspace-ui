// Shape checks the kit's fields need (docs/PLAN.md §3.15, WP-10 done-when):
// an RFC 3339 UTC time, a bounding box in [lng, lat] order, a mandatory
// reason. Shape only, nothing about meaning: the API validates meaning
// with the strict readers of uspace-core and names every field it
// refuses; the form puts that refusal on the field.
import { z } from "zod";

import { isRfc3339Utc } from "./utc.js";

/** `[minLng, minLat, maxLng, maxLat]`, the GeoJSON bbox order. */
export type BBoxValue = [number, number, number, number];

/** An RFC 3339 time in UTC with `Z` (spec 02 §1). */
export function utcTime() {
  return z.string().refine(isRfc3339Utc, { message: "form.error.not_utc" });
}

/**
 * Four numbers in `[lng, lat]` order, the minimum corner first. The
 * order is shape: a box whose west edge is east of its east edge, or
 * whose south edge is north of its north edge, is refused with an error
 * on the box that names the pair.
 */
export function bbox() {
  return z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .superRefine((b, ctx) => {
      if (b[0] > b[2])
        ctx.addIssue({ code: "custom", message: "form.error.bbox_lng_order" });
      if (b[1] > b[3])
        ctx.addIssue({ code: "custom", message: "form.error.bbox_lat_order" });
    });
}

/**
 * A reason a person gives for an audited act (02 §1 failure rule: "every
 * disable is an audited act by a person"), trimmed, at least `minLength`
 * characters. The length is the caller's; there is no default.
 */
export function reason(minLength: number) {
  return z
    .string()
    .trim()
    .min(1, { message: "form.error.required", abort: true })
    .min(minLength, { message: "form.error.reason_too_short" });
}

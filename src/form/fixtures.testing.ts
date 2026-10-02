// Synthetic schemas, defaults and problem bodies for the form unit and
// browser tests (spec 06 §4: GEO-TEST-* and TEST* only). The problem
// bodies are in the one shape every national API answers with (RFC 9457 with
// `errors[{field, reason}]`, PLAN §3.7, M28), as uspace-core writes the
// paths (`features[0].properties.name`).
import { z } from "zod";

import { ApiError } from "../api/error.js";
import {
  TRUSTS,
  VERTICAL_REFS,
  ZONE_TYPES,
  type FieldError,
  type Problem,
} from "../model/index.js";
import * as shapes from "./shapes.js";

/** A zone-shaped form: the ED-318 fields a zone form edits (02 F1). */
export const zoneSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        identifier: z.string().min(1),
        name: z.string().min(1),
        type: z.enum(ZONE_TYPES),
        lowerRef: z.enum(VERTICAL_REFS),
        lower: z.number(),
        upperRef: z.enum(VERTICAL_REFS),
        upper: z.number(),
        start: shapes.utcTime(),
        end: shapes.utcTime().nullable(),
        message: z.string(),
      }),
    }),
  ),
});

export type ZoneForm = z.input<typeof zoneSchema>;

export const ZONE_DEFAULTS: ZoneForm = {
  features: [
    {
      properties: {
        identifier: "GEO-TEST-Z-0001",
        name: "TEST zone",
        type: "REQ_AUTHORIZATION",
        lowerRef: "AGL",
        lower: 0,
        upperRef: "AMSL",
        upper: 900,
        start: "2026-03-29T00:30:00Z",
        end: null,
        message: "",
      },
    },
  ],
};

/** The problem a strict ED-318 reader returns for a refused zone. */
export const ZONE_PROBLEM: Problem = {
  type: "https://schemas.uspace.ge/problems/validation",
  title: "The zone dataset was refused",
  status: 422,
  detail: "2 problems in the submitted features.",
  instance: null,
  errors: [
    {
      field: "features[0].properties.upper",
      reason: "must be above the lower limit of the same feature",
    },
    {
      field: "features[0].geometry[0].horizontalProjection",
      reason: "polygon ring is not closed",
    },
  ],
};

export function apiError(problem: Problem, retryAfterS: number | null = null) {
  return new ApiError({
    status: problem.status,
    problem,
    retryAfterS,
    requestId: "TEST-REQ-1",
    sunset: null,
  });
}

/** `n` field errors on paths no form registers, and the truncation flag. */
export function manyErrors(n: number): FieldError[] {
  return Array.from({ length: n }, (_, i) => ({
    field: `features[${i}].geometry`,
    reason: `TEST problem ${i + 1}`,
  }));
}

/** A small form with one of each field. */
export const allFieldsSchema = z.object({
  callsign: z.string().min(1),
  massKg: z.number().nullable(),
  heightM: z.number(),
  trust: z.enum(TRUSTS).nullable(),
  ref: z.enum(VERTICAL_REFS).nullable(),
  ack: z.boolean(),
  at: shapes.utcTime(),
  area: shapes.bbox(),
  reason: shapes.reason(10),
});

export type AllFields = z.input<typeof allFieldsSchema>;

export const ALL_DEFAULTS: AllFields = {
  callsign: "",
  massKg: null,
  heightM: Number.NaN,
  trust: null,
  ref: null,
  ack: false,
  at: "2026-03-29T00:30:00Z",
  area: [44.7, 41.6, 44.9, 41.8],
  reason: "",
};

/** The app's catalogue for the test labels, in both languages. */
export const FORM_CATALOGUES = {
  en: {
    "zone.form.identifier": "Identifier",
    "zone.form.name": "Name",
    "zone.form.type": "Zone type",
    "zone.form.lowerRef": "Lower limit reference",
    "zone.form.lower": "Lower limit",
    "zone.form.upperRef": "Upper limit reference",
    "zone.form.upper": "Upper limit",
    "zone.form.start": "Applies from",
    "zone.form.end": "Applies until",
    "zone.form.message": "Message to operators",
    "zone.form.submit": "Publish zone",
    "datum.AMSL": "AMSL",
    "datum.AGL": "AGL",
    "datum.WGS84": "WGS84 ellipsoid",
    "t.callsign": "Call sign",
    "t.mass": "Mass",
    "t.height": "Height",
    "t.trust": "Trust",
    "t.ref": "Reference",
    "t.ack": "I have read the conditions",
    "t.at": "Start",
    "t.area": "Area",
    "t.submit": "Send",
  },
  ka: {
    "zone.form.identifier": "იდენტიფიკატორი",
    "zone.form.name": "სახელი",
    "zone.form.type": "ზონის ტიპი",
    "zone.form.lowerRef": "ქვედა ზღვრის ათვლა",
    "zone.form.lower": "ქვედა ზღვარი",
    "zone.form.upperRef": "ზედა ზღვრის ათვლა",
    "zone.form.upper": "ზედა ზღვარი",
    "zone.form.start": "მოქმედებს",
    "zone.form.end": "მოქმედებს ამ დრომდე",
    "zone.form.message": "შეტყობინება ოპერატორებს",
    "zone.form.submit": "ზონის გამოქვეყნება",
    "datum.AMSL": "ზღვის დონიდან",
    "datum.AGL": "მიწიდან",
    "datum.WGS84": "WGS84 ელიფსოიდიდან",
    "t.callsign": "სახმობი ნიშანი",
    "t.mass": "მასა",
    "t.height": "სიმაღლე",
    "t.trust": "სანდოობა",
    "t.ref": "ათვლა",
    "t.ack": "პირობები წავიკითხე",
    "t.at": "დაწყება",
    "t.area": "არეალი",
    "t.submit": "გაგზავნა",
  },
} as const;

// RFC 9457 problem details in the one shape every national API answers
// with (docs/PLAN.md §3.7, §14 Q2; reconciliation M28):
// `{type, title, status, detail, instance, errors: [{field, reason}],
// truncated?}`, `type` = https://schemas.uspace.ge/problems/<slug>.
// Anything else degrades to `problem: null` and "request failed, status N";
// a system that answers differently is a reconciliation finding, not an
// adapter here (CLAUDE.md rule 12).
import type { FieldError, Problem } from "../model/index.js";

import { countApi } from "./counters.js";

/**
 * The namespace every problem `type` lives under (M28).
 *
 * @beta
 */
export const PROBLEM_TYPE_PREFIX = "https://schemas.uspace.ge/problems/";

const SLUG = /^[a-z][a-z0-9_]*$/;
const PROBLEM_MEDIA_TYPE = "application/problem+json";

/**
 * The refusal name off a problem `type` (`cis_stale`, `unauthenticated`,
 * ...), so a status component can label it by key. `null` for a `type`
 * outside the problems namespace: the component shows the `title`.
 *
 * @beta
 */
export function problemSlug(type: string): string | null {
  if (!type.startsWith(PROBLEM_TYPE_PREFIX)) return null;
  const slug = type.slice(PROBLEM_TYPE_PREFIX.length);
  return SLUG.test(slug) ? slug : null;
}

/** True when the response says its body is `application/problem+json`. */
export function isProblemResponse(res: Response): boolean {
  const type = res.headers.get("Content-Type");
  if (type === null) return false;
  return type.split(";")[0]?.trim().toLowerCase() === PROBLEM_MEDIA_TYPE;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fieldErrorOf(v: unknown): FieldError | null {
  if (!isRecord(v)) return null;
  const { field, reason } = v;
  if (typeof field !== "string" || typeof reason !== "string") return null;
  return { field, reason };
}

/**
 * A problem body as the kit's `Problem`, or `null` when it is not one.
 * Unknown members are ignored (02 §1); a malformed `errors` entry is
 * dropped and counted, never invented.
 */
export function toProblem(body: unknown, status: number): Problem | null {
  if (!isRecord(body)) return null;
  // RFC 9457 §4.2.1: an absent `type` means "about:blank".
  const type = body["type"] === undefined ? "about:blank" : body["type"];
  const title = body["title"];
  if (typeof type !== "string" || typeof title !== "string") return null;
  // RFC 9457 §3.1.2: `status` is advisory; the response's own status
  // stands in when it is absent or not a number.
  const st = body["status"];
  const detail = body["detail"];
  const instance = body["instance"];
  const errors: FieldError[] = [];
  const rawErrors = body["errors"];
  if (Array.isArray(rawErrors)) {
    for (const e of rawErrors) {
      const fe = fieldErrorOf(e);
      if (fe === null) countApi("field_error_malformed");
      else errors.push(fe);
    }
  } else if (rawErrors !== undefined) {
    countApi("field_error_malformed");
  }
  const problem: Problem = {
    type,
    title,
    status: typeof st === "number" && Number.isInteger(st) ? st : status,
    detail: typeof detail === "string" ? detail : null,
    instance: typeof instance === "string" ? instance : null,
    errors,
  };
  const truncated = body["truncated"];
  if (typeof truncated === "boolean") problem.truncated = truncated;
  return problem;
}

/**
 * Reads an `application/problem+json` body (§14 Q2). `null` for any other
 * content type; `null` and a count for a problem body that does not parse.
 * Consumes the body: pass a `clone()` when the caller still needs it.
 *
 * @public
 */
export async function parseProblem(res: Response): Promise<Problem | null> {
  if (!isProblemResponse(res)) return null;
  let body: unknown;
  try {
    body = JSON.parse(await res.text());
  } catch {
    countApi("problem_malformed");
    return null;
  }
  const problem = toProblem(body, res.status);
  if (problem === null) countApi("problem_malformed");
  return problem;
}

// How fresh an answer is, read off what the API said and nothing else
// (docs/PLAN.md §3.7; spec 02 F3, F5; reconciliation M15): the `ETag`
// header, and the body fields the app points at. The kit never guesses a
// field it was not pointed at and never computes an age itself.

/** What an API said about the freshness of one answer. */
export interface Freshness {
  /** The `ETag` header, as sent (the dataset version, 02 §1). */
  etag: string | null;
  /** The dataset version (`cis_version`). */
  version: string | null;
  /** When the dataset last changed (`cis_updated_at`, or `metadata.issued`). */
  updatedAt: string | null;
  /** The age the API computed (`cis_age_s`), in seconds. */
  ageS: number | null;
  /** True only when the API marked the answer stale (02 F5). */
  stale: boolean;
}

/**
 * Where each freshness field is in the body, as a dotted path
 * (`metadata.issued`). A field without a path is `null`: the kit reads
 * only what it was pointed at.
 */
export interface FreshnessPick {
  version?: string;
  updatedAt?: string;
  ageS?: string;
  stale?: string;
}

/**
 * The CISP's top-level members (02 F3, F5 as reconciled, M15). An app
 * reading the authority's export points `updatedAt` at `metadata.issued`.
 */
export const DEFAULT_FRESHNESS_PICK: Readonly<Required<FreshnessPick>> = {
  version: "cis_version",
  ageS: "cis_age_s",
  stale: "stale",
  updatedAt: "cis_updated_at",
};

function at(body: unknown, path: string | undefined): unknown {
  if (path === undefined) return undefined;
  let cur: unknown = body;
  for (const key of path.split(".")) {
    if (typeof cur !== "object" || cur === null || Array.isArray(cur))
      return undefined;
    if (!Object.hasOwn(cur, key)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * The freshness of one answer: `etag` from the header, the rest from the
 * body fields `pick` points at (the CISP's by default). A field that is
 * absent or of the wrong type is `null`, never `0` or `""`.
 */
export function freshnessOf(
  res: Response,
  body: unknown,
  pick: FreshnessPick = DEFAULT_FRESHNESS_PICK,
): Freshness {
  const version = at(body, pick.version);
  const updatedAt = at(body, pick.updatedAt);
  const ageS = at(body, pick.ageS);
  return {
    etag: res.headers.get("ETag"),
    // A version is an opaque token; the CISP sends an integer.
    version:
      typeof version === "string"
        ? version
        : typeof version === "number" && Number.isFinite(version)
          ? String(version)
          : null,
    updatedAt: typeof updatedAt === "string" ? updatedAt : null,
    ageS: typeof ageS === "number" && Number.isFinite(ageS) ? ageS : null,
    stale: at(body, pick.stale) === true,
  };
}

// The stub API the example runs against, so it needs no system (WP-13).
// A stub for this example only and never a template for a system's API:
// it signs nothing, checks no clock, evaluates no applicability, stores
// nothing and limits nothing. A real API does all of that in Go.
//
// - POST /stub-api/v1/auth/login {username, password}: a fixture user
//   gets a session JWT in the reconciled shape (docs/PLAN.md §6.3: `sub`,
//   `scope = "session"`, `roles: [...]`, `realm: "console"`, `jti`,
//   `exp`), unsigned (`alg: none`), since the BFF never verifies it and
//   nothing here reads it back. Anything else is 401.
// - POST /stub-api/v1/auth/logout: 204.
// - GET /stub-api/v1/zones[?applies_at=<RFC 3339>]: the fixture ED-318
//   collection with an ETag and `cis_version` / `cis_updated_at`; with
//   `applies_at`, every feature is annotated with
//   `extendedProperties.cis_applicability`, copied from the fixture's
//   stub answer (spec 02 F3; reconciliation M17), never filtered.
import { POLICY } from "../config";
import users from "../../fixtures/users.json";
import zones from "../../fixtures/zones.json";

function problem(
  status: number,
  slug: string,
  title: string,
  detail: string,
  errors: { field: string; reason: string }[] = [],
): Response {
  return new Response(
    JSON.stringify({
      type: `https://schemas.uspace.ge/problems/${slug}`,
      title,
      status,
      detail,
      errors,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "no-store",
      },
    },
  );
}

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** POST /v1/auth/login. */
export async function stubLogin(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  const user = users.users.find(
    (u) => u.username === b["username"] && u.password === b["password"],
  );
  if (user === undefined) {
    return problem(
      401,
      "invalid_credentials",
      "Sign-in refused",
      "The username or password is not right.",
    );
  }
  const maxAgeS = POLICY.sessionMaxAgeS.value;
  const issuedS = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "stub-api",
    aud: new URL(req.url).host,
    sub: user.sub,
    scope: "session",
    roles: user.roles,
    realm: user.realm,
    jti: crypto.randomUUID(),
    iat: issuedS,
    exp: issuedS + maxAgeS,
    kid: "stub-unsigned",
  };
  const token = `${b64url({ alg: "none", typ: "JWT" })}.${b64url(claims)}.`;
  return Response.json(
    { token, expires_at: new Date(claims.exp * 1000).toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST /v1/auth/logout. */
export function stubLogout(): Response {
  return new Response(null, { status: 204 });
}

const RFC3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** GET /v1/zones. */
export function stubZones(req: Request): Response {
  const etag = `"${zones.cis_version}"`;
  const appliesAt = new URL(req.url).searchParams.get("applies_at");
  if (appliesAt !== null && !RFC3339.test(appliesAt)) {
    return problem(
      400,
      "invalid_query",
      "Invalid query",
      "applies_at is not an RFC 3339 time.",
      [{ field: "applies_at", reason: "want an RFC 3339 time" }],
    );
  }
  const headers = {
    "Content-Type": "application/geo+json",
    ETag: etag,
    "Cache-Control": "no-cache",
  };
  if (req.headers.get("if-none-match") === etag && appliesAt === null) {
    return new Response(null, { status: 304, headers });
  }
  const features = zones.features.map((f) => ({
    type: f.type,
    geometry: f.geometry,
    properties:
      appliesAt === null
        ? f.properties
        : {
            ...f.properties,
            extendedProperties: { cis_applicability: f.stub_applicability },
          },
  }));
  return new Response(
    JSON.stringify({
      type: zones.type,
      cis_version: zones.cis_version,
      cis_updated_at: zones.cis_updated_at,
      features,
    }),
    { status: 200, headers },
  );
}

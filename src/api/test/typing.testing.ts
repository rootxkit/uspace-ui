// Type-level proof that `createClient<paths>` is typed by the generated
// `paths` (WP-4): each `@ts-expect-error` line must be an error, or tsc
// reports the directive as unused, and each plain line must compile.
// Checked by types.test.ts with tsc after it generates ./generated/; never
// run.
import type { paths as AuthorityPaths } from "./generated/authority.js";
import type { paths } from "./generated/fixture.js";

import { createClient } from "../client.js";

const api = createClient<paths>({ baseUrl: "/_bff/api" });

export async function accepted(): Promise<number> {
  const zones = await api.GET("/v1/zones", {
    params: { query: { applies_at: "2026-10-02T10:00:00Z" } },
  });
  const version: number | undefined = zones.data?.cis_version;
  const note = await api.POST("/v1/zones/{identifier}/notes", {
    params: { path: { identifier: "GEO-TEST-0001" } },
    body: { text: "checked" },
  });
  const text: string | undefined = note.data?.text;
  await api.DELETE("/v1/notes/{id}", { params: { path: { id: "TEST1" } } });
  return (version ?? 0) + (text?.length ?? 0);
}

export async function refused(): Promise<void> {
  // @ts-expect-error a path the API does not have
  await api.GET("/v1/zone");
  // @ts-expect-error a method the path does not have
  await api.GET("/v1/zones/{identifier}/notes", {
    params: { path: { identifier: "GEO-TEST-0001" } },
  });
  await api.POST("/v1/zones/{identifier}/notes", {
    params: { path: { identifier: "GEO-TEST-0001" } },
    // @ts-expect-error a body that is not a NoteInput
    body: { txt: "checked" },
  });
  const zones = await api.GET("/v1/zones");
  // @ts-expect-error a field the response does not have
  void zones.data?.cis_versions;
}

// A real system file generates into a client that types its operations.
const authority = createClient<AuthorityPaths>({ baseUrl: "/_bff/api" });

export async function authorityPolicy(): Promise<void> {
  await authority.GET("/v1/policy");
  // @ts-expect-error the authority has no zones path
  await authority.GET("/v1/zones");
  // @ts-expect-error a PolicyInput without its required thresholds
  await authority.POST("/v1/policy", { body: {} });
}

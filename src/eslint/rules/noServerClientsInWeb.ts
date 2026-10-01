import type { Rule } from "eslint";

import { visitSources } from "./sources.js";

// Spec 00 §6: a web/ never holds a database or bus client; it reads its
// system's API and WebSocket (PLAN §6.2).
export const SERVER_CLIENTS: readonly string[] = [
  "pg",
  "postgres",
  "nats",
  "nats.ws",
  "ioredis",
  "redis",
  "drizzle-orm",
  "kysely",
  "knex",
  "mongodb",
];

export const SERVER_CLIENT_PREFIXES: readonly string[] = ["@prisma/"];

export function isServerClient(source: string): boolean {
  if (source.startsWith(".")) return false;
  if (SERVER_CLIENT_PREFIXES.some((p) => source.startsWith(p))) return true;
  return SERVER_CLIENTS.some(
    (name) => source === name || source.startsWith(`${name}/`),
  );
}

export const noServerClientsInWeb: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid database and bus clients in a web/ app (spec 00 §6, PLAN §6.2).",
    },
    schema: [],
    messages: {
      forbidden:
        "'{{source}}' is a database or bus client. A web/ reads its system's API and WebSocket, never the database or NATS.",
    },
  },
  create(context) {
    return visitSources((source, node) => {
      if (isServerClient(source)) {
        context.report({ node, messageId: "forbidden", data: { source } });
      }
    });
  },
};

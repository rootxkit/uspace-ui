import { noServerClientsInWeb } from "./noServerClientsInWeb.js";
import { ruleTester } from "./ruleTester.testing.js";

const err = (source: string) => ({ messageId: "forbidden", data: { source } });

ruleTester().run("no-server-clients-in-web", noServerClientsInWeb, {
  valid: [
    'import createClient from "openapi-fetch";',
    'import { NextResponse } from "next/server";',
    'import { pgTable } from "./pg-label";',
    'import { natsStatus } from "../status/nats";',
    'import x from "pgp-keys";',
  ],
  invalid: [
    { code: 'import { connect } from "nats";', errors: [err("nats")] },
    { code: 'import { connect } from "nats.ws";', errors: [err("nats.ws")] },
    { code: 'import { Pool } from "pg";', errors: [err("pg")] },
    { code: 'import postgres from "postgres";', errors: [err("postgres")] },
    { code: 'import Redis from "ioredis";', errors: [err("ioredis")] },
    { code: 'import { createClient } from "redis";', errors: [err("redis")] },
    {
      code: 'import { PrismaClient } from "@prisma/client";',
      errors: [err("@prisma/client")],
    },
    {
      code: 'import { drizzle } from "drizzle-orm/node-postgres";',
      errors: [err("drizzle-orm/node-postgres")],
    },
    { code: 'import { Kysely } from "kysely";', errors: [err("kysely")] },
    { code: 'import knex from "knex";', errors: [err("knex")] },
    {
      code: 'import { MongoClient } from "mongodb";',
      errors: [err("mongodb")],
    },
    { code: 'const { connect } = require("nats");', errors: [err("nats")] },
  ],
});

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { poolOptions } from './pool'
import * as schema from './schema'

// The pool's size and timeouts, and prepared statements off, are in pool.ts (DB_POOL_MAX). The URL is read at runtime; the placeholder carries no credential and only keeps the module
// importable during `next build`, where nothing queries the database.
const connectionString = process.env.DATABASE_URL ?? 'postgres://placeholder'

// One client across Next's hot reloads in development, so each reload does not open a new
// pool. In production each server instance keeps its own module-scoped client.
const globalForDb = globalThis as unknown as { __appPg?: ReturnType<typeof postgres> }
const client = globalForDb.__appPg ?? postgres(connectionString, poolOptions(process.env))
if (process.env.NODE_ENV !== 'production') globalForDb.__appPg = client

export const db = drizzle(client, { schema })
export { schema }

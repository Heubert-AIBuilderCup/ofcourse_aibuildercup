import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Prepared statements off: a pooled connection in transaction mode (Supabase, Neon) needs it.
// The URL is read at runtime; the placeholder carries no credential and only keeps the module
// importable during `next build`, where nothing queries the database.
const connectionString = process.env.DATABASE_URL ?? 'postgres://placeholder'

// One client across Next's hot reloads in development, so each reload does not open a new
// pool. In production each server instance keeps its own module-scoped client.
const globalForDb = globalThis as unknown as { __appPg?: ReturnType<typeof postgres> }
const client = globalForDb.__appPg ?? postgres(connectionString, { prepare: false })
if (process.env.NODE_ENV !== 'production') globalForDb.__appPg = client

export const db = drizzle(client, { schema })
export { schema }

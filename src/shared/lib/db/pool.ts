// The app's Postgres pool, sized for a small Cloud SQL tier: instances × max must stay under the
// database's connection limit (db-f1-micro has about 25), with room for the migrate and seed jobs.
// Idle connections close after 20 s, so an instance that went quiet gives its slots back.

const DEFAULT_MAX = 5
const MAX_LIMIT = 20

/** The pool size DB_POOL_MAX names, a whole number from 1 to 20; five when it is unset or anything else. */
function poolMax(value: string | undefined): number {
  const trimmed = value?.trim() ?? ''
  if (!/^\d+$/.test(trimmed)) return DEFAULT_MAX
  const max = Number(trimmed)
  return max >= 1 && max <= MAX_LIMIT ? max : DEFAULT_MAX
}

/** postgres.js options for the app's client, read from the environment. Pure. */
export function poolOptions(env: Record<string, string | undefined>) {
  return {
    // Prepared statements off: a pooled connection in transaction mode (Supabase, Neon) needs it.
    prepare: false,
    max: poolMax(env.DB_POOL_MAX),
    idle_timeout: 20,
    connect_timeout: 10,
  }
}

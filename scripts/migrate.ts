// Applies pending migrations before `bun run dev`. Same migrations folder and tracking table as
// `drizzle-kit migrate` (schema "drizzle", table "__drizzle_migrations"), but silences Postgres's
// "already exists, skipping" notices so every dev start does not print them.
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Add it to .env (see CLAUDE.md).')
  process.exit(1)
}

const client = postgres(url, { max: 1, onnotice: () => {} })
try {
  await migrate(drizzle(client), { migrationsFolder: './src/shared/lib/db/migrations' })
  console.log('✓ database migrated')
} catch (error) {
  console.error('✗ migration failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end()
}

import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/lib/db'
import { aiCache } from '@/shared/lib/db/schema'
import type { Cache } from './client'

/**
 * The ai_cache table: validated answers by key. The key hashes everything the answer depends on,
 * so an entry is never updated; a second writer of the same key is ignored. The caller checks a
 * value against its schema again before using it.
 */
export const dbCache: Cache = {
  async get(key) {
    const [row] = await db
      .select({ value: aiCache.value })
      .from(aiCache)
      .where(eq(aiCache.key, key))
      .limit(1)
    return row ? row.value : null
  },

  async put(key, row) {
    await db
      .insert(aiCache)
      .values({
        key,
        useCase: row.useCase,
        model: row.model,
        promptVersion: row.promptVersion,
        value: row.value,
      })
      .onConflictDoNothing()
  },
}

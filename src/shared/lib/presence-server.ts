import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/lib/db'
import { LAST_SEEN_THROTTLE_MS } from './presence'

const THROTTLE_SECONDS = LAST_SEEN_THROTTLE_MS / 1000

/**
 * Records a page load as the user's last seen time: one primary-key update, a no-op while the
 * stored time is fresher than LAST_SEEN_THROTTLE_MS. Call it from a layout with `after()`, so the
 * render never waits on it; the user id is the session's.
 */
export async function recordLastSeen(userId: string): Promise<void> {
  await db.execute(sql`
    update "user" set last_seen_at = now()
    where id = ${userId}
      and (last_seen_at is null
        or last_seen_at < now() - make_interval(secs => ${THROTTLE_SECONDS}))
  `)
}

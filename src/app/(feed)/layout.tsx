import { after } from 'next/server'
import { FeedHeader } from '@/features/content/components/feed/FeedHeader'
import { isStudent } from '@/shared/lib/auth/access'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { requireAppPage } from '@/shared/lib/auth/session'
import { recordLastSeen } from '@/shared/lib/presence-server'

/**
 * The feed: every signed-in account that is not suspended, students and staff alike (criterion 71,
 * ADR-121); the student app's layout would send staff to the admin. Phone-first, under a top bar:
 * a student's is the student app's header (Your roadmaps, the Feed, her menu), staff keep a slim
 * one back to the Board (FeedHeader). Each page sets its own frame; the feed itself
 * (`data-feed-shell`) is one screen tall, so the bar and the feed fill it and the page never
 * scrolls (its posts scroll inside it).
 */
export default async function FeedLayout({ children }: LayoutProps<'/'>) {
  const { user } = await requireAppPage(FEED_PATH)

  // Presence, after the response: one throttled primary-key update, a no-op when fresh.
  after(() => recordLastSeen(user.id))

  return (
    <div className="@container/feed flex min-h-dvh flex-col bg-background text-foreground has-[[data-feed-shell]]:h-dvh">
      <FeedHeader student={isStudent(user)} />
      <main className="flex min-h-0 w-full flex-1 flex-col">{children}</main>
    </div>
  )
}

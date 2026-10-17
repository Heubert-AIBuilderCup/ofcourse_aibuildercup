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
 * one back to the Board (FeedHeader).
 */
export default async function FeedLayout({ children }: LayoutProps<'/'>) {
  const { user } = await requireAppPage(FEED_PATH)

  // Presence, after the response: one throttled primary-key update, a no-op when fresh.
  after(() => recordLastSeen(user.id))

  return (
    <div className="@container flex min-h-dvh flex-col bg-background text-foreground">
      <FeedHeader student={isStudent(user)} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-gutter py-section">{children}</main>
    </div>
  )
}

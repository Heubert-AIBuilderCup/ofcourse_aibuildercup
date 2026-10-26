import { AdminPageHeader } from '@/features/admin'
import { IdeasQueue } from '@/features/content/components/IdeasQueue'
import { acceptIdeaAction, dismissIdeaAction } from '@/features/content/idea-actions'
import { IDEAS, queueRows } from '@/features/content/ideas-queue'
import { listIdeaDecisions } from '@/features/content/server/ideas-queue'
import { canEdit } from '@/shared/lib/auth/access'
import { requireBoard } from '@/shared/lib/auth/session'

/**
 * The Ideas queue (ADR-042): suggested topics and events, mock for the demo. Everyone who sees the
 * Board reads it; editors and superadmins accept or dismiss, and the actions check again.
 */
export default async function AdminIdeasPage() {
  const { user } = await requireBoard()
  const decisions = await listIdeaDecisions()
  return (
    <>
      <AdminPageHeader
        kicker="Queue"
        title="Ideas queue"
        lede="Topics to research, and workshops or services to offer, each with the evidence behind it. Suggestions never publish anything; dismissed ideas aren't suggested again."
      />
      <IdeasQueue
        rows={queueRows(IDEAS, decisions)}
        editable={canEdit(user)}
        accept={acceptIdeaAction}
        dismiss={dismissIdeaAction}
      />
    </>
  )
}

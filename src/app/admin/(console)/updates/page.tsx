import { MOCK_STUDENTS, MOCK_UPDATES } from '@/features/updates'
import {
  approveUpdateAction,
  createUpdateAction,
  sendUpdateToReviewAction,
} from '@/features/updates/actions'
import { UpdatesScreen } from '@/features/updates/components/UpdatesScreen'
import { listUpdates } from '@/features/updates/server/updates'
import { canEdit, canReview } from '@/shared/lib/auth/access'
import { requireBoard } from '@/shared/lib/auth/session'

const actions = {
  create: createUpdateAction,
  sendToReview: sendUpdateToReviewAction,
  approve: approveUpdateAction,
}

/**
 * Targeted updates: everyone who sees the Board reads them; editors write and send to review,
 * reviewers approve. The actions check again.
 */
export default async function AdminUpdatesPage() {
  const { user } = await requireBoard()
  const updates = await listUpdates()
  return (
    <UpdatesScreen
      updates={updates}
      mockUpdates={MOCK_UPDATES}
      students={MOCK_STUDENTS}
      canWrite={canEdit(user)}
      canApprove={canReview(user)}
      actions={actions}
    />
  )
}

import { assignPostAction } from '@/features/content/actions'
import { Board } from '@/features/content/components/Board'
import { boardView, parseBoardParams } from '@/features/content/lib/board'
import { listBoardStaff } from '@/features/content/server/assign'
import { listCards } from '@/features/content/server/store'
import { requireBoard } from '@/shared/lib/auth/session'

/** Every post and the stage it has reached. Editors, reviewers and admins; the layout checks too. */
export default async function AdminBoardPage({ searchParams }: PageProps<'/admin/board'>) {
  const { user } = await requireBoard()
  const [query, cards, staff] = await Promise.all([searchParams, listCards(), listBoardStaff()])
  const params = parseBoardParams(
    query,
    staff.map((s) => s.id),
  )
  // The board draws its own title beside its tabs (the design's header).
  return (
    <Board
      view={boardView(cards, params, user.id)}
      params={params}
      viewer={user}
      staff={staff}
      assign={assignPostAction}
    />
  )
}

import { redirect } from 'next/navigation'
import { AdminPageHeader } from '@/features/admin'
import { makeComicAction } from '@/features/content/comic-actions'
import { NewComicForm } from '@/features/content/components/NewComicForm'
import { EMOTIONS } from '@/features/content/emotions'
import { PATHS } from '@/features/content/lib/path-facts'
import { canEdit } from '@/shared/lib/auth/access'
import { BOARD_PATH } from '@/shared/lib/auth/gate'
import { requireBoard } from '@/shared/lib/auth/session'

/**
 * A new comic from a path in the catalogue (RC1): editors only; the action checks again.
 * `?path=<courseId>` preselects that path when the catalogue has it (the form ignores any other).
 */
export default async function NewComicPage({ searchParams }: PageProps<'/admin/comics/new'>) {
  const { user } = await requireBoard()
  if (!canEdit(user)) redirect(BOARD_PATH)
  const { path } = await searchParams
  return (
    <>
      <AdminPageHeader
        kicker="Route comics"
        title="New comic"
        lede="Choose a path. Gemini drafts a storyboard of three to six panels from its catalogue facts."
      />
      <NewComicForm
        paths={PATHS}
        emotions={EMOTIONS}
        path={typeof path === 'string' ? path : undefined}
        makeComicAction={makeComicAction}
      />
    </>
  )
}

import { redirect } from 'next/navigation'
import { AdminPageHeader } from '@/features/admin'
import { makePostAction, suggestSourcesAction } from '@/features/content/actions'
import { SourceForm } from '@/features/content/components/steps/SourceForm'
import { IDEA_IDS } from '@/features/content/ideas-queue'
import { parseIdeaStart } from '@/features/content/lib/idea-start'
import { canEdit } from '@/shared/lib/auth/access'
import { BOARD_PATH } from '@/shared/lib/auth/gate'
import { requireBoard } from '@/shared/lib/auth/session'

const actions = { makePostAction, suggestSourcesAction }

/**
 * A new feed post from a pasted source or a link, or with `?kind=blog` a new blog from the same
 * form (BR1): editors only; the action checks again. With `?idea=` it opens on "Start from an idea"
 * with the idea typed in (the Ideas queue's Accept, an evidence gap's "Research this").
 */
export default async function NewFeedPostPage({ searchParams }: PageProps<'/admin/posts/new'>) {
  const { user } = await requireBoard()
  if (!canEdit(user)) redirect(BOARD_PATH)
  const query = await searchParams
  const blog = query.kind === 'blog'
  const idea = parseIdeaStart(query, IDEA_IDS)
  return (
    <>
      {blog ? (
        <AdminPageHeader
          kicker="New blog"
          title="New blog"
          lede="Paste a source or give its link. Its facts come next, then angles for the blog to pick from."
        />
      ) : (
        <AdminPageHeader
          kicker="New feed post"
          title="New feed post"
          lede="Paste a source or give its link. Its facts come next, then the slides' text."
        />
      )}
      <SourceForm actions={actions} postKind={blog ? 'blog' : 'feed'} idea={idea} />
    </>
  )
}

import { notFound, redirect } from 'next/navigation'
import { aiConfig } from '@/features/content/ai/config'
import { DailyLimits } from '@/features/content/components/parts'
import { SocialWorkbench } from '@/features/content/components/SocialWorkbench'
import { exportName } from '@/features/content/layout/zip'
import { boardFrom } from '@/features/content/lib/board'
import { stepOf, stepPath, stepPost, withQuery } from '@/features/content/lib/steps'
import type { Body } from '@/features/content/model/artifacts'
import { postTitle } from '@/features/content/server/social'
import { failedSteps, runningSteps } from '@/features/content/server/steps'
import { loadPost } from '@/features/content/server/store'
import { requireBoard } from '@/shared/lib/auth/session'
import { workbenchActions as actions } from './workbench-actions'

/**
 * A post's address, for everyone who may see the Board. A feed post opens the step it is at, each
 * step its own screen (GD27), keeping the query it was opened with; a social version shows its
 * own workbench here. Each control and action checks again.
 */
export default async function AdminPostPage({
  params,
  searchParams,
}: PageProps<'/admin/posts/[id]'>) {
  const { user } = await requireBoard()
  const { id } = await params
  const query = await searchParams
  const [post, running, failed] = await Promise.all([
    loadPost(id),
    runningSteps(id),
    failedSteps(id),
  ])
  if (!post) notFound()

  if (post.kind !== 'social') {
    const at = stepPost({ ...post, running, failed })
    redirect(withQuery(stepPath(post.id, stepOf(at)), query))
  }

  // A social version: the feed post's facts, locked, and its own steps.
  const viewer = { role: user.role, editor: user.editor, reviewer: user.reviewer }
  const parentTitle = (post.parentId ? await postTitle(post.parentId) : null) ?? ''
  const brand = post.current.revision?.body.brand.name ?? ''
  const platform = post.pointers.social?.platform ?? 'instagram'
  // The recorded Instagram link counts while it names the export the post points at (ADR-124).
  const linkId = post.pointers.socialLinkId
  const linkRecord = linkId ? post.records.get(linkId) : undefined
  // Validated by putArtifact on the way in, and the database refuses any change.
  const link = linkRecord?.kind === 'social_link' ? (linkRecord.body as Body<'social_link'>) : null
  const socialLink =
    link && link.exportId === post.current.export?.id ? { url: link.url, by: link.by } : null
  // The image cap and who to email, so a "Limit" line says why and when (lib/limits.ts).
  const { caps, supportEmail } = aiConfig(process.env)
  return (
    <DailyLimits imageCap={caps.image} support={supportEmail}>
      <SocialWorkbench
        key={post.version}
        view={{
          id: post.id,
          title: post.title,
          stage: post.stage,
          version: post.version,
          pointers: post.pointers,
          current: post.current,
          running,
          failed,
          parentTitle,
          fileName: exportName(brand, parentTitle, platform),
          socialLink,
        }}
        viewer={viewer}
        from={boardFrom(query.from)}
        actions={actions}
      />
    </DailyLimits>
  )
}

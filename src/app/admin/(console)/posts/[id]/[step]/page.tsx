import { notFound, redirect } from 'next/navigation'
import { aiConfig } from '@/features/content/ai/config'
import { DailyLimits } from '@/features/content/components/parts'
import { Workbench } from '@/features/content/components/Workbench'
import { boardFrom } from '@/features/content/lib/board'
import { searchTitleOf } from '@/features/content/lib/comic-rules'
import {
  canOpen,
  isStepId,
  postPath,
  stepOf,
  stepPath,
  stepPost,
  withQuery,
} from '@/features/content/lib/steps'
import { characterOf } from '@/features/content/server/character'
import { earlierArt } from '@/features/content/server/commands'
import { pageStyles } from '@/features/content/server/page-style'
import { draftLayouts } from '@/features/content/server/preview'
import { failedNow, runningNow } from '@/features/content/server/steps'
import {
  blogChoices,
  linkedBlogOf,
  listHistory,
  listShares,
  listSlideArt,
  loadPost,
  postsOfBlog,
} from '@/features/content/server/store'
import { requireBoard } from '@/shared/lib/auth/session'
import { workbenchActions as actions } from '../workbench-actions'

/**
 * One step of a post's workbench, at its own address (GD27), for everyone who may see the Board;
 * each control and action checks again. An unknown step is not found; a step the post has not
 * reached opens the step it is at, and a social version its own workbench, with the query kept.
 */
export default async function AdminPostStepPage({
  params,
  searchParams,
}: PageProps<'/admin/posts/[id]/[step]'>) {
  const { user } = await requireBoard()
  const { id, step } = await params
  if (!isStepId(step)) notFound()
  const query = await searchParams
  // Each step's own records only: the history shows at the source, earlier art and a look's
  // earlier takes ("Swap image", GD13) at the images, the styled pages ("Make the set") and the
  // post's shares (criterion 10) at live.
  const [
    post,
    { running, progress },
    { failed, reasons, lite },
    arts,
    history,
    styles,
    slideArt,
    shares,
  ] = await Promise.all([
    loadPost(id),
    runningNow(id),
    failedNow(id),
    step === 'images' ? earlierArt(id) : [],
    step === 'source' ? listHistory(id) : [],
    step === 'live' ? pageStyles() : null,
    step === 'images' ? listSlideArt(id) : [],
    step === 'live' ? listShares(id) : [],
  ])
  if (!post) notFound()
  if (post.kind === 'social') redirect(withQuery(postPath(post.id), query))

  const at = stepPost({ ...post, running, failed })
  if (!canOpen(step, at)) {
    redirect(withQuery(stepPath(post.id, stepOf(at)), query))
  }

  // A feed post's links to a blog on its Blog step (BR8): the blog it is linked to and the
  // blogs it may be; a blog's posts at its images (their slides to embed, BR4) and live (BR6).
  // A comic's panels wait for the comic character (RC10), read at its images.
  const links = post.kind === 'feed' && step === 'blog'
  const own = post.kind === 'blog' && (step === 'images' || step === 'live')
  const panels = post.courseId !== null && step === 'images'
  const [linkedBlogId, blogs, blogPosts, character] = await Promise.all([
    links ? linkedBlogOf(post.id) : null,
    links ? blogChoices() : [],
    own ? postsOfBlog(post.id) : [],
    panels ? characterOf() : null,
  ])

  const viewer = { role: user.role, editor: user.editor, reviewer: user.reviewer }
  const { pointers, current } = post
  const facts = pointers.factsId ? post.records.get(pointers.factsId) : undefined
  const { checks: draftChecks, shifts: draftShifts } =
    current.drafts && current.facts && current.source
      ? draftLayouts(
          current.drafts.body,
          pointers.themeId,
          current.facts.body.facts,
          current.source.body.title,
          searchTitleOf(post, current.source.body.title),
          current.source.body.language,
        )
      : { checks: [], shifts: [] }

  // The image cap and SUPPORT_EMAIL, read at request time (not NEXT_PUBLIC), so the "Limit" line
  // says how many, when it resets and who to email (lib/limits.ts).
  const { caps, supportEmail } = aiConfig(process.env)

  return (
    <DailyLimits imageCap={caps.image} support={supportEmail}>
      <Workbench
        view={{
          id: post.id,
          kind: post.kind,
          courseId: post.courseId,
          title: post.title,
          stage: post.stage,
          version: post.version,
          pointers,
          current,
          createdAt: facts?.createdAt ?? '',
          running,
          progress,
          failed,
          failedReasons: reasons,
          lite,
          draftChecks,
          draftShifts,
          earlierArt: arts,
          slideArt,
          history,
          styledPages: styles ? [...styles.keys()] : [],
          publishedApprovalId: post.publishedApprovalId,
          linkedBlogId: linkedBlogId ?? null,
          blogs,
          blogPosts,
          characterApproved: Boolean(character?.approvedAssetId),
          shares,
        }}
        viewer={viewer}
        from={boardFrom(query.from)}
        actions={actions}
        step={step}
      />
    </DailyLimits>
  )
}

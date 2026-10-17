'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { Note } from '@/shared/components/Note'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import type { Staff } from '@/shared/lib/auth/access'
import { boardBackHref } from '../lib/board'
import type { FailureReason } from '../lib/failure'
import { CHANGED_LINE } from '../lib/lines'
import { liteLine, type StepProgress } from '../lib/running'
import { canOpen, type StepId, stepOfStage, stepPath, stepPost, stepsFor } from '../lib/steps'
import { actionError, changedSincePublished } from '../lib/workflow'
import type { Body, Pointers } from '../model/artifacts'
import type { CurrentPost } from '../model/current'
import type { Stage } from '../model/stages'
import type { FitCheck, SlideArt } from '../model/types'
import type { ArtChoice } from '../server/commands'
import type { HistoryEntry } from '../server/store'
import { isLook } from '../templates'
import { HistoryPanel } from './HistoryPanel'
import {
  ChangesNote,
  Move,
  movesWait,
  RenderedSlides,
  reasonText,
  StepAction,
  StepAreas,
  StepBack,
  StepBar,
  tag,
} from './parts'
import { StageRail } from './StageRail'
import type { SlideHold, TabHold } from './stage'
import { BlogPosts, PostBlogLinks } from './steps/BlogLinks'
import { BlogPreview, BlogTextStep } from './steps/BlogTextStep'
import { IdeasStep } from './steps/IdeasStep'
import { BlogImagesStep, ImagesStep } from './steps/ImagesStep'
import { LivePanel } from './steps/LivePanel'
import { BlogOutlineStep, OutlineStep } from './steps/OutlineStep'
import { MarketControls, PostPreview, useShownMarket } from './steps/PostPreview'
import { RenderStep } from './steps/RenderStep'
import { ReviewPanel } from './steps/ReviewPanel'
import { SettingsForm } from './steps/SettingsForm'
import { SourceCheckPanel } from './steps/SourceCheckPanel'
import { SourcePane } from './steps/SourcePane'
import { StoryboardStep } from './steps/StoryboardStep'
import { StructuresStep } from './steps/StructuresStep'
import { usePostAction } from './usePostAction'
import { useRefreshWhileRunning } from './useRefreshWhileRunning'

/** Every post action but the ones that start a post, the board's assignment, and a comic's storyboard's; the page passes them by name. */
export type WorkbenchActions = Omit<
  typeof import('../actions'),
  'makePostAction' | 'suggestSourcesAction' | 'assignPostAction'
> &
  Omit<
    typeof import('../comic-actions'),
    | 'makeComicAction'
    | 'planCharacterAction'
    | 'editCharacterViewAction'
    | 'drawCharacterAction'
    | 'approveCharacterAction'
  >

export type WorkbenchView = {
  id: string
  title: string
  stage: Stage
  version: number
  pointers: Pointers
  current: CurrentPost
  /** When the facts were checked: the facts record's createdAt (each FactChip's date). */
  createdAt: string
  /** The steps running on this post now (server/steps.ts runningNow). */
  running: string[]
  /** How far each running step that records its progress is (server/steps.ts runningNow): "Drawing image 2 of 4". */
  progress?: Record<string, StepProgress>
  /** The steps whose last run failed (server/steps.ts failedSteps), e.g. the source check. */
  failed?: string[]
  /** Why each failed step failed, by step (server/steps.ts failedNow): the sentence after its line. */
  failedReasons?: Record<string, FailureReason>
  /** The steps whose last run finished on Flash-Lite because Flash and Pro were busy (server/steps.ts failedNow). */
  lite?: string[]
  /** Per draft, the fit checks with the chosen theme (Task 17 draftFitChecks). */
  draftChecks: FitCheck[][]
  /**
   * Per draft, how far each slide's text moved down (LaidSlide `shift`, Postcard's card), 0 where
   * it did not: the slot hotspots move with it. None reads as no move.
   */
  draftShifts?: number[][]
  /** Generated art from the post's earlier renders, for "Swap image" (Task 24 earlierArt). */
  earlierArt?: ArtChoice[]
  /** A look post's images from its renders, newest first, for "Swap image" to an earlier take (server/store.ts listSlideArt, GD13). */
  slideArt?: SlideArt[]
  /** The post's saved text versions, newest first (server/store.ts listHistory, criterion 101). */
  history?: HistoryEntry[]
  /** The page brands with a design language (server/page-style.ts pageStyles): "Make the set" makes a version for each (criterion 108). */
  styledPages?: string[]
  /** The approval students see (content_post.published_approval_id), or none before the first publish (criteria 116, 119). */
  publishedApprovalId?: string | null
  /** A feed post, a social version or a blog (BR1); a view without one is a feed post's. */
  kind?: 'feed' | 'social' | 'blog'
  /** The catalogue path a comic tells (RC2); none on any other post. */
  courseId?: string | null
  /** Whether the Comics page's character is approved (RC10), read at a comic's images; a comic's panels wait for it. */
  characterApproved?: boolean
  /** A feed post's blog (BR8), or none, on its Blog step (server/store.ts linkedBlogOf). */
  linkedBlogId?: string | null
  /** The blogs a feed post may be linked to (BR8), on its Blog step (server/store.ts blogChoices). */
  blogs?: { id: string; title: string }[]
  /** A blog's linked posts (BR4, BR6), at its images and live (server/store.ts postsOfBlog). */
  blogPosts?: { id: string; title: string; live: boolean }[]
  /** A live feed post's shares to the pages' accounts, newest first (server/store.ts listShares, criterion 10). */
  shares?: { id: string; body: Body<'share'> }[]
}

export type WorkbenchProps = {
  view: WorkbenchView
  viewer: Staff
  /** The board's filters it was opened from, as lib/board.ts boardFrom keeps them. */
  from: string
  /** A plain object of server actions the page imports by name (as src/app/admin/(console)/users/[id]/page.tsx builds one). */
  actions: WorkbenchActions
  /** The step whose screen this is (GD27); the page has checked the post has reached it. */
  step: StepId
  /**
   * The tab the address names (`?tab=Checks`), open first on this step, as "Fix it on Text ·
   * Checks" asks; a name no tab has opens none.
   */
  openTab?: string
}

/** A look post (GD4) has its own images step; a post from before keeps the render and covers (GD8). */
const lookPost = (view: WorkbenchView) => {
  const template = view.current.revision?.body.template
  return template !== undefined && isLook(template)
}

/**
 * One step's screen (GD27): the source with its facts and history, the idea cards, the outline, the text
 * versions, the images, the settings (the post with its market version and its preview in context,
 * the source check, the feed settings and "Send to review"),
 * the review or the live post, each as two areas: the slides or the article, and their actions
 * (GD30). Each control asks the workflow rules for this stage, so a passed step shows editable to
 * an editor, an edit there moving the post back by itself (GD28), and
 * read-only to a viewer who may not edit; the current step shows with its controls. Each screen is keyed by version, so its local choices start again from what was
 * saved after every change. "Back to ideas" and "Back to versions" open the other screen.
 */
/**
 * The settings (as a post editor's are): the post on the left, the selected slide over a filmstrip
 * or the article, and on the right one panel at a time, the source check, the feed settings and the
 * market versions, whose switch says which version the preview shows.
 */
function SettingsScreen({
  view,
  viewer,
  actions,
  tab,
  article,
}: Omit<WorkbenchProps, 'from' | 'step'> & { tab: TabHold; article: ReactNode }) {
  const router = useRouter()
  const props = { view, viewer, actions }
  const [shown, onShow] = useShownMarket(view.current.market)
  const pictured = !article && view.current.render !== null
  return (
    <>
      <StepBack>
        <Button variant="outline" onClick={() => router.push(stepPath(view.id, 'images'))}>
          ← Images
        </Button>
      </StepBack>
      <StepAreas
        slides={article ?? <PostPreview view={view} shown={shown} />}
        actions={
          <SettingsForm
            {...props}
            tab={tab}
            check={<SourceCheckPanel {...props} />}
            market={
              pictured ? <MarketControls {...props} shown={shown} onShow={onShow} /> : undefined
            }
          />
        }
      />
    </>
  )
}

function Screen({
  view,
  viewer,
  actions,
  step,
  slide,
  tab,
  passed,
  from,
}: WorkbenchProps & {
  slide: SlideHold
  /** This step's open tab by its name (Settings', Text's), held above the screen's version key. */
  tab: TabHold
  /** A passed step, whose way on is "Continue at" the current one: its own "Next" is outlined. */
  passed: boolean
}) {
  const router = useRouter()
  const props = { view, viewer, actions }
  const k = `${step}-${view.version}`
  const open = (to: StepId) => router.push(stepPath(view.id, to))
  // The step the post is at now, so a passed screen does not offer two ways to the same place.
  const atStep = stepsFor(stepPost(view)).find((s) => s.state === 'current')?.id
  // A blog's outline, text and images are its own (BR2–BR4); its settings, review and live are a
  // post's with its article in place of the slides, and its posts at live (BR6). A feed post makes
  // or links its blog on its last step, Blog, which opens once it is live (BR8).
  const blog = view.kind === 'blog'
  const article = blog ? <BlogPreview view={view} /> : undefined
  const links = blog ? <BlogPosts {...props} /> : undefined
  // A live feed post is finished at Live: its blog is optional, offered beside the way back.
  const done = (words: string) => (
    <Link href={boardBackHref(from)} className={buttonVariants()}>
      {words}
    </Link>
  )
  const nextBlog = !blog && canOpen('blog', stepPost(view)) && (
    <StepAction>
      <Link href={stepPath(view.id, 'blog')} className={buttonVariants({ variant: 'outline' })}>
        Add a blog (optional) →
      </Link>
      {done('Done · back to the board')}
    </StepAction>
  )
  switch (step) {
    case 'source':
      return (
        <StepAreas
          key={k}
          slides={
            <aside aria-label="Source" className="min-w-0">
              <SourcePane {...props} />
            </aside>
          }
          actions={<HistoryPanel {...props} />}
        />
      )
    case 'ideas':
      return (
        <IdeasStep
          key={k}
          {...props}
          onBack={view.current.drafts ? () => open('text') : undefined}
        />
      )
    case 'outline':
      return blog ? <BlogOutlineStep key={k} {...props} /> : <OutlineStep key={k} {...props} />
    case 'text':
      if (blog) return <BlogTextStep key={k} {...props} />
      // A comic's text is its storyboard (RC2, RC3).
      if (view.courseId) return <StoryboardStep key={k} {...props} slide={slide} />
      return (
        <StructuresStep
          key={k}
          {...props}
          slide={slide}
          tab={tab}
          onBackToIdeas={() => open('ideas')}
        />
      )
    case 'images':
      return (
        <div key={k} className="flex min-w-0 flex-col gap-section">
          {blog ? (
            <BlogImagesStep {...props} />
          ) : lookPost(view) ? (
            <ImagesStep {...props} slide={slide} tab={tab} />
          ) : (
            <RenderStep {...props} slide={slide} tab={tab} />
          )}
          {/* Once the pictures are drawn, the settings open (GD25); when the post is already there,
              "Continue at Settings" is the one way on. */}
          {canOpen('settings', stepPost(view)) && !(passed && atStep === 'settings') && (
            <StepAction>
              <Button variant={passed ? 'outline' : 'default'} onClick={() => open('settings')}>
                Next: Settings →
              </Button>
            </StepAction>
          )}
        </div>
      )
    case 'settings':
      return <SettingsScreen key={k} {...props} tab={tab} article={article} />
    case 'review':
      return <ReviewPanel key={k} {...props} article={article} slide={slide} tab={tab} />
    case 'live':
      return (
        <>
          <LivePanel key={k} {...props} article={article} links={links} tab={tab} />
          {nextBlog}
        </>
      )
    case 'blog': {
      const { render, layout } = view.current
      return (
        <StepAreas
          key={k}
          slides={
            render && <RenderedSlides render={render.body} layout={layout?.body.slides} stage />
          }
          actions={
            <>
              <PostBlogLinks {...props} />
              <StepAction>{done('Skip the blog · back to the board')}</StepAction>
            </>
          }
        />
      )
    }
  }
}

/**
 * Whether a request for changes shows at the top (criterion 120): when it names no step, as one
 * from before steps were named, or a step this screen does not show. Otherwise it shows beside
 * the step it names, which shows it itself: the text versions, the covers of a post from before
 * the looks, or the feed settings.
 */
function changesOnTop(view: WorkbenchView, step: StepId): boolean {
  const named = view.current.sendBack?.body.step
  if (named === undefined) return false
  if (named === 'structures') return step !== 'text'
  if (named === 'covers') return step !== 'images' || lookPost(view)
  if (named === 'settings') return step !== 'settings'
  return true
}

/**
 * "Changed" with its sentence on a published post being worked on again, and "Discard changes",
 * which asks first and waits while a step runs, then opens the live post (criteria 119, 122).
 */
function Published({ view, viewer, actions }: Omit<WorkbenchProps, 'from' | 'step'>) {
  const { pending, run } = usePostAction()
  const router = useRouter()
  if (!changedSincePublished(view.stage, view.publishedApprovalId ?? null)) return null
  return (
    <div className="flex flex-wrap items-start gap-3">
      <span className={tag}>Changed</span>
      <span className={reasonText}>{CHANGED_LINE}</span>
      {actionError('discardChanges', viewer, view.stage) === null && (
        <Move
          label="Discard changes"
          waiting={movesWait(view.running)}
          pending={pending}
          confirm={{
            question: 'Discard your changes?',
            body: (
              <p className="text-caption">
                Students keep seeing the live version; your changes stay in the history.
              </p>
            ),
            go: 'Discard changes',
          }}
          onGo={() =>
            run(
              () => actions.discardChangesAction(view.id, view.version),
              'Changes discarded · back to the live version',
              () => router.push(stepPath(view.id, stepOfStage('live', false))),
            )
          }
        />
      )}
    </div>
  )
}

/**
 * One post, one step at a time (GD27): "← Board" with the filter it came from and the title on one
 * line, the numbered step bar that opens each done or current step, then that step's screen. Every control
 * asks the workflow rules; each action checks again on the server.
 */
export function Workbench({ view, viewer, from, actions, step, openTab }: WorkbenchProps) {
  useRefreshWhileRunning(view.running.length > 0)
  const { sendBack } = view.current
  // The picked version's selected slide, above the screen's version key, so it survives a save
  // (GD24); the version's slide count clamps it where it is shown.
  const [selected, onSelect] = useState(1)
  // Each step's open tab by its name, above the version key too, so a save keeps the editor on
  // the tab she was on; none until she opens or works in one, or the address names one.
  const [tabs, setTabs] = useState<Partial<Record<StepId, string>>>(() =>
    openTab ? { [step]: openTab } : {},
  )
  const tab: TabHold = {
    open: tabs[step] ?? null,
    onOpen: (name) => setTabs((held) => ({ ...held, [step]: name })),
  }
  const steps = stepsFor(stepPost(view))
  const current = steps.find((s) => s.state === 'current')
  const passed = steps.find((s) => s.id === step)?.state === 'done'
  // This screen's steps whose last run finished on Flash-Lite, Flash and Pro being busy.
  const lite = liteLine(view.lite, view.running, step)

  return (
    <div className="workbench @container flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3">
        {/* One line, as a breadcrumb: the title truncates, its full text on hover. */}
        <div className="flex min-w-0 items-baseline gap-2">
          <Link
            href={boardBackHref(from)}
            className="shrink-0 text-caption text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Board
          </Link>
          <span aria-hidden="true" className="text-caption text-muted-foreground">
            /
          </span>
          {/* The bar's current step says where the post is (GD25): no stage or gate badge beside it. */}
          <h1 title={view.title} className="min-w-0 truncate text-h3">
            {view.title}
          </h1>
        </div>
        <StageRail postId={view.id} steps={steps} open={step} from={from} />
        {lite && <Note tone="hint">{lite}</Note>}
        <Published view={view} viewer={viewer} actions={actions} />
        {sendBack && changesOnTop(view, step) && <ChangesNote sendBack={sendBack.body} />}
      </div>

      <StepBar>
        <Screen
          view={view}
          viewer={viewer}
          actions={actions}
          step={step}
          slide={{ selected, onSelect }}
          tab={tab}
          passed={passed}
          from={from}
        />
        {/* From a passed step, the way on is to the step the post is at. */}
        {passed && current && (
          <StepAction>
            <Link href={stepPath(view.id, current.id)} className={buttonVariants()}>
              Continue at {current.label} →
            </Link>
          </StepAction>
        )}
      </StepBar>
    </div>
  )
}

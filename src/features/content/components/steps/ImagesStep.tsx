'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Textarea } from '@/shared/components/ui/textarea'
import { Spin, Working } from '@/shared/components/Working'
import type { Staff } from '@/shared/lib/auth/access'
import { failureSentence } from '../../lib/failure'
import {
  ACTION_STAGES,
  actionError,
  editWaitError,
  type PostAction,
  renderError,
  WORKFLOW_ERRORS,
} from '../../lib/workflow'
import type { BlogTarget, Slide, SlideArt } from '../../model/types'
import { IMAGE_NUDGES, imageNudge } from '../../nudges'
import type { LightEdit } from '../../server/commands'
import { imagesFor } from '../../templates'
import { EditableSlidePreview } from '../EditableSlidePreview'
import {
  Control,
  DownloadSlides,
  FALLBACK_LABELS,
  FailedLine,
  FitFailures,
  Move,
  movesWait,
  ReorderButtons,
  reasonText,
  StepAreas,
  tag,
  useImageLimitLine,
} from '../parts'
import { SlidePreview, slideWords } from '../SlidePreview'
import {
  type ActionTab,
  type SlideHold,
  SlideStage,
  StepTabs,
  type TabHold,
  useHolds,
} from '../stage'
import { usePressedAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'

/** A selection kept inside the slides there are, the first when there are none. */
const inRange = (at: number, count: number) => Math.max(0, Math.min(at, count - 1))

/** The tabs of the images step: the selected slide's picture, the plan and the drawing, the order. */
const THIS_SLIDE = 'This slide'
const THIS_PICTURE = 'This picture'
const PLAN_TAB = 'Plan'
const ORDER_TAB = 'Order'
const EMBED_TAB = 'Embed'

/** The Plan tab's count of the pictures a finished run left to draw, when there are any. */
const leftBadge = (left: number) =>
  left > 0 ? { text: String(left), label: `${left} left to draw` } : undefined

/** A thumbnail's loader while its picture is drawn: the stage's own says so in words. */
const thumbWaiting = 'absolute inset-0 bg-background/60 motion-safe:animate-pulse'

export type ImagesStepProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<
    WorkbenchActions,
    | 'planImagesAction'
    | 'editImageSceneAction'
    | 'drawImagesAction'
    | 'skipPicturesAction'
    | 'nudgeImageAction'
    | 'lightEditAction'
  >
  /** The selected slide, held above the screen's version key (Workbench), so a save keeps it (GD24). */
  slide?: SlideHold
  /** The open tab beside the slides, held there too. */
  tab?: TabHold
}

/** The steps this screen runs as (server/commands/images.ts): the plan in words, then the drawing. */
const PLAN_STEP = 'scene_plan'
const DRAW_STEP = 'images'
const PLAN_FAILED = 'Planning failed. Your text is kept.'
const DRAW_FAILED = 'Drawing failed. Your plan is kept.'
/** What a press says while it runs, before the polled step names it. */
const PLANNING = 'Planning the images…'
const REDRAWING = 'Drawing this picture · about half a minute'
const SAVING = 'Saving the slides…'
/** "Skip pictures": the slides saved as the editor sees them, without drawing (server/commands/images.ts). */
const SKIP = 'Skip pictures · use the text slides'
const SKIP_LINE = 'Each slide is saved as it looks now, without a picture.'

/** A press a control waits on: the plan, one slide's picture drawn again (with its chip, or none), the skip. */
type Press =
  | { kind: 'plan' }
  | { kind: 'redraw'; slide: number; chip: string | null }
  | { kind: 'skip' }

/**
 * What the press running (usePressedAction's `current`) means to the controls, so only that
 * control waits as "Running…" and only the slide being drawn again pulses.
 */
const pressesOf = (current: Press | null) => ({
  planning: current?.kind === 'plan',
  redrawing: current?.kind === 'redraw' ? current : null,
  skipping: current?.kind === 'skip',
})

/** Where the Comics page's character is planned, drawn and approved (RC9). */
const CHARACTER_PATH = '/admin/comics/character'

const imagesLabel = (n: number) => `${n} ${n === 1 ? 'image' : 'images'}`

/** "Take 2 · Closer": which take an image is, and the chip that made it. */
const takeLabel = (art: SlideArt) => {
  const chip = art.nudge ? imageNudge(art.nudge) : null
  return chip ? `Take ${art.take} · ${chip.label}` : `Take ${art.take}`
}

/**
 * Why a planned slide shows no image: not reached yet, saved text only on purpose ("Skip
 * pictures"), the day's limit, or could not be drawn.
 */
function missingLabel(art: SlideArt | undefined): string {
  if (!art) return 'Not drawn yet'
  if (art.fallback === 'skipped') return 'Text only'
  return art.fallback === 'daily_limit' ? FALLBACK_LABELS.daily_limit : 'Could not draw'
}

/** Why a picture could not be drawn, when its last call said (busy or too slow); null otherwise. */
const failedWhy = (art: SlideArt | undefined): string | null =>
  art?.fallback === 'no_art' ? failureSentence(art.reason) : null

/** A slide's earlier takes from the post's renders, newest first, each image once, without the one in use. */
function earlierTakes(all: readonly SlideArt[], slide: number, inUse: string | null): SlideArt[] {
  const seen = new Set(inUse ? [inUse] : [])
  return all.filter((a) => {
    if (a.slide !== slide || a.assetId === null || seen.has(a.assetId)) return false
    seen.add(a.assetId)
    return true
  })
}

type DrawnControlsProps = {
  art: SlideArt
  /** The slide's planned scene now, which the editor may have changed since the image was drawn. */
  scene: string | undefined
  earlier: SlideArt[]
  busy: boolean
  /** This slide's picture is being drawn again: with the chip pressed, or null for none; undefined when it is not. */
  redrawing: string | null | undefined
  /** Null when the viewer may not nudge or swap here: only the take shows. A null chip draws the scene again as it is. */
  nudge: ((chip: string | null, done: string) => void) | null
  swap: ((art: SlideArt) => void) | null
  /** Saves the slide's planned scene; null when the viewer may not edit it here. */
  editScene: ((text: string) => void) | null
}

/**
 * Under a drawn image (GD13): its take, the image chips with "New picture" (the same scene drawn
 * again), "Edit scene", then "Draw this one" in place of "New picture" once the scene differs from
 * the one the image was drawn from, and "Swap image" to an earlier take. None touches the text.
 */
function DrawnControls({
  art,
  scene,
  earlier,
  busy,
  redrawing,
  nudge,
  swap,
  editScene,
}: DrawnControlsProps) {
  const [swapping, setSwapping] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(scene ?? '')
  const changed = scene !== undefined && scene !== art.scene
  const save = () => {
    if (editScene && scene !== undefined && text.trim() !== scene.trim()) editScene(text)
    setEditing(false)
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground">{takeLabel(art)}</p>
      {nudge && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">{`Draw slide ${art.slide} again`}</legend>
          {IMAGE_NUDGES.map((chip) => (
            <Button
              key={chip.id}
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => nudge(chip.id, `${chip.label} · slide ${art.slide} drawn again`)}
            >
              {redrawing === chip.id && <Spin />}
              {chip.label}
            </Button>
          ))}
          <Button
            variant={changed ? 'default' : 'outline'}
            size="sm"
            disabled={busy}
            onClick={() =>
              nudge(
                null,
                changed
                  ? `Slide ${art.slide} drawn from its new scene`
                  : `New picture · slide ${art.slide}`,
              )
            }
          >
            {redrawing === null && <Spin />}
            {changed ? 'Draw this one' : 'New picture'}
          </Button>
        </fieldset>
      )}
      {redrawing !== undefined && <Working words={REDRAWING} />}
      {editScene && scene !== undefined && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            aria-expanded={editing}
            disabled={busy}
            onClick={() => {
              setText(scene)
              setEditing(!editing)
            }}
          >
            Edit scene
          </Button>
          {editing && (
            <div className="flex flex-col gap-2">
              <Textarea
                aria-label={`Scene for slide ${art.slide}`}
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={save}>
                  Save scene
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {swap && earlier.length > 0 && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            aria-expanded={swapping}
            onClick={() => setSwapping(!swapping)}
          >
            Swap image
          </Button>
          {swapping && (
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">Swap image</legend>
              {earlier.map((a) => (
                <Button
                  key={a.assetId}
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => swap(a)}
                >
                  {takeLabel(a)}
                </Button>
              ))}
            </fieldset>
          )}
        </>
      )}
    </div>
  )
}

type SlideOrderProps = {
  slides: readonly Slide[]
  /** Each slide's words, for its line in the list. */
  words: (n: number) => string
  busy: boolean
  /** Moves body slide `from` to `to`, both counted among the body slides from 1. */
  move: (from: number, to: number) => void
}

/**
 * The post's slides in order, each body slide with "Move slide n up" and "down" (criterion 40):
 * its picture goes with it, and the cover and the takeaway never move. Phrases are a look's slots,
 * edited on Text.
 */
function SlideOrder({ slides, words, busy, move }: SlideOrderProps) {
  const bodies = slides.filter((s) => s.kind === 'body').length
  let at = 0
  return (
    <ol aria-label="Slide order" className="flex max-w-prose flex-col gap-1">
      {slides.map((slide, i) => {
        const n = i + 1
        const body = slide.kind === 'body'
        if (body) at += 1
        const here = at
        return (
          <li key={n} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-caption">
              {[`Slide ${n}`, words(n)].filter(Boolean).join(' · ')}
            </span>
            {body && (
              <ReorderButtons
                name={`slide ${n}`}
                up={{ disabled: busy || here <= 1, onClick: () => move(here, here - 1) }}
                down={{ disabled: busy || here >= bodies, onClick: () => move(here, here + 1) }}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Why a comic's panels wait (RC10), as the way to its character. */
function CharacterFirst() {
  return (
    <Link href={CHARACTER_PATH} className={`${reasonText} underline underline-offset-4`}>
      Approve the comic character first
    </Link>
  )
}

/**
 * The images step of a look post (GD12–GD14). "Plan images" writes a scene in words for each art
 * box; each art-box slide then shows its scene in the art area, edited in place. "Draw images"
 * names how many it draws; they are drawn in the background, each slide showing its image as it
 * lands while the step says so (the workbench refreshes while a step runs). Once drawn, each
 * image's slide has, in the actions area beside the pictures (GD30), the image chips, "New
 * picture", "Edit scene" then "Draw this one", and "Swap image" to an earlier take, none of which touches the text; a slide left without one says why, and "Draw remaining" draws it,
 * and any slide whose scene changed since. The scenes are planned by themselves once the text is
 * approved; "Plan again" asks the model anew, after a confirm when a scene is in the editor's own
 * words. Once drawn, the slide order moves a body slide up or down with its picture (criterion 40).
 * There is no "Back to text": an edit on Text moves the post back by itself (GD28). Every control
 * asks the workflow rules for this stage, so in review or live only the scenes are edited, which
 * moves the post back to its images (GD28). A comic's images are its panels (RC10): "Draw panels"
 * and "Draw remaining panels" wait, with the way to it, until the comic character is approved.
 * The slides sit on a stage, the selected one over the filmstrip with its loader and why it has no
 * picture; beside it, once drawn, the tabs "This slide", "Plan" (counting what is left to draw) and
 * "Order", so the step fits the screen without the page scrolling.
 */
export function ImagesStep({ view, viewer, actions, slide, tab: heldTab }: ImagesStepProps) {
  const { pending, run, current } = usePressedAction<Press>()
  const { planning: planPressed, redrawing, skipping } = pressesOf(current)
  const limitLine = useImageLimitLine()
  const ids = useId()
  // The selected slide and the open tab, the workbench's when it passes them (GD24).
  const { at: selected, onSelect: setSelected, tab } = useHolds(slide, heldTab)
  const { revision, layout, artPlan, render } = view.current
  const planning = view.running.includes(PLAN_STEP)
  const drawing = view.running.includes(DRAW_STEP)
  const busy = pending || planning || drawing
  // A background plan or drawing that failed says so where its loader was, with why.
  const planFailed = !planning && !planPressed && (view.failed?.includes(PLAN_STEP) ?? false)
  const drawFailed = !drawing && !redrawing && (view.failed?.includes(DRAW_STEP) ?? false)

  const gate = (action: PostAction) => actionError(action, viewer, view.stage)
  /** A control shows where its action may run and the viewer may run it, with its reason when it may not yet. */
  const offered = (action: PostAction) =>
    ACTION_STAGES[action].includes(view.stage) && gate(action) !== WORKFLOW_ERRORS.notAuthorised

  // The rendered post's images; at `approved` any render on record is not this text's.
  const drawn = view.stage === 'approved' ? null : (render?.body.slideArt ?? null)
  const sceneOf = (slide: number) => artPlan?.body.scenes.find((s) => s.slide === slide)?.scene
  const slides = artPlan?.body.scenes.map((s) => s.slide) ?? drawn?.map((a) => a.slide) ?? []
  const artOf = (slide: number) => drawn?.find((a) => a.slide === slide)
  // A slide a finished run left to draw: no image (could not draw, the day's limit, not reached),
  // or a scene edited since its image was drawn. While a run goes on, its slides are on their way.
  const left = drawing
    ? 0
    : slides.filter((n) => {
        const art = artOf(n)
        const scene = sceneOf(n)
        return !art?.assetId || (scene !== undefined && art.scene !== scene)
      }).length
  const remaining = left > 0
  const count = revision ? imagesFor(revision.body.template, revision.body.structure) : 0

  // In review or live a scene edit moves the post back, so it waits while any step runs (criterion 122).
  const sceneWait = editWaitError(
    'editImageScene',
    viewer,
    view.stage,
    movesWait(view.running, view.progress),
  )
  const editScene = gate('editImageScene') === null && !busy && sceneWait === null
  const saveScene = (slide: number, text: string) =>
    run(
      () => actions.editImageSceneAction(view.id, view.version, { slide, text }),
      `Scene saved · slide ${slide}`,
    )
  const nudge =
    gate('nudgeImage') === null
      ? (slide: number) => (chip: string | null, done: string) =>
          run(() => actions.nudgeImageAction(view.id, view.version, { slide, nudge: chip }), done, {
            press: { kind: 'redraw', slide, chip },
          })
      : null
  const swap =
    gate('lightEdit') === null
      ? (slide: number) => (art: SlideArt) => {
          if (!art.assetId) return
          const edit: LightEdit = { kind: 'swapImage', slide, image: { assetId: art.assetId } }
          run(() => actions.lightEditAction(view.id, view.version, edit), 'Image swapped')
        }
      : null
  const reorder =
    gate('lightEdit') === null
      ? (from: number, to: number) =>
          run(
            () => actions.lightEditAction(view.id, view.version, { kind: 'reorder', from, to }),
            'Slides reordered',
          )
      : null
  const draw = (done: string) => run(() => actions.drawImagesAction(view.id, view.version), done)
  /** While the images are drawn, the draw buttons wait with the step in words beside them. */
  const drawingReason = drawing ? movesWait([DRAW_STEP]) : null

  // A drawing that stopped before it reached every planned slide (a restart or a crash; a slide it
  // reached always has an entry, drawn or not) goes on by itself when the screen opens, once.
  const unreached = drawn !== null && artPlan !== null && slides.some((n) => !artOf(n))
  const resume = unreached && !planning && !drawing && gate('drawImages') === null
  const resumed = useRef(false)
  useEffect(() => {
    if (!resume || resumed.current) return
    resumed.current = true
    run(() => actions.drawImagesAction(view.id, view.version), 'Drawing the rest of the images')
  }, [resume, run, actions, view.id, view.version])

  const planReason = gate('planImages')
  // A comic's panels are drawn with the Comics page's approved character, so they wait for it.
  const comic = Boolean(view.courseId)
  const needsCharacter = comic && view.characterApproved !== true
  const drawReason =
    gate('drawImages') ?? (artPlan ? renderError(view.current) : WORKFLOW_ERRORS.planFirst)
  // "Skip pictures" needs no plan, and no comic: its panels are its pictures. Once drawn, it is
  // offered while a finished run left a slide with neither a picture nor its text-only save.
  const skipReason = gate('skipPictures') ?? renderError(view.current)
  const unsaved = slides.some((n) => {
    const art = artOf(n)
    return !art?.assetId && art?.fallback !== 'skipped'
  })
  const skipShown = offered('skipPictures') && !comic && (!drawn || (!drawing && unsaved))
  const fitBlocked =
    (offered('drawImages') || offered('skipPictures')) &&
    renderError(view.current) === WORKFLOW_ERRORS.fitFailed

  // The post's slides on the stage, one at a time: each art-box slide with its scene or its picture,
  // the others as they are laid out, so the filmstrip is the whole post.
  const shown = (layout?.body.slides ?? []).map((laid, i) => {
    const n = i + 1
    const planned = slides.includes(n)
    const scene = sceneOf(n)
    const art = artOf(n)
    const png = drawn ? render?.body.slides[i]?.pngAssetId : undefined
    const source = png
      ? { assetId: png }
      : { layout: { postId: view.id, layoutId: layout?.id ?? '', planId: artPlan?.id } }
    // Its picture is still on its way in this drawing: none yet, or one of an older scene. Or this
    // slide's own picture, drawn again on a press.
    const waiting =
      planned &&
      ((drawing && (!art?.assetId || (scene !== undefined && art.scene !== scene))) ||
        redrawing?.slide === n)
    return { n, laid, planned, scene, art, source, text: slideWords(laid), waiting }
  })
  const at = inRange(selected, shown.length)
  const here = shown[at]

  /** Under the selected slide: why it has no picture, with the day's limit and a way to try again. */
  const missing = (s: (typeof shown)[number]) =>
    // A slide not reached yet while the images are drawn waits without a label.
    drawn &&
    s.planned &&
    !(drawing && !s.art) &&
    !s.art?.assetId && (
      <p className="flex flex-wrap items-center justify-center gap-2">
        <span className={tag}>{missingLabel(s.art)}</span>
        {s.art?.fallback === 'daily_limit' && <span className={reasonText}>{limitLine}</span>}
        {failedWhy(s.art) && <span className={reasonText}>{failedWhy(s.art)}</span>}
        {s.art?.fallback === 'no_art' && nudge && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => nudge(s.n)(null, `Slide ${s.n} drawn`)}
          >
            {redrawing?.slide === s.n && <Spin />}
            {redrawing?.slide === s.n ? 'Running…' : 'Try this one again'}
          </Button>
        )}
        {redrawing?.slide === s.n && <Working words={REDRAWING} />}
      </p>
    )

  // The rendered slides, text only or with their pictures, download once no picture is on its way
  // (in the step bar).
  const downloadable = drawn !== null && !drawing && !redrawing

  const planAgainShown = artPlan !== null && offered('planImages')
  const planShown = artPlan === null && offered('planImages')
  const drawShown = !drawn && offered('drawImages')
  const restShown = drawn !== null && remaining && offered('drawImages')
  const plan = (planAgainShown || planShown || drawShown || restShown || skipShown) && (
    <>
      {planAgainShown && (
        <Move
          className="self-start"
          label="Plan again"
          waiting={planReason ?? (planning ? movesWait([PLAN_STEP]) : null)}
          pending={busy}
          working={planPressed}
          confirm={
            artPlan.body.edited
              ? {
                  question: 'Plan the images again?',
                  body: <p className="text-caption">Your own scenes are replaced.</p>,
                  go: 'Plan again',
                }
              : undefined
          }
          onGo={() =>
            run(() => actions.planImagesAction(view.id, view.version), 'Images planned again', {
              press: { kind: 'plan' },
            })
          }
        />
      )}

      {planShown && (
        <Control reason={planReason}>
          {planning || planPressed ? (
            <Button disabled>
              <Spin />
              Running…
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={busy || planReason !== null}
              onClick={() =>
                run(() => actions.planImagesAction(view.id, view.version), 'Images planned', {
                  press: { kind: 'plan' },
                })
              }
            >
              Plan images
            </Button>
          )}
        </Control>
      )}

      {drawShown && (
        <Control reason={drawingReason ?? drawReason}>
          <Button
            disabled={busy || drawReason !== null || needsCharacter}
            onClick={() => draw(comic ? 'Drawing the panels' : `Drawing · ${imagesLabel(count)}`)}
          >
            {comic ? 'Draw panels' : `Draw images (${imagesLabel(count)})`}
          </Button>
          {needsCharacter && <CharacterFirst />}
        </Control>
      )}

      {restShown && (
        <Control reason={gate('drawImages')}>
          <Button
            variant="outline"
            disabled={busy || gate('drawImages') !== null || needsCharacter}
            onClick={() =>
              draw(comic ? 'Drawing the remaining panels' : 'Drawing the remaining images')
            }
          >
            {comic ? 'Draw remaining panels' : 'Draw remaining'}
          </Button>
          {needsCharacter && <CharacterFirst />}
        </Control>
      )}

      {skipShown && (
        <div className="flex flex-col gap-2">
          <Control reason={drawingReason ?? skipReason}>
            <Button
              variant="outline"
              disabled={busy || skipReason !== null}
              onClick={() =>
                run(
                  () => actions.skipPicturesAction(view.id, view.version),
                  'Slides saved · text only',
                  { press: { kind: 'skip' } },
                )
              }
            >
              {skipping && <Spin />}
              {SKIP}
            </Button>
          </Control>
          <p className={reasonText}>{SKIP_LINE}</p>
          {skipping && <Working words={SAVING} />}
        </div>
      )}
    </>
  )

  // The selected slide's chips, scene and earlier takes, beside the stage (GD30).
  const thisSlide =
    here?.planned && here.art?.assetId ? (
      <section key={here.n} aria-labelledby={`${ids}-slide`} className="flex flex-col gap-3">
        <h3 id={`${ids}-slide`} className="text-overline uppercase text-muted-foreground">
          {`Slide ${here.n}`}
        </h3>
        <DrawnControls
          art={here.art}
          scene={here.scene}
          earlier={earlierTakes(view.slideArt ?? [], here.n, here.art.assetId)}
          busy={busy || sceneWait !== null}
          redrawing={redrawing?.slide === here.n ? redrawing.chip : undefined}
          nudge={nudge?.(here.n) ?? null}
          swap={swap?.(here.n) ?? null}
          editScene={gate('editImageScene') === null ? (value) => saveScene(here.n, value) : null}
        />
      </section>
    ) : (
      <p className={reasonText}>{`Slide ${here?.n ?? 1} has no picture to change.`}</p>
    )

  const tabs: ActionTab[] = [
    ...(drawn ? [{ name: THIS_SLIDE, body: thisSlide }] : []),
    ...(plan ? [{ name: PLAN_TAB, badge: leftBadge(left), body: plan }] : []),
    ...(drawn && reorder && revision
      ? [
          {
            name: ORDER_TAB,
            body: (
              <SlideOrder
                slides={revision.body.structure.slides}
                words={(n) => slideWords(layout?.body.slides[n - 1])[0] ?? ''}
                busy={busy}
                move={reorder}
              />
            ),
          },
        ]
      : []),
  ]

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-6">
      <h2 id={`${ids}-heading`} className="sr-only">
        Images
      </h2>
      <StepAreas
        slides={
          layout ? (
            <SlideStage
              slides={shown.map((s) =>
                s.planned ? (
                  <figure key={s.n} aria-label={`Slide ${s.n} picture`} className="relative">
                    {s.scene !== undefined && s.laid.artBox ? (
                      <EditableSlidePreview
                        slide={s.n}
                        text={s.text}
                        {...s.source}
                        disabled={!editScene}
                        slots={[
                          {
                            kind: 'scene',
                            key: 'scene',
                            label: 'Scene',
                            box: s.laid.artBox,
                            text: s.scene,
                          },
                        ]}
                        onSave={(_slot, value) => saveScene(s.n, value)}
                      />
                    ) : (
                      <SlidePreview slide={s.n} text={s.text} {...s.source} />
                    )}
                    {s.waiting && (
                      <div
                        role="status"
                        aria-label={`Slide ${s.n} · being drawn`}
                        className="absolute inset-0 grid place-items-center bg-background/60 motion-safe:animate-pulse"
                      >
                        <Spin alone />
                      </div>
                    )}
                  </figure>
                ) : (
                  <SlidePreview key={s.n} slide={s.n} text={s.text} {...s.source} />
                ),
              )}
              thumbs={shown.map((s) => (
                <div key={s.n} className="relative">
                  <SlidePreview slide={s.n} text={s.text} {...s.source} />
                  {s.waiting && <div className={thumbWaiting} />}
                </div>
              ))}
              selected={at}
              onSelect={setSelected}
              below={here && missing(here)}
            />
          ) : (
            <p className={reasonText}>No approved layout yet.</p>
          )
        }
        actions={
          <>
            {gate('editImageScene') === null && sceneWait && (
              <p className={reasonText}>{sceneWait}</p>
            )}
            {/* What is happening to the scenes and the pictures, counted, over every tab. */}
            {planning && <Working words={movesWait([PLAN_STEP]) ?? ''} />}
            {!planning && planPressed && <Working words={PLANNING} />}
            {drawing && <Working words={movesWait([DRAW_STEP], view.progress) ?? ''} />}
            {planFailed && (
              <FailedLine words={PLAN_FAILED} reason={view.failedReasons?.[PLAN_STEP]} />
            )}
            {drawFailed && (
              <FailedLine words={DRAW_FAILED} reason={view.failedReasons?.[DRAW_STEP]} />
            )}
            {/* What keeps the pictures from being drawn or saved, named, with the way to fix it. */}
            {fitBlocked && <FitFailures postId={view.id} current={view.current} />}
            {/* In the step bar, before "Next: Settings →" (18 Oct). */}
            {downloadable && <DownloadSlides postId={view.id} />}
            <StepTabs
              label="Image controls"
              tabs={tabs}
              open={tab.open}
              initial={THIS_SLIDE}
              onOpen={tab.onOpen}
            />
          </>
        }
      />
    </section>
  )
}

export type BlogImagesStepProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<
    WorkbenchActions,
    'planImagesAction' | 'editImageSceneAction' | 'drawImagesAction' | 'nudgeImageAction'
  > &
    Partial<Pick<WorkbenchActions, 'embedPostSlidesAction'>>
}

/** Where a blog's picture sits, in words. */
const placeLabel = (target: BlogTarget | undefined) =>
  target === undefined || target === 'cover'
    ? 'Cover picture'
    : `Picture after section ${target.after}`

/** A planned scene in words, with "Edit scene" to change it in place; read-only without `onSave`. */
function SceneText({
  scene,
  label,
  busy,
  onSave,
}: {
  scene: string
  label: string
  busy: boolean
  onSave: ((text: string) => void) | null
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(scene)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-muted-foreground">{scene}</p>
      {onSave && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          aria-expanded={editing}
          disabled={busy}
          onClick={() => {
            setText(scene)
            setEditing(!editing)
          }}
        >
          Edit scene
        </Button>
      )}
      {onSave && editing && (
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label={`Scene for the ${label.toLowerCase()}`}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                if (text.trim() !== scene.trim()) onSave(text)
                setEditing(false)
              }}
            >
              Save scene
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * A blog's pictures (BR4), as a look post's are (GD12–GD14): a cover and up to three pictures
 * between sections, each planned in words at its place, the scene edited in place, then drawn on
 * "Draw images" in the background, each picture showing as it lands; once drawn, each has the
 * image chips and "New picture" beside the pictures (GD30), a place left without one says why,
 * with "Try this one again" where it could not be drawn, and "Draw remaining" draws it; a drawing
 * that stopped before every picture was reached goes on by itself. In place of a picture, a linked
 * live post's slides can sit after a section ("Embed slides", BR7): that place is not drawn. Every
 * control asks the workflow rules for this stage; a viewer who may not edit sees the pictures only.
 */
export function BlogImagesStep({ view, viewer, actions }: BlogImagesStepProps) {
  const { pending, run, current } = usePressedAction<Press>()
  const { planning: planPressed, redrawing } = pressesOf(current)
  const limitLine = useImageLimitLine()
  const ids = useId()
  const { artPlan, blogText, blogImages } = view.current
  const planning = view.running.includes(PLAN_STEP)
  const drawing = view.running.includes(DRAW_STEP)
  const busy = pending || planning || drawing
  // A background plan or drawing that failed says so where its loader was, with why.
  const planFailed = !planning && !planPressed && (view.failed?.includes(PLAN_STEP) ?? false)
  const drawFailed = !drawing && !redrawing && (view.failed?.includes(DRAW_STEP) ?? false)
  const [postId, setPostId] = useState('')
  const [after, setAfter] = useState('')
  const [selected, setSelected] = useState(0)
  const [open, setOpen] = useState(THIS_PICTURE)

  const gate = (action: PostAction) => actionError(action, viewer, view.stage)
  const offered = (action: PostAction) =>
    ACTION_STAGES[action].includes(view.stage) && gate(action) !== WORKFLOW_ERRORS.notAuthorised

  const scenes = artPlan?.body.scenes ?? []
  const embeds = blogImages?.body.embeds ?? []
  const images = blogImages?.body.images ?? []
  const drawn = images.length > 0
  const embedOf = (target: BlogTarget | undefined) =>
    target === undefined || target === 'cover'
      ? null
      : (embeds.find((e) => e.after === target.after) ?? null)
  const toDraw = scenes.filter((s) => embedOf(s.target) === null)
  const pictureOf = (slide: number) => images.find((p) => p.slide === slide)
  // A picture a finished run left to draw; while a run goes on, its pictures are on their way.
  const left = drawing
    ? 0
    : toDraw.filter((s) => {
        const p = pictureOf(s.slide)
        return !p?.assetId || p.scene !== s.scene
      }).length
  const remaining = left > 0
  const postTitle = (id: string) =>
    view.blogPosts?.find((p) => p.id === id)?.title ?? 'A linked post'
  const livePosts = (view.blogPosts ?? []).filter((p) => p.live)
  const sections = blogText?.body.sections.length ?? 0

  const sceneWait = editWaitError(
    'editImageScene',
    viewer,
    view.stage,
    movesWait(view.running, view.progress),
  )
  const saveScene =
    gate('editImageScene') === null
      ? (slide: number) => (text: string) =>
          run(
            () => actions.editImageSceneAction(view.id, view.version, { slide, text }),
            'Scene saved',
          )
      : null
  const nudge =
    gate('nudgeImage') === null
      ? (slide: number) => (chip: string | null, done: string) =>
          run(() => actions.nudgeImageAction(view.id, view.version, { slide, nudge: chip }), done, {
            press: { kind: 'redraw', slide, chip },
          })
      : null
  const draw = (done: string) => run(() => actions.drawImagesAction(view.id, view.version), done)
  const drawingReason = drawing ? movesWait([DRAW_STEP]) : null

  // A drawing that stopped before it reached every planned picture (a restart or a crash; a picture
  // it reached always has an entry, drawn or not) goes on by itself when the screen opens, once.
  const unreached = drawn && toDraw.some((s) => !pictureOf(s.slide))
  const resume = unreached && !planning && !drawing && gate('drawImages') === null
  const resumed = useRef(false)
  useEffect(() => {
    if (!resume || resumed.current) return
    resumed.current = true
    run(() => actions.drawImagesAction(view.id, view.version), 'Drawing the rest of the images')
  }, [resume, run, actions, view.id, view.version])

  const planReason = gate('planImages')
  const drawReason = gate('drawImages') ?? (artPlan ? null : WORKFLOW_ERRORS.planFirst)
  const { embedPostSlidesAction } = actions
  const embedGate = gate('embedPostSlides')
  const embedShown = embedPostSlidesAction !== undefined && offered('embedPostSlides')
  const embed = () => {
    if (!embedPostSlidesAction) return
    run(
      () =>
        embedPostSlidesAction(view.id, view.version, { postId, at: Number.parseInt(after, 10) }),
      `Slides of ${postTitle(postId)} embedded`,
    )
  }

  // The blog's pictures on the stage, one at a time, each at its place: its picture or why it has
  // none, its scene in words with "Edit scene", or the post's slides that sit there.
  const shown = scenes.map((s) => {
    const label = placeLabel(s.target)
    const embedded = embedOf(s.target)
    const picture = pictureOf(s.slide)
    const assetId = picture?.tintedAssetId ?? picture?.assetId ?? null
    // Or this picture, drawn again on a press.
    const waiting =
      (drawing && !embedded && (!picture?.assetId || picture.scene !== s.scene)) ||
      redrawing?.slide === s.slide
    return { s, label, embedded, picture, assetId, waiting }
  })
  const at = inRange(selected, shown.length)
  const here = shown[at]

  const plan = (offered('planImages') || ((!drawn || remaining) && offered('drawImages'))) && (
    <>
      {artPlan && offered('planImages') && (
        <Move
          className="self-start"
          label="Plan again"
          waiting={planReason ?? (planning ? movesWait([PLAN_STEP]) : null)}
          pending={busy}
          working={planPressed}
          confirm={
            artPlan.body.edited
              ? {
                  question: 'Plan the images again?',
                  body: <p className="text-caption">Your own scenes are replaced.</p>,
                  go: 'Plan again',
                }
              : undefined
          }
          onGo={() =>
            run(() => actions.planImagesAction(view.id, view.version), 'Images planned again', {
              press: { kind: 'plan' },
            })
          }
        />
      )}
      {!artPlan && offered('planImages') && (
        <Control reason={planReason}>
          <Button
            variant="outline"
            disabled={busy || planReason !== null}
            onClick={() =>
              run(() => actions.planImagesAction(view.id, view.version), 'Images planned', {
                press: { kind: 'plan' },
              })
            }
          >
            {(planning || planPressed) && <Spin />}
            {planning || planPressed ? 'Running…' : 'Plan images'}
          </Button>
        </Control>
      )}
      {!drawn && offered('drawImages') && (
        <Control reason={drawingReason ?? drawReason}>
          <Button
            disabled={busy || drawReason !== null}
            onClick={() => draw(`Drawing · ${imagesLabel(toDraw.length)}`)}
          >
            {`Draw images (${imagesLabel(toDraw.length)})`}
          </Button>
        </Control>
      )}
      {drawn && remaining && offered('drawImages') && (
        <Control reason={gate('drawImages')}>
          <Button
            variant="outline"
            disabled={busy || gate('drawImages') !== null}
            onClick={() => draw('Drawing the remaining images')}
          >
            Draw remaining
          </Button>
        </Control>
      )}
    </>
  )

  // The selected picture's chips, beside the stage (GD30).
  const thisPicture =
    here && !here.embedded && here.picture?.assetId ? (
      <section
        key={here.s.slide}
        aria-labelledby={`${ids}-picture`}
        className="flex flex-col gap-3"
      >
        <h3 id={`${ids}-picture`} className="text-overline uppercase text-muted-foreground">
          {here.label}
        </h3>
        <DrawnControls
          art={here.picture}
          scene={here.s.scene}
          earlier={[]}
          busy={busy || sceneWait !== null}
          redrawing={redrawing?.slide === here.s.slide ? redrawing.chip : undefined}
          nudge={nudge?.(here.s.slide) ?? null}
          swap={null}
          editScene={null}
        />
      </section>
    ) : (
      <p className={reasonText}>{`${here?.label ?? 'This place'} has no picture to change.`}</p>
    )

  const embedBody = (
    <section aria-labelledby={`${ids}-embed`} className="flex flex-col gap-3">
      <h3 id={`${ids}-embed`} className="text-h4">
        A post's slides in place of a picture
      </h3>
      {livePosts.length === 0 ? (
        <p className={reasonText}>No live post is linked to this blog yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${ids}-post`}>Post</Label>
              <NativeSelect
                id={`${ids}-post`}
                value={postId}
                disabled={busy || embedGate !== null}
                onChange={(e) => setPostId(e.target.value)}
              >
                <option value="">Choose a post</option>
                {livePosts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${ids}-after`}>After section</Label>
              <NativeSelect
                id={`${ids}-after`}
                value={after}
                disabled={busy || embedGate !== null}
                onChange={(e) => setAfter(e.target.value)}
              >
                <option value="">Choose a section</option>
                {Array.from({ length: sections }, (_, i) => String(i + 1)).map((n) => (
                  <option key={n} value={n}>
                    {`Section ${n}`}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <Control reason={embedGate}>
            <Button
              variant="outline"
              disabled={busy || embedGate !== null || postId === '' || after === ''}
              onClick={embed}
            >
              Embed slides
            </Button>
          </Control>
        </>
      )}
    </section>
  )

  const tabs: ActionTab[] = [
    ...(drawn ? [{ name: THIS_PICTURE, body: thisPicture }] : []),
    ...(plan ? [{ name: PLAN_TAB, badge: leftBadge(left), body: plan }] : []),
    ...(embedShown && sections > 0 ? [{ name: EMBED_TAB, body: embedBody }] : []),
  ]

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-6">
      <h2 id={`${ids}-heading`} className="sr-only">
        Images
      </h2>
      <StepAreas
        slides={
          shown.length > 0 ? (
            <SlideStage
              label="Pictures, one at a time"
              slides={shown.map(({ s, label, embedded, picture, assetId, waiting }) => (
                // The place's label, its picture and its scene fill the stage's slide, scrolling
                // inside it while the scene is edited.
                <figure
                  key={s.slide}
                  aria-label={label}
                  className="flex h-full flex-col gap-2 overflow-y-auto"
                >
                  <figcaption className="text-overline uppercase text-muted-foreground">
                    {label}
                  </figcaption>
                  {embedded ? (
                    <p className="border px-3 py-2 text-caption">
                      {`Slides of “${postTitle(embedded.postId)}” sit here`}
                    </p>
                  ) : (
                    <>
                      <div className="relative">
                        {assetId ? (
                          // A stored PNG: nothing to optimise.
                          // biome-ignore lint/performance/noImgElement: next/image would re-encode the stored picture.
                          <img
                            src={`/admin/assets/${encodeURIComponent(assetId)}`}
                            alt={s.scene}
                            {...(s.target === 'cover'
                              ? { width: 1600, height: 900 }
                              : { width: 1200, height: 900 })}
                            className="block h-auto w-full border"
                          />
                        ) : (
                          drawn &&
                          !waiting && (
                            <span className="flex flex-wrap items-center gap-2">
                              <span className={tag}>{missingLabel(picture)}</span>
                              {picture?.fallback === 'daily_limit' && (
                                <span className={reasonText}>{limitLine}</span>
                              )}
                              {failedWhy(picture) && (
                                <span className={reasonText}>{failedWhy(picture)}</span>
                              )}
                              {picture?.fallback === 'no_art' && nudge && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => nudge(s.slide)(null, `${label} drawn`)}
                                >
                                  Try this one again
                                </Button>
                              )}
                            </span>
                          )
                        )}
                        {waiting && (
                          <p role="status" aria-label={`${label} · being drawn`}>
                            <Spin alone />
                          </p>
                        )}
                      </div>
                      <SceneText
                        key={s.scene}
                        scene={s.scene}
                        label={label}
                        busy={busy || sceneWait !== null}
                        onSave={saveScene?.(s.slide) ?? null}
                      />
                    </>
                  )}
                </figure>
              ))}
              thumbs={shown.map(({ s, assetId, waiting }) => (
                // The thumbnails are the pictures alone, cropped to the filmstrip's shape.
                <div key={s.slide} className="relative">
                  {assetId ? (
                    <SlidePreview
                      slide={s.slide}
                      assetId={assetId}
                      className="aspect-4/5 object-cover"
                    />
                  ) : (
                    <div className="aspect-4/5 w-full border bg-muted" />
                  )}
                  {waiting && <div className={thumbWaiting} />}
                </div>
              ))}
              names={shown.map(({ label }) => label)}
              selected={at}
              onSelect={setSelected}
            />
          ) : (
            <p className={reasonText}>No pictures planned yet.</p>
          )
        }
        actions={
          <>
            {gate('editImageScene') === null && sceneWait && (
              <p className={reasonText}>{sceneWait}</p>
            )}
            {planning && <Working words={movesWait([PLAN_STEP]) ?? ''} />}
            {!planning && planPressed && <Working words={PLANNING} />}
            {drawing && <Working words={movesWait([DRAW_STEP], view.progress) ?? ''} />}
            {/* A picture that could not be drawn, drawn again: its controls went with the press. */}
            {redrawing && !pictureOf(redrawing.slide)?.assetId && <Working words={REDRAWING} />}
            {planFailed && (
              <FailedLine words={PLAN_FAILED} reason={view.failedReasons?.[PLAN_STEP]} />
            )}
            {drawFailed && (
              <FailedLine words={DRAW_FAILED} reason={view.failedReasons?.[DRAW_STEP]} />
            )}
            <StepTabs label="Picture controls" tabs={tabs} open={open} onOpen={setOpen} />
          </>
        }
      />
    </section>
  )
}

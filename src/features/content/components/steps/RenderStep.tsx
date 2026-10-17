'use client'

import { type ReactNode, useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Spin, Working } from '@/shared/components/Working'
import type { Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import { LIBRARY } from '../../assets/library'
import {
  ACTION_STAGES,
  actionError,
  COVER_IDEA_MAX,
  renderError,
  WORKFLOW_ERRORS,
} from '../../lib/workflow'
import type { Body } from '../../model/artifacts'
import type { LightEdit } from '../../server/commands'
import { firstChars } from '../../text/script'
import {
  ChangesNote,
  Control,
  DownloadSlides,
  fallbackLine,
  RenderedSlides,
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

export type RenderStepProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<
    WorkbenchActions,
    'renderAction' | 'retryArtAction' | 'lightEditAction' | 'makeCoversAction' | 'chooseCoverAction'
  >
  /** The selected slide, held above the screen's version key (Workbench), so a save keeps it (GD24). */
  slide?: SlideHold
  /** The open tab beside the slides, held there too. */
  tab?: TabHold
}

/** The step "Make covers" runs as (server/commands/render.ts). */
const COVERS_STEP = 'covers'

/** The tabs once rendered: the selected slide's light edits, and the covers, open first (criterion 102). */
const THIS_SLIDE = 'This slide'
const COVERS_TAB = 'Covers'

/** The slots an editor may reword after render, with their labels. */
const PHRASE_SLOTS = [
  ['phrase', 'Phrase'],
  ['underline', 'Underline'],
] as const

type SlideControlsProps = {
  view: WorkbenchView
  render: Body<'render'>
  index: number
  /** Null when the viewer may not edit: then only "Version n" or "No art" shows. */
  edit: {
    busy: boolean
    lightEdit: (edit: LightEdit, done: string) => void
  } | null
}

/**
 * What shows under one rendered slide (criteria 40, 41). Under a slide with art: its version, its
 * phrase inline, and "Swap image"; new art comes from the cover options below (criterion 102).
 * Under a text slide: "No art", and on a body slide, move up and down. Cover and take never move.
 */
function SlideControls({ view, render, index, edit }: SlideControlsProps) {
  const ids = useId()
  const laid = view.current.layout?.body.slides[index]
  const slide = view.current.revision?.body.structure.slides[index]
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(PHRASE_SLOTS.map(([key]) => [key, slide?.slots[key]?.text ?? ''])),
  )
  const [swapping, setSwapping] = useState(false)

  if (!laid?.artBox) {
    const bodies = view.current.layout?.body.slides.filter((s) => s.kind === 'body').length ?? 0
    const at =
      view.current.layout?.body.slides.slice(0, index + 1).filter((s) => s.kind === 'body')
        .length ?? 0
    const move = (to: number) =>
      edit?.lightEdit({ kind: 'reorder', from: at, to }, 'Slides reordered')
    return (
      <div className="flex items-center justify-between gap-2">
        <p className={reasonText}>No art</p>
        {edit && laid?.kind === 'body' && (
          <ReorderButtons
            name={`slide ${index + 1}`}
            up={{ disabled: edit.busy || at <= 1, onClick: () => move(at - 1) }}
            down={{ disabled: edit.busy || at >= bodies, onClick: () => move(at + 1) }}
          />
        )}
      </div>
    )
  }

  const { version, assetId } = render.art
  const earlier = (view.earlierArt ?? []).filter((a) => a.assetId !== assetId)
  const phrases = PHRASE_SLOTS.filter(([key]) => slide?.slots[key])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground">{`Version ${version}`}</p>
      {edit && (
        <>
          {phrases.map(([key, label]) => (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={`${ids}-${key}`}>{label}</Label>
              <Input
                id={`${ids}-${key}`}
                value={texts[key]}
                maxLength={200}
                onChange={(e) => setTexts({ ...texts, [key]: e.target.value })}
              />
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                disabled={edit.busy}
                onClick={() =>
                  edit.lightEdit(
                    { kind: 'phrase', slide: index + 1, slot: key, text: texts[key] },
                    `${label} updated`,
                  )
                }
              >
                {`Update ${label.toLowerCase()}`}
              </Button>
            </div>
          ))}
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
                  disabled={edit.busy}
                  onClick={() =>
                    edit.lightEdit(
                      { kind: 'swapImage', image: { assetId: a.assetId } },
                      'Image swapped',
                    )
                  }
                >
                  {`Version ${a.version}`}
                </Button>
              ))}
              {LIBRARY.map((l) => (
                <Button
                  key={l.id}
                  variant="outline"
                  size="sm"
                  disabled={edit.busy}
                  onClick={() =>
                    edit.lightEdit({ kind: 'swapImage', image: { library: l.id } }, 'Image swapped')
                  }
                >
                  {l.label}
                </Button>
              ))}
            </fieldset>
          )}
        </>
      )}
    </div>
  )
}

type CoversProps = {
  /** A reviewer's request for changes naming the covers (criterion 120), or null. */
  note: ReactNode
  covers: Body<'covers'> | null
  /** The art the render uses now: its option shows "In use". */
  inUse: string | null
  busy: boolean
  /** A set being drawn. */
  making: boolean
  make: (idea: string) => void
  choose: (option: number) => void
}

/**
 * The cover options (criteria 102, 103): an optional cover idea, "Make covers" (then "Another
 * set"), and each option as the cover slide drawn with its art, with "Use this cover", or the
 * reason it has none. No prompt is written here: code builds it.
 */
function Covers({ note, covers, inUse, busy, making, make, choose }: CoversProps) {
  const ids = useId()
  const limitLine = useImageLimitLine()
  const [idea, setIdea] = useState('')
  const options = covers?.options ?? []
  return (
    <section aria-labelledby={`${ids}-covers`} className="flex flex-col gap-3">
      <h3 id={`${ids}-covers`} className="text-overline uppercase text-muted-foreground">
        Covers
      </h3>
      {note}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor={`${ids}-idea`}>Cover idea (optional)</Label>
          <Input
            id={`${ids}-idea`}
            value={idea}
            onChange={(e) => setIdea(firstChars(e.target.value, COVER_IDEA_MAX))}
          />
        </div>
        {making ? (
          <Button disabled>
            <Spin />
            Running…
          </Button>
        ) : (
          <Button variant="outline" disabled={busy} onClick={() => make(idea.trim())}>
            {options.length > 0 ? 'Another set' : 'Make covers'}
          </Button>
        )}
      </div>
      {making && <Working words="Drawing three covers · about a minute" />}
      {options.length > 0 && (
        <ul
          aria-label="Cover options"
          className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2"
        >
          {options.map((o, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: an option is its place in the list; two may share art.
            <li key={i} className="flex flex-col gap-2">
              {o.previewAssetId ? (
                // biome-ignore lint/performance/noImgElement: next/image would re-encode the exact render.
                <img
                  src={`/admin/assets/${encodeURIComponent(o.previewAssetId)}`}
                  alt={`Cover option ${i + 1}`}
                  className="aspect-4/5 w-full border object-cover"
                />
              ) : (
                <div className="flex aspect-4/5 w-full items-center justify-center border">
                  <p className={reasonText}>{fallbackLine(o.fallback ?? 'no_art', limitLine)}</p>
                </div>
              )}
              {o.assetId === null ? null : o.assetId === inUse ? (
                <span className={cn(tag, 'self-start')}>In use</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={busy}
                  onClick={() => choose(i)}
                >
                  Use this cover
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * The render step (criteria 34–37, 47, 102, 103): before render, the approved layout's slides
 * from the preview route with its fit rows and "Render", unavailable while a row fails; after, the
 * stored PNGs with the light edits, the cover options, and "Try again" on a cover that has no art.
 * The market versions and "Preview in context" are on Settings (steps/PostPreview.tsx). A reviewer's
 * request for changes naming the covers shows beside them (criterion 120). Once the post is in
 * review or live it shows read-only (criterion 111). It is the Images screen of a post from before
 * the looks (GD25); an edit on Text moves the post back by itself, with no "Back to text" (GD28).
 * The slides sit on a stage, the selected one over the filmstrip; once rendered, beside it, the
 * tabs "This slide" (its light edits) and "Covers", open first.
 */
export function RenderStep({ view, viewer, actions, slide, tab: heldTab }: RenderStepProps) {
  // Which press is running, so only its control waits as "Running…" with its words beside it.
  const { pending, run, pressed } = usePressedAction<'render' | 'retry' | 'covers'>()
  const ids = useId()
  // The selected slide and the open tab, the workbench's when it passes them (GD24).
  const { at: selected, onSelect: setSelected, tab } = useHolds(slide, heldTab)
  const { layout, render, sendBack } = view.current
  // Render and "Try again" both run the render step: running, both wait; pressed, the one pressed.
  const renderRunning = view.running.includes('render')
  const drawingCover = pressed('render') || pressed('retry')
  const slides = layout?.body.slides.length ?? 0
  const done = `Rendered · ${slides} slides`

  const renderGate = actionError('render', viewer, view.stage)
  const renderReason = renderGate ?? renderError(view.current)
  const retryGate = actionError('retryArt', viewer, view.stage)
  // A set of covers being drawn, as its own step.
  const drawingCovers = view.running.includes(COVERS_STEP) || pressed('covers')
  // Light edits and a cover used each make a new render: one at a time, none while one renders
  // or a set is drawn.
  const busy = pending || renderRunning || drawingCovers
  const edit: SlideControlsProps['edit'] =
    actionError('lightEdit', viewer, view.stage) === null
      ? {
          busy,
          lightEdit: (e, message) =>
            run(() => actions.lightEditAction(view.id, view.version, e), message),
        }
      : null
  const offerCovers =
    actionError('makeCovers', viewer, view.stage) === null &&
    actionError('chooseCover', viewer, view.stage) === null

  const coversShown = render !== null && offerCovers
  const retryShown =
    render !== null &&
    (render.body.art.fallback === 'no_art' || render.body.art.fallback === 'daily_limit') &&
    ACTION_STAGES.retryArt.includes(view.stage) &&
    retryGate !== WORKFLOW_ERRORS.notAuthorised
  // A request for changes naming the covers shows beside them, or under the heading while they
  // are not shown (criterion 120); the other steps' show at their own step.
  const changesNote =
    sendBack?.body.step === 'covers' ? <ChangesNote sendBack={sendBack.body} /> : null

  // The slides on the stage, one at a time: the stored PNGs once rendered (with the cover's
  // "Replay", "No art" or "Limit" under it, criteria 6, 37), the layout before.
  const count = render ? render.body.slides.length : (layout?.body.slides.length ?? 0)
  const at = Math.max(0, Math.min(selected, count - 1))

  const tabs: ActionTab[] = render
    ? [
        {
          name: THIS_SLIDE,
          body: (
            // Its own key, so a phrase typed on one slide is not offered on the next.
            <section key={at} aria-labelledby={`${ids}-slide`} className="flex flex-col gap-3">
              <h3 id={`${ids}-slide`} className="text-overline uppercase text-muted-foreground">
                {`Slide ${at + 1}`}
              </h3>
              <SlideControls view={view} render={render.body} index={at} edit={edit} />
            </section>
          ),
        },
        ...(coversShown || retryShown
          ? [
              {
                name: COVERS_TAB,
                body: (
                  <>
                    {coversShown && (
                      <Covers
                        note={changesNote}
                        covers={view.current.covers?.body ?? null}
                        inUse={render.body.art.assetId}
                        busy={busy}
                        making={drawingCovers}
                        make={(idea) =>
                          run(
                            () => actions.makeCoversAction(view.id, view.version, idea),
                            'Covers made',
                            { press: 'covers' },
                          )
                        }
                        choose={(option) =>
                          run(
                            () => actions.chooseCoverAction(view.id, view.version, option),
                            'Cover changed',
                          )
                        }
                      />
                    )}
                    {retryShown && (
                      <Control reason={retryGate}>
                        {renderRunning || pressed('retry') ? (
                          <Button disabled>
                            <Spin />
                            Running…
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            disabled={pending || retryGate !== null}
                            onClick={() =>
                              run(() => actions.retryArtAction(view.id, view.version), done, {
                                press: 'retry',
                              })
                            }
                          >
                            Try again
                          </Button>
                        )}
                      </Control>
                    )}
                  </>
                ),
              },
            ]
          : []),
      ]
    : []

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-6">
      <h2 id={`${ids}-heading`} className="sr-only">
        Images
      </h2>

      {changesNote && !coversShown && changesNote}

      <StepAreas
        slides={
          render ? (
            <RenderedSlides
              render={render.body}
              layout={layout?.body.slides}
              stage
              selected={at}
              onSelect={setSelected}
              below={renderRunning ? undefined : () => <DownloadSlides postId={view.id} />}
            />
          ) : layout && count > 0 ? (
            <SlideStage
              slides={layout.body.slides.map((laid, i) => (
                <SlidePreview
                  // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position in the layout.
                  key={i}
                  slide={i + 1}
                  layout={{ postId: view.id, layoutId: layout.id }}
                  text={slideWords(laid)}
                />
              ))}
              selected={at}
              onSelect={setSelected}
            />
          ) : (
            <p className="text-muted-foreground">No approved layout yet.</p>
          )
        }
        actions={
          <>
            <StepTabs
              label="Image controls"
              tabs={tabs}
              open={tab.open}
              initial={COVERS_TAB}
              onOpen={tab.onOpen}
            />

            {layout && !render && (
              <div className="flex flex-col gap-2">
                <h3 className="text-overline uppercase text-muted-foreground">Fit checks</h3>
                <ul className="flex flex-col gap-1">
                  {layout.body.fitChecks.map((c) => (
                    <li
                      key={c.label}
                      className={cn(
                        'flex items-start justify-between gap-2 text-caption',
                        !c.pass && 'text-destructive',
                      )}
                    >
                      <span>{c.label}</span>
                      <span className={cn(tag, 'shrink-0')}>{c.pass ? 'Pass' : 'Fail'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ACTION_STAGES.render.includes(view.stage) &&
              renderGate !== WORKFLOW_ERRORS.notAuthorised && (
                <Control reason={renderReason}>
                  {renderRunning || pressed('render') ? (
                    <Button disabled>
                      <Spin />
                      Running…
                    </Button>
                  ) : (
                    <Button
                      disabled={pending || renderReason !== null}
                      onClick={() =>
                        run(() => actions.renderAction(view.id, view.version), done, {
                          press: 'render',
                        })
                      }
                    >
                      Render
                    </Button>
                  )}
                </Control>
              )}
            {drawingCover && <Working words="Drawing the cover…" />}
          </>
        }
      />
    </section>
  )
}

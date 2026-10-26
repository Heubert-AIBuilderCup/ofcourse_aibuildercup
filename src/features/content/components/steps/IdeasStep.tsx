'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Label } from '@/shared/components/ui/label'
import { Spin, Working } from '@/shared/components/Working'
import type { Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import { formatById } from '../../formats'
import { stepOfStage, stepPath } from '../../lib/steps'
import { editWaitError, type PostAction, WORKFLOW_ERRORS } from '../../lib/workflow'
import type { IdeaCard } from '../../model/types'
import type { Saved } from '../../server/commands'
import { templateById } from '../../templates'
import { Control, FailedLine, movesWait, reasonText, StepAreas, StepBack, tag } from '../parts'
import { usePressedAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'

export type IdeasStepProps = {
  view: WorkbenchView
  viewer: Staff
  /** A blog's angles are picked with pickBlogAngleAction (BR1), which a blog's page passes. */
  actions: Pick<WorkbenchActions, 'pickIdeasAction' | 'moreIdeasAction'> &
    Partial<Pick<WorkbenchActions, 'pickBlogAngleAction'>>
  /** Shown from the versions ("Back to ideas"): the way back to them, which keeps them. */
  onBack?: () => void
}

/** The step the cards are found in, and the outlining a pick starts (server/commands/ideas.ts IDEAS_STEP, OUTLINE_STEP). */
const IDEAS_STEP = 'ideas'
const OUTLINE_STEP = 'outline'
const IDEAS_FAILED = 'Finding ideas failed. Your facts are kept.'
const OUTLINE_FAILED = 'Outlining failed. Your facts are kept.'
/** "Combine" takes two to four cards, no more (GD2). */
const COMBINE = 4
const COMBINE_FULL = 'Combine takes up to four ideas.'

/**
 * The cards a failed outline's "Try again" outlines again (criterion 93): the ones last picked on
 * this page, else those the post's outline serves when each is still shown, else none.
 */
function retryCards(
  lastPick: number[] | null,
  picked: readonly IdeaCard[] | null | undefined,
  cards: readonly IdeaCard[],
): number[] | null {
  if (lastPick) return lastPick
  if (!picked) return null
  const at = picked.map((c) => cards.findIndex((s) => s.angle === c.angle && s.hook === c.hook))
  return at.length > 0 && at.every((i) => i >= 0) ? at : null
}

/**
 * The idea cards (GD1–GD3, GD20): the editor's framing line above them, then in the slides area
 * each card's angle and hook, pressed to select it, with a tick to combine up to four; beside the cards
 * (GD30, D1) the selected card's audience, format with its one-line description (GD33), suggested
 * look and length with "Use this idea", then "Combine" and "More ideas". While the cards are found,
 * or a pick is outlined, the step says so in words and its buttons wait. The model's top three come
 * first, marked "Recommended", and the first card is pre-selected, though only "Use this idea"
 * outlines (GD29, GD32). A failed outline offers "Try again" for
 * the same idea (criterion 93). Each control asks editWaitError, so at a passed step it waits while
 * any step runs (122); a viewer who may not edit sees the cards only.
 */
export function IdeasStep({ view, viewer, actions, onBack }: IdeasStepProps) {
  // Which press is running, so only its control waits as "Running…" with its words beside it.
  const { pending, run, pressed } = usePressedAction<'use' | 'retry' | 'combine' | 'more'>()
  const router = useRouter()
  const [ticked, setTicked] = useState<number[]>([])
  // The cards picked last on this page, for a failed draft's "Try again".
  const [lastPick, setLastPick] = useState<number[] | null>(null)
  // The card whose details and "Use this idea" show beside the cards: the first until another is
  // pressed (GD29).
  const [selected, setSelected] = useState(0)
  const ids = useId()
  // A blog's cards are angles: one is picked, never two combined (BR1, BR2).
  const blog = view.kind === 'blog'
  const cards = view.current.ideas?.body.cards ?? []
  const at = Math.min(selected, cards.length - 1)
  const chosen = cards[at]
  const framing = view.current.source?.body.framing ?? null
  const running = view.running.includes(IDEAS_STEP) || view.running.includes(OUTLINE_STEP)
  const waiting = running ? movesWait(view.running, view.progress) : null
  const failed = (step: string) => !running && (view.failed?.includes(step) ?? false)

  // At a passed step every control waits while any step of the post runs (criterion 122).
  const anyRunning = movesWait(view.running, view.progress)
  const gate = (action: PostAction) => {
    const error = editWaitError(action, viewer, view.stage, anyRunning)
    return { shown: error !== WORKFLOW_ERRORS.notAuthorised, reason: error }
  }
  const pickGate = gate(blog ? 'pickBlogAngle' : 'pickIdeas')
  const moreGate = gate('moreIdeas')
  const blocked = pending || running
  const finding = pressed('more')
  const outlining = pressed('use') || pressed('retry') || pressed('combine')
  // The press's own words while it runs; the polled step's once it is running.
  const working = outlining ? 'Outlining the idea…' : finding ? 'Finding more ideas…' : waiting

  const pick = (indexes: number[], from: 'use' | 'retry' | 'combine') => {
    setLastPick(indexes)
    const { pickBlogAngleAction } = actions
    run(
      () =>
        blog && pickBlogAngleAction
          ? pickBlogAngleAction(view.id, view.version, { card: indexes[0] })
          : actions.pickIdeasAction(view.id, view.version, { cards: indexes }),
      'Outline made',
      {
        // Outlined, the post is at its outline: its screen opens (GD27, GD32).
        onDone: () => router.push(stepPath(view.id, stepOfStage('structures', false, false, true))),
        press: from,
      },
    )
  }
  const retry = failed(OUTLINE_STEP)
    ? retryCards(
        lastPick,
        blog
          ? view.current.blogOutline?.body.idea && [view.current.blogOutline.body.idea]
          : view.current.outline?.body.ideas,
        cards,
      )
    : null
  const more = () => {
    run((): Promise<Saved> => actions.moreIdeasAction(view.id, view.version), 'More ideas found', {
      press: 'more',
    })
  }
  const tick = (index: number, on: boolean) =>
    setTicked((now) =>
      on ? [...now, index].sort((a, b) => a - b) : now.filter((i) => i !== index),
    )

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-6">
      <h2 id={`${ids}-heading`} className="sr-only">
        Ideas
      </h2>
      {onBack && (
        <StepBack>
          <Button variant="outline" onClick={onBack}>
            Back to versions
          </Button>
        </StepBack>
      )}

      {framing && (
        <div className="flex max-w-prose flex-col gap-1">
          <p className="text-overline uppercase text-muted-foreground">
            {blog ? 'What this blog should say' : 'What this post should say'}
          </p>
          <p className="text-lead">{framing}</p>
        </div>
      )}

      <StepAreas
        slides={
          cards.length > 0 && (
            // Cards narrow enough that six sit in two or three rows within the step's frame.
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))] gap-3">
              {cards.map((card, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a card is its place; "More ideas" only adds after it.
                <li key={index} className="flex">
                  <IdeaCardView
                    card={card}
                    blog={blog}
                    selected={index === at}
                    gate={pickGate}
                    disabled={blocked}
                    ticked={ticked.includes(index)}
                    full={ticked.length >= COMBINE}
                    onSelect={() => setSelected(index)}
                    onTick={(on) => tick(index, on)}
                  />
                </li>
              ))}
            </ul>
          )
        }
        actions={
          <>
            {chosen && (
              <ChosenIdea
                card={chosen}
                blog={blog}
                gate={pickGate}
                disabled={blocked}
                using={pressed('use')}
                onUse={() => pick([at], 'use')}
              />
            )}
            {working && <Working words={working} />}
            {failed(IDEAS_STEP) && (
              <FailedLine words={IDEAS_FAILED} reason={view.failedReasons?.[IDEAS_STEP]} />
            )}
            {failed(OUTLINE_STEP) && (
              <FailedLine words={OUTLINE_FAILED} reason={view.failedReasons?.[OUTLINE_STEP]} />
            )}
            {retry && pickGate.shown && (
              <Control reason={pickGate.reason}>
                <Button
                  variant="outline"
                  disabled={blocked || pickGate.reason !== null}
                  onClick={() => pick(retry, 'retry')}
                >
                  {pressed('retry') && <Spin />}
                  {pressed('retry') ? 'Running…' : 'Try again'}
                </Button>
              </Control>
            )}

            {pickGate.shown && !blog && ticked.length >= 2 && (
              <Control reason={pickGate.reason}>
                <Button
                  variant="outline"
                  disabled={blocked || pickGate.reason !== null}
                  onClick={() => pick(ticked, 'combine')}
                >
                  {pressed('combine') && <Spin />}
                  {pressed('combine') ? 'Running…' : 'Combine'}
                </Button>
              </Control>
            )}

            {moreGate.shown && (
              <Control reason={moreGate.reason}>
                {running || finding ? (
                  <Button variant="outline" disabled>
                    <Spin />
                    Running…
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={pending || moreGate.reason !== null}
                    onClick={more}
                  >
                    {cards.length === 0 && failed(IDEAS_STEP) ? 'Try again' : 'More ideas'}
                  </Button>
                )}
              </Control>
            )}
          </>
        }
      />
    </section>
  )
}

/**
 * A card in the slides area, compact so six fit the step's frame: its angle, which selects it (the
 * whole card answers the click), its hook cut at three lines (the selected card's panel shows it
 * whole), then one row with the tick to combine up to four and "Recommended" when the model ranks
 * it high.
 */
function IdeaCardView(props: {
  card: IdeaCard
  /** A blog's angle: no combining. */
  blog: boolean
  /** The card whose details and "Use this idea" show beside the cards; the first until another is pressed (GD29). */
  selected: boolean
  gate: { shown: boolean; reason: string | null }
  disabled: boolean
  ticked: boolean
  /** Four are ticked already: a fifth waits, saying why. */
  full: boolean
  onSelect: () => void
  onTick: (on: boolean) => void
}) {
  const { card, gate } = props
  const ids = useId()
  const combinable = gate.shown && !props.blog
  return (
    <Blueprint
      as="article"
      aria-label={card.angle}
      aria-current={props.selected || undefined}
      className={cn(
        'flex w-full flex-col gap-3 p-3 hover:border-primary',
        props.selected && 'border-primary',
      )}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-h4">
          <button
            type="button"
            aria-pressed={props.selected}
            onClick={props.onSelect}
            className="text-left after:absolute after:inset-0 after:content-['']"
          >
            {card.angle}
          </button>
        </h3>
        <p className="line-clamp-3 text-caption">{card.hook}</p>
      </div>
      {(combinable || card.recommended) && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          {combinable && (
            <div className="relative z-10">
              <Control reason={props.full && !props.ticked ? COMBINE_FULL : null}>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`${ids}-combine`}
                    checked={props.ticked}
                    disabled={
                      props.disabled || gate.reason !== null || (props.full && !props.ticked)
                    }
                    onCheckedChange={(on) => props.onTick(on === true)}
                  />
                  <Label htmlFor={`${ids}-combine`}>Combine</Label>
                </div>
              </Control>
            </div>
          )}
          {card.recommended && <span className={cn(tag, 'ml-auto')}>Recommended</span>}
        </div>
      )}
    </Blueprint>
  )
}

/**
 * The selected card in the actions area (D1): its angle, hook, audience, format with its one-line
 * description (GD33), suggested look and length, and "Use this idea", the step's one filled button.
 */
function ChosenIdea(props: {
  card: IdeaCard
  /** A blog's angle: "Use this angle", and no look or slide count. */
  blog: boolean
  gate: { shown: boolean; reason: string | null }
  disabled: boolean
  /** "Use this idea" was pressed and its outline is being made. */
  using: boolean
  onUse: () => void
}) {
  const { card, gate } = props
  const look = templateById(card.look)?.name ?? card.look
  const format = card.format ? formatById(card.format) : null
  return (
    <Blueprint
      as="section"
      aria-label={props.blog ? 'Selected angle' : 'Selected idea'}
      className="flex flex-col gap-4 border-primary p-4"
    >
      <div className="flex flex-col gap-2">
        <p className="text-overline uppercase text-muted-foreground">
          {props.blog ? 'Selected angle' : 'Selected idea'}
        </p>
        <h3 className="text-h4">{card.angle}</h3>
        <p>{card.hook}</p>
        <p className={reasonText}>{`For: ${card.audience}`}</p>
        {format && (
          <p className={reasonText}>
            <span className="font-heading font-semibold">{format.label}</span>
            {` · ${format.description}`}
          </p>
        )}
        {!props.blog && <p className={reasonText}>{`${look} · ${card.slides} slides`}</p>}
      </div>
      {gate.shown && (
        <Control reason={gate.reason}>
          <Button disabled={props.disabled || gate.reason !== null} onClick={props.onUse}>
            {props.using && <Spin />}
            {props.using ? 'Running…' : props.blog ? 'Use this angle' : 'Use this idea'}
          </Button>
        </Control>
      )}
    </Blueprint>
  )
}

'use client'

import { type ReactNode, useId } from 'react'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { Spin, Working } from '@/shared/components/Working'
import { cn } from '@/shared/lib/utils'
import { layoutIn, layoutOptions } from '../../../layout/relayout'
import type { FailureReason } from '../../../lib/failure'
import { paragraphSite } from '../../../lib/sites'
import type { Box, ClaimResult, Fact, FitCheck, LayoutId } from '../../../model/types'
import { TEXT_NUDGES } from '../../../nudges'
import { findSlideSpec, isLook } from '../../../templates'
import { EditableSlidePreview, type EditableSlot } from '../../EditableSlidePreview'
import { FactNumber } from '../../FactChip'
import { LayoutPicker } from '../../LayoutPicker'
import { Control, FailedLine, movesWait, reasonText } from '../../parts'
import { CANVAS_HEIGHT, SlidePreview } from '../../SlidePreview'
import { isLong, SlotField } from '../../SlotField'
import { SlideStage } from '../../stage'
import type { WorkbenchView } from '../../Workbench'
import {
  attentionOf,
  countOf,
  type Gate,
  type Item,
  slideFacts,
  slideName,
  slideStep,
  wordsOf,
} from './shared'

const TAKE_FAILED = 'Another take failed. Your slide is kept.'
const NUDGE_FAILED = 'Redrafting failed. Your slide is kept.'

/** The selected slide, within the version's slides. */
const shownSlide = (item: Item, selected: number) =>
  Math.min(selected, item.structure.slides.length)

export type ChosenSlidesProps = {
  view: WorkbenchView
  draftsId: string
  index: number
  item: Item
  themeId: string
  pending: boolean
  editGate: Gate
  /** The selected slide and its setter, held above the screen's key (Workbench, GD24). */
  selected: number
  onSelect: (slide: number) => void
  onEdit: (slide: number, slot: string, text: string) => void
  /** The fit rows a slot would have with the text being typed (criterion 98), or null. */
  onMeasure: (slide: number, slot: string, text: string) => Promise<FitCheck[] | null>
  /**
   * The places slide `n` is edited in, when they are not its template's text slots (a comic
   * panel's planned scene, RC2): the slide is edited in place when there is one.
   */
  slotsOf?: (n: number) => EditableSlot[]
}

/** Where the version's slides are drawn from: the preview route, by the drafts and the theme. */
const draftOf = (props: ChosenSlidesProps) => ({
  postId: props.view.id,
  draftsId: props.draftsId,
  index: props.index,
  themeId: props.themeId,
})

/**
 * Slide `n` large: edited in place where the viewer may edit it (criterion 98), else drawn as it
 * is. Its hotspots follow its text where the layout moved it down (Postcard's card).
 */
function LargeSlide({ n, ...props }: ChosenSlidesProps & { n: number }) {
  const { view, index, item, pending } = props
  const slide = item.structure.slides[n - 1]
  if (!slide) return null
  const draft = draftOf(props)
  const specs = findSlideSpec(item.template, slide)?.slots ?? []
  const own = props.slotsOf?.(n)
  const editable = own ? own.length > 0 : props.editGate.shown && props.editGate.reason === null
  const shift = view.draftShifts?.[index]?.[n - 1] ?? 0
  const placed = (box: Box): Box => {
    const y = box.y + shift
    return { ...box, y, h: Math.max(1, Math.min(box.h, CANVAS_HEIGHT - y)) }
  }
  if (!editable) return <SlidePreview slide={n} draft={draft} text={wordsOf(item, slide)} />
  return (
    <EditableSlidePreview
      key={n}
      slide={n}
      draft={draft}
      text={wordsOf(item, slide)}
      disabled={pending}
      slots={
        own?.map((s) => ({ ...s, box: placed(s.box) })) ??
        specs.flatMap((spec) => {
          const slot = slide.slots[spec.key]
          return slot
            ? [{ key: spec.key, label: spec.label, box: placed(spec.box), text: slot.text }]
            : []
        })
      }
      onSave={(slot, value) => props.onEdit(n, slot, value)}
      measure={(slot, value) => props.onMeasure(n, slot, value)}
    />
  )
}

/**
 * The picked version's slides, in the slides area (GD30): a film strip of its slides, numbered
 * with their layout, and the selected slide large, edited in place (criterion 98).
 */
export function ChosenSlides(props: ChosenSlidesProps) {
  const { item } = props
  const slides = item.structure.slides
  const n = shownSlide(item, props.selected)
  if (!slides[n - 1]) return null
  const draft = draftOf(props)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ol
        aria-label="Slides"
        className="-m-1 grid grid-flow-col auto-cols-[6rem] gap-2 overflow-x-auto p-1"
      >
        {slides.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position in the draft.
          <li key={i}>
            <button
              type="button"
              aria-label={`Slide ${i + 1} · ${slideName(item, s)}`}
              aria-pressed={i + 1 === n}
              onClick={() => props.onSelect(i + 1)}
              className={cn(
                'flex w-full flex-col gap-1 border border-transparent p-1 text-left text-caption hover:border-primary',
                i + 1 === n && 'border-primary',
              )}
            >
              <SlidePreview slide={i + 1} draft={draft} text={wordsOf(item, s)} />
              <span className="truncate">{`${i + 1} · ${slideName(item, s)}`}</span>
            </button>
          </li>
        ))}
      </ol>
      <LargeSlide {...props} n={n} />
    </div>
  )
}

/**
 * The picked version's slides as the slide steps show them (SlideStage): the selected one large,
 * edited in place where the viewer may (criterion 98), its number and layout under it, and the
 * filmstrip of the version's slides below. The selection is counted from 1, as Workbench holds it.
 */
export function ChosenStage(props: ChosenSlidesProps) {
  const { item } = props
  const slides = item.structure.slides
  const n = shownSlide(item, props.selected)
  const slide = slides[n - 1]
  if (!slide) return null
  const draft = draftOf(props)
  const drawn = slides.map((s, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position in the draft.
    <SlidePreview key={i} slide={i + 1} draft={draft} text={wordsOf(item, s)} />
  ))
  return (
    <SlideStage
      slides={drawn.map((shown, i) =>
        // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position in the draft.
        i + 1 === n ? <LargeSlide key={i} {...props} n={n} /> : shown,
      )}
      thumbs={drawn}
      selected={n - 1}
      onSelect={(i) => props.onSelect(i + 1)}
      below={<p className={reasonText}>{`${n} · ${slideName(item, slide)}`}</p>}
    />
  )
}

export type ChosenVersionProps = {
  /** The selected slide, held above the screen's key (Workbench, GD24). */
  selected: number
  view: WorkbenchView
  item: Item
  facts: Fact[]
  pending: boolean
  /** The slide and chip of a slide chip pressed and running, and which (`via`), or null. */
  rewriting?: { slide?: number; nudge?: string; via?: 'shorten' | 'chip' } | null
  /** The slide whose "Another take" was pressed and is running, or null. */
  taking?: number | null
  /** Its source check's results, for the slots that need attention. */
  claims: ClaimResult[]
  takeGate: Gate
  nudgeGate: Gate
  layoutGate: Gate
  editGate: Gate
  /** The last edit's refusal and the slot it was for, said under that slot's field, or null. */
  editError: { slide: number; slot: string; error: string } | null
  /** The version's look switch and text chips (VersionControls), or null. */
  controls: ReactNode
  onEdit: (slide: number, slot: string, text: string) => void
  onTake: (slide: number) => void
  /** A slide chip, or "Shorten it" (`via` says which was pressed, so only it waits). */
  onNudge: (slide: number, nudge: string, label: string, via: 'shorten' | 'chip') => void
  onLayout: (slide: number, layout: LayoutId) => void
}

/**
 * The picked version, before the gate (GD24), in the actions area's "Your version" tab beside its
 * slides (GD30): its look switch, then the selected slide's text in fields with live counts, saved
 * when left changed (C1), and its fact chips, a look slide's text chips (GD10) and layouts (GD5), or
 * an old template's "Another take" (criterion 99). Its checks and their fixes are in the "Checks"
 * tab, and the other versions in "Versions" (17 Oct).
 */
export function ChosenVersion(props: ChosenVersionProps) {
  const { view, item, facts, pending } = props
  const ids = useId()
  const rewriting = props.rewriting ?? null
  const slides = item.structure.slides
  const look = isLook(item.template)
  const n = shownSlide(item, props.selected)
  const slide = slides[n - 1]
  if (!slide) return null
  const specs = findSlideSpec(item.template, slide)?.slots ?? []
  const step = slideStep(n)
  const running = view.running.includes(step)
  const failed = !running && (view.failed?.includes(step) ?? false)
  // A chip under this slide pressed and running, before the polled step names it.
  const chipRunning = !running && rewriting?.via === 'chip' && rewriting.slide === n
  const attention = attentionOf(item, facts, props.claims)
  const chips = slideFacts(slide, facts)
  const source = view.current.source?.body

  return (
    <Blueprint
      as="section"
      aria-labelledby={`${ids}-heading`}
      className="flex min-w-0 flex-col gap-6 border-primary p-4"
    >
      <div className="flex flex-col gap-1">
        <h3 id={`${ids}-heading`} className="text-h4">
          Your version
        </h3>
        <p className={reasonText}>{item.angle || item.template.name}</p>
      </div>

      {props.controls}

      <fieldset aria-label={`Slide ${n} text`} className="flex min-w-0 flex-col gap-3">
        {specs.flatMap((spec) => {
          const slot = slide.slots[spec.key]
          if (!slot) return []
          const error = props.editError
          return [
            <SlotField
              key={`${n}:${spec.key}`}
              label={spec.label}
              value={slot.text}
              long={isLong(spec.limit)}
              disabled={pending || props.editGate.reason !== null}
              count={(text) => countOf(text, spec.limit)}
              note={attention.get(`${n}:${spec.key}`)}
              error={error?.slide === n && error.slot === spec.key ? error.error : null}
              onSave={(text) => props.onEdit(n, spec.key, text)}
            />,
          ]
        })}
      </fieldset>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((fact) => (
            <FactNumber
              key={fact.id}
              fact={fact}
              sourceTitle={source?.title ?? ''}
              site={source ? paragraphSite(source, fact.ref) : null}
              checkedAt={view.createdAt}
            />
          ))}
        </div>
      )}

      {look && props.nudgeGate.shown && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-overline uppercase text-muted-foreground">
            {`Change slide ${n}`}
          </legend>
          {failed && <FailedLine words={NUDGE_FAILED} reason={view.failedReasons?.[step]} />}
          {running && <Working words={movesWait([step]) ?? ''} />}
          {chipRunning && <Working words="Rewriting this slide…" />}
          <Control reason={props.nudgeGate.reason}>
            {TEXT_NUDGES.map((nudge) => (
              <Button
                key={nudge.id}
                variant="outline"
                size="sm"
                aria-label={`${nudge.label} · Slide ${n}`}
                disabled={pending || running || props.nudgeGate.reason !== null}
                onClick={() => props.onNudge(n, nudge.id, nudge.label, 'chip')}
              >
                {chipRunning && rewriting?.nudge === nudge.id && <Spin />}
                {nudge.label}
              </Button>
            ))}
          </Control>
        </fieldset>
      )}

      {look && props.layoutGate.shown && (
        <div className="flex flex-col gap-2">
          <LayoutPicker
            slide={n}
            options={layoutOptions(slide, facts, { first: n === 1, last: n === slides.length })}
            current={layoutIn(slide)}
            disabled={pending || props.layoutGate.reason !== null}
            onChoose={(layout) => props.onLayout(n, layout)}
          />
          {props.layoutGate.reason && <p className={reasonText}>{props.layoutGate.reason}</p>}
        </div>
      )}

      {!look && props.takeGate.shown && (
        <AnotherTake
          slide={n}
          running={running}
          taking={props.taking === n}
          failed={failed}
          failedReason={view.failedReasons?.[step]}
          reason={props.takeGate.reason}
          pending={pending}
          onTake={props.onTake}
        />
      )}
    </Blueprint>
  )
}

/**
 * "Another take" under one slide (criterion 99): "Running…" while the model rewords it; when the
 * last take failed, the slide is kept and the button reads "Try again".
 */
function AnotherTake(props: {
  slide: number
  running: boolean
  /** This take was pressed and is running, before the polled step names it. */
  taking: boolean
  failed: boolean
  failedReason?: FailureReason
  reason: string | null
  pending: boolean
  onTake: (slide: number) => void
}) {
  const { slide, running, taking, failed, reason, pending } = props
  return (
    <div className="flex flex-col gap-1">
      {failed && !running && !taking && (
        <FailedLine words={TAKE_FAILED} reason={props.failedReason} />
      )}
      <Control reason={reason}>
        {running || taking ? (
          <>
            <Button variant="outline" size="sm" disabled>
              <Spin />
              Running…
            </Button>
            <Working
              words={running ? (movesWait([slideStep(slide)]) ?? '') : 'Writing another take…'}
            />
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            aria-label={`${failed ? 'Try again' : 'Another take'} · Slide ${slide}`}
            disabled={pending || reason !== null}
            onClick={() => props.onTake(slide)}
          >
            {failed ? 'Try again' : 'Another take'}
          </Button>
        )}
      </Control>
    </div>
  )
}

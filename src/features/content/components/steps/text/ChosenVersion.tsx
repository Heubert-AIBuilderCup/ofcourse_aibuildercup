'use client'

import { type ReactNode, useId } from 'react'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { layoutIn, layoutOptions } from '../../../layout/relayout'
import { paragraphSite } from '../../../lib/sites'
import { type VersionStatus, versionLetter } from '../../../lib/version-status'
import type { Box, ClaimResult, Fact, FitCheck, LayoutId } from '../../../model/types'
import { TEXT_NUDGES } from '../../../nudges'
import { findSlideSpec, isLook, slideFitsAt } from '../../../templates'
import { EditableSlidePreview, type EditableSlot } from '../../EditableSlidePreview'
import { FactNumber } from '../../FactChip'
import { LayoutPicker } from '../../LayoutPicker'
import { Control, movesWait, reasonText, Spin, tag, Working } from '../../parts'
import { CANVAS_HEIGHT, SlidePreview } from '../../SlidePreview'
import { isLong, SlotField } from '../../SlotField'
import type { WorkbenchView } from '../../Workbench'
import {
  attentionOf,
  countOf,
  type Gate,
  type Item,
  slideFacts,
  slideName,
  slideStep,
  statusText,
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

/**
 * The picked version's slides, in the slides area (GD30): a film strip of its slides, numbered
 * with their layout, and the selected slide large, edited in place (criterion 98).
 */
export function ChosenSlides(props: ChosenSlidesProps) {
  const { view, draftsId, index, item, themeId, pending } = props
  const slides = item.structure.slides
  const n = shownSlide(item, props.selected)
  const slide = slides[n - 1]
  if (!slide) return null
  const draft = { postId: view.id, draftsId, index, themeId }
  const specs = findSlideSpec(item.template, slide)?.slots ?? []
  const own = props.slotsOf?.(n)
  const editable = own ? own.length > 0 : props.editGate.shown && props.editGate.reason === null
  // Where the layout moved the slide's text down (Postcard's card), its hotspots move with it.
  const shift = view.draftShifts?.[index]?.[n - 1] ?? 0
  const placed = (box: Box): Box => {
    const y = box.y + shift
    return { ...box, y, h: Math.max(1, Math.min(box.h, CANVAS_HEIGHT - y)) }
  }

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

      {editable ? (
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
      ) : (
        <SlidePreview slide={n} draft={draft} text={wordsOf(item, slide)} />
      )}
    </div>
  )
}

export type ChosenVersionProps = {
  /** The selected slide, held above the screen's key (Workbench, GD24). */
  selected: number
  view: WorkbenchView
  draftsId: string
  item: Item
  /** Every other version, by its place in the drafts, for "Use here" (GD11). */
  others: { item: Item; index: number }[]
  facts: Fact[]
  themeId: string
  pending: boolean
  /** Its status (lib/version-status.ts): the problems, each with its fix where one exists. */
  status: VersionStatus
  /** Its source check's results, for the slots that need attention. */
  claims: ClaimResult[]
  /** Its "Details", which "See checks" opens. */
  details: ReactNode
  takeGate: Gate
  nudgeGate: Gate
  layoutGate: Gate
  useGate: Gate
  editGate: Gate
  /** The last edit's refusal and the slot it was for, said under that slot's field, or null. */
  editError: { slide: number; slot: string; error: string } | null
  /** The version's look switch and text chips (VersionControls), or null. */
  controls: ReactNode
  onEdit: (slide: number, slot: string, text: string) => void
  onTake: (slide: number) => void
  onNudge: (slide: number, nudge: string, label: string) => void
  onLayout: (slide: number, layout: LayoutId) => void
  onUseSlide: (from: number, slide: number) => void
}

/**
 * The picked version, before the gate (GD24), in the actions area beside its slides (GD30): its
 * status and problems, "Shorten it" on a slot whose words do not fit (GD22), then the selected
 * slide's text in fields with live counts, saved when left changed (C1), and its fact chips, a
 * look slide's text chips (GD10) and layouts (GD5), or an old template's "Another take" (criterion 99), and the same slide of the other
 * versions with "Use here" (GD11), disabled with the reason when it cannot go in this version.
 * Then its "Details".
 */
export function ChosenVersion(props: ChosenVersionProps) {
  const { view, draftsId, item, facts, themeId, pending } = props
  const ids = useId()
  const slides = item.structure.slides
  const look = isLook(item.template)
  const n = shownSlide(item, props.selected)
  const slide = slides[n - 1]
  if (!slide) return null
  const specs = findSlideSpec(item.template, slide)?.slots ?? []
  const step = slideStep(n)
  const running = view.running.includes(step)
  const failed = !running && (view.failed?.includes(step) ?? false)
  const attention = attentionOf(item, facts, props.claims)
  const chips = slideFacts(slide, facts)
  const source = view.current.source?.body
  const others = props.others.flatMap(({ item: other, index: from }) => {
    const taken = other.structure.slides[n - 1]
    if (!taken) return []
    const reason = slideFitsAt(item.template, taken, slide)
      ? null
      : `Slide ${n} of version ${versionLetter(from)} does not fit this version.`
    return [{ other, from, taken, reason }]
  })

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

      <div className="flex flex-col gap-2">
        <span
          className={cn(
            tag,
            'self-start',
            !props.status.ready && 'border-destructive text-destructive',
          )}
        >
          {statusText(props.status)}
        </span>
        {props.status.problems.length > 0 && (
          <ul className="flex flex-col gap-2">
            {props.status.problems.map((problem) => {
              const fix = problem.fix
              const busy = fix ? view.running.includes(slideStep(fix.slide)) : false
              return (
                <li key={problem.text} className="flex flex-wrap items-center gap-3">
                  <span className="text-caption text-destructive wrap-anywhere">
                    {problem.text}
                  </span>
                  {fix && props.nudgeGate.shown && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || busy || props.nudgeGate.reason !== null}
                      onClick={() => props.onNudge(fix.slide, fix.nudge, 'Shorter')}
                    >
                      Shorten it
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
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
          {failed && <p className={reasonText}>{NUDGE_FAILED}</p>}
          {running && <Working words={movesWait([step]) ?? ''} />}
          <Control reason={props.nudgeGate.reason}>
            {TEXT_NUDGES.map((nudge) => (
              <Button
                key={nudge.id}
                variant="outline"
                size="sm"
                aria-label={`${nudge.label} · Slide ${n}`}
                disabled={pending || running || props.nudgeGate.reason !== null}
                onClick={() => props.onNudge(n, nudge.id, nudge.label)}
              >
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
          failed={failed}
          reason={props.takeGate.reason}
          pending={pending}
          onTake={props.onTake}
        />
      )}

      {props.useGate.shown && others.length > 0 && (
        <section aria-labelledby={`${ids}-others`} className="flex flex-col gap-2">
          <h4 id={`${ids}-others`} className="text-overline uppercase text-muted-foreground">
            From the other versions
          </h4>
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-4">
            {others.map(({ other, from, taken, reason }) => (
              <li key={from} className="flex flex-col gap-2">
                <SlidePreview
                  slide={n}
                  draft={{ postId: view.id, draftsId, index: from, themeId }}
                  text={wordsOf(other, taken)}
                />
                <span className={reasonText}>{`Version ${versionLetter(from)}`}</span>
                <Control reason={props.useGate.reason ?? reason}>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Use slide ${n} of version ${versionLetter(from)} in my version`}
                    disabled={pending || (props.useGate.reason ?? reason) !== null}
                    onClick={() => props.onUseSlide(from, n)}
                  >
                    Use here
                  </Button>
                </Control>
              </li>
            ))}
          </ul>
        </section>
      )}

      {props.details}
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
  failed: boolean
  reason: string | null
  pending: boolean
  onTake: (slide: number) => void
}) {
  const { slide, running, failed, reason, pending } = props
  return (
    <div className="flex flex-col gap-1">
      {failed && !running && <p className={reasonText}>{TAKE_FAILED}</p>}
      <Control reason={reason}>
        {running ? (
          <>
            <Button variant="outline" size="sm" disabled>
              <Spin />
              Running…
            </Button>
            <Working words={movesWait([slideStep(slide)]) ?? ''} />
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

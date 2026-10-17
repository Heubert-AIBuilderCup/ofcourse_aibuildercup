'use client'

import { useRouter } from 'next/navigation'
import { type KeyboardEvent, useId, useState } from 'react'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Textarea } from '@/shared/components/ui/textarea'
import { Spin, Working } from '@/shared/components/Working'
import type { Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import { formatById, rankedFormats } from '../../formats'
import { LAYOUT_LABELS } from '../../layout/relayout'
import {
  BLOG_POINT_MAX,
  BLOG_SECTIONS,
  type BlogOutlineOp,
  type BlogSection,
  editBlogSections,
  HEADING_MAX,
} from '../../lib/blog-outline'
import {
  editOutline,
  JOB_LABELS,
  type OutlineOp,
  orderRule,
  outlineParts,
  outlineRange,
} from '../../lib/outline'
import { stepOfStage, stepPath } from '../../lib/steps'
import { editWaitError, type PostAction, WORKFLOW_ERRORS } from '../../lib/workflow'
import {
  LAYOUT_IDS,
  type LayoutId,
  OUTLINE_JOBS,
  type OutlineJob,
  type OutlineSlide,
  POINT_MAX,
} from '../../model/types'
import { templateById } from '../../templates'
import { firstChars } from '../../text/script'
import {
  Control,
  FailedLine,
  movesWait,
  ReorderButtons,
  reasonText,
  StepAction,
  StepAreas,
} from '../parts'
import { usePostAction, usePressedAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'

export type OutlineStepProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<WorkbenchActions, 'editOutlineAction' | 'writeSlidesAction' | 'outlineFormatAction'>
}

/** The step "Write the slides" drafts in, as every draft does. */
const DRAFT_STEP = 'draft'
const DRAFT_FAILED = 'Drafting failed. Your outline is kept.'
/** The step a changed format is outlined in (server/commands/ideas.ts OUTLINE_STEP). */
const OUTLINE_STEP = 'outline'
const OUTLINE_FAILED = 'Outlining failed. Your outline is kept.'

/** Why an outline change is refused (lib/outline.ts editOutline), or null when the look takes it. */
type Check = (op: OutlineOp) => string | null

/**
 * The picked idea's outline (GD32): a row per slide with its job, layout and point, each changed
 * in place, moved, or removed, a slide added before the takeaway, and beside them the look, the
 * format and the idea, then "Write the slides", which drafts three versions to the outline. The
 * format is one of the ten, the model's top three first and marked "Recommended", with its
 * description; choosing another outlines the idea again in it (GD33). A change the look would not
 * take is disabled, with why said once below the rows. While the slides are written or the
 * outline made again the step says so in words and every control waits; a failed draft or
 * outline offers "Try again". Each control asks editWaitError, so at a passed step it waits while
 * any step runs (criterion 122); a viewer who may not edit sees the outline only.
 */
export function OutlineStep({ view, viewer, actions }: OutlineStepProps) {
  // Which press is running, so only its control waits as "Running…" with its words beside it.
  const { pending, run, error, pressed } = usePressedAction<'write' | 'format' | 'retry' | 'edit'>()
  const router = useRouter()
  const ids = useId()
  const [newPoint, setNewPoint] = useState('')
  // The format chosen last on this page, for a failed outline's "Try again".
  const [lastFormat, setLastFormat] = useState<string | null>(null)
  const outline = view.current.outline?.body ?? null
  const template = outline ? templateById(outline.ideas[0].look) : null
  const running = view.running.includes(DRAFT_STEP) || view.running.includes(OUTLINE_STEP)
  const waiting = running ? movesWait(view.running, view.progress) : null
  const failed = !running && (view.failed?.includes(DRAFT_STEP) ?? false)
  const outlineFailed = !running && (view.failed?.includes(OUTLINE_STEP) ?? false)

  // At a passed step every control waits while any step of the post runs (criterion 122).
  const anyRunning = movesWait(view.running, view.progress)
  const gate = (action: PostAction) => {
    const reason = editWaitError(action, viewer, view.stage, anyRunning)
    return { shown: reason !== WORKFLOW_ERRORS.notAuthorised, reason }
  }
  const editGate = gate('editOutline')
  const writeGate = gate('writeSlides')
  const blocked = pending || running

  if (!outline || !template) {
    return (
      <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-8">
        <h2 id={`${ids}-heading`} className="sr-only">
          Outline
        </h2>
        <p className={reasonText}>No outline for these facts. Pick an idea to outline it.</p>
      </section>
    )
  }

  const { slides } = outline
  const check: Check = (op) => {
    const edited = editOutline(template, slides, op)
    return edited.ok ? null : edited.error
  }
  const edit = (op: OutlineOp) => {
    run(() => actions.editOutlineAction(view.id, view.version, op), 'Outline changed', {
      press: 'edit',
    })
  }
  const reformat = (format: string, from: 'format' | 'retry') => {
    setLastFormat(format)
    run(() => actions.outlineFormatAction(view.id, view.version, format), 'Outlined again', {
      press: from,
    })
  }
  const formats = rankedFormats(view.current.ideas?.body.formats)
  const chosen = outline.format ? formatById(outline.format) : null
  const write = () => {
    run(() => actions.writeSlidesAction(view.id, view.version), 'Versions drafted', {
      // Drafted, the post is at its text versions: their screen opens (GD27).
      onDone: () => router.push(stepPath(view.id, stepOfStage('structures', false))),
      press: 'write',
    })
  }
  // The press's own words while it runs; the polled step's once it is running.
  const reshaping = pressed('format') || pressed('retry')
  const working = reshaping ? 'Reshaping the outline…' : pressed('write') ? null : waiting

  // A slide added goes before the takeaway, in the look's first middle layout.
  const middle =
    LAYOUT_IDS.find((id) => template.layouts?.[id]?.kind === 'body') ?? ('picture' as LayoutId)
  const add: OutlineOp = {
    op: 'add',
    at: slides.length,
    slide: { job: 'point', layout: middle, point: newPoint },
  }
  const addReason = check({ ...add, slide: { ...add.slide, point: 'A point.' } })

  // Why a row's move or removal is off, said once for every row it holds back.
  const reasons = new Set<string>()
  if (editGate.shown) {
    slides.forEach((_, i) => {
      const n = i + 1
      const ops: OutlineOp[] = [{ op: 'remove', slide: n }]
      if (n > 1) ops.push({ op: 'move', slide: n, to: n - 1 })
      if (n < slides.length) ops.push({ op: 'move', slide: n, to: n + 1 })
      for (const op of ops) {
        const reason = check(op)
        if (reason) reasons.add(reason)
      }
    })
  }
  // The groups show the look's order, so its rule is not said; a slide out of it is.
  reasons.delete(orderRule(template))
  const { parts, outOfPlace } = outlineParts(template, slides)
  if (outOfPlace) reasons.add(outOfPlace)
  const { min, max } = outlineRange(template)
  const angles = outline.ideas.map((c) => c.angle).join(' + ')

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-8">
      <h2 id={`${ids}-heading`} className="sr-only">
        Outline
      </h2>

      <StepAreas
        slides={
          <>
            {error && <p className={reasonText}>{error}</p>}
            <div className="flex flex-col gap-6">
              {parts.map((part) => (
                <div key={part.slides[0].n} className="flex flex-col gap-1">
                  <h3
                    id={`${ids}-part-${part.slides[0].n}`}
                    className="text-overline text-muted-foreground"
                  >
                    {part.heading}
                  </h3>
                  <ol
                    aria-labelledby={`${ids}-part-${part.slides[0].n}`}
                    className="flex flex-col divide-y divide-border"
                  >
                    {part.slides.map(({ n, slide }) => (
                      <OutlineRow
                        // A row is its place; every change saves a new outline and keys the screen again.
                        key={n}
                        slide={slide}
                        n={n}
                        total={slides.length}
                        editable={editGate.shown}
                        disabled={blocked || editGate.reason !== null}
                        check={check}
                        onEdit={edit}
                      />
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            {reasons.size > 0 && (
              <ul className="flex flex-col gap-1">
                {[...reasons].map((reason) => (
                  <li key={reason} className={reasonText}>
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </>
        }
        actions={
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className={reasonText}>Look</dt>
              <dd>{template.name}</dd>
              {!editGate.shown && (
                <>
                  <dt className={reasonText}>Format</dt>
                  <dd>{chosen?.label ?? 'None chosen'}</dd>
                </>
              )}
              <dt className={reasonText}>{outline.ideas.length > 1 ? 'Ideas' : 'Idea'}</dt>
              <dd>{angles}</dd>
              <dt className={reasonText}>Slides</dt>
              <dd>{`${slides.length} of ${min} to ${max}`}</dd>
            </dl>
            {editGate.shown && (
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${ids}-format`}>Format</Label>
                <Control reason={editGate.reason}>
                  <NativeSelect
                    id={`${ids}-format`}
                    value={outline.format ?? ''}
                    disabled={blocked || editGate.reason !== null}
                    onChange={(e) => reformat(e.target.value, 'format')}
                  >
                    {chosen === null && <option value="">Choose a format</option>}
                    {formats.map(({ format, recommended }) => (
                      <option key={format.id} value={format.id}>
                        {recommended ? `${format.label} · Recommended` : format.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Control>
                {chosen && <p className={reasonText}>{chosen.description}</p>}
              </div>
            )}
            {/* Beside the rows, not under them, so the rows alone fill the slides area. */}
            {editGate.shown && (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${ids}-new`}>New slide's point</Label>
                <Control reason={addReason}>
                  <Input
                    id={`${ids}-new`}
                    className="min-w-0 flex-1"
                    value={newPoint}
                    disabled={blocked || editGate.reason !== null}
                    onChange={(e) => setNewPoint(firstChars(e.target.value, POINT_MAX))}
                  />
                  <Button
                    variant="outline"
                    disabled={
                      blocked ||
                      editGate.reason !== null ||
                      addReason !== null ||
                      newPoint.trim() === ''
                    }
                    onClick={() => edit(add)}
                  >
                    Add a slide
                  </Button>
                </Control>
              </div>
            )}
            {working && <Working words={working} />}
            {failed && (
              <FailedLine words={DRAFT_FAILED} reason={view.failedReasons?.[DRAFT_STEP]} />
            )}
            {outlineFailed && (
              <FailedLine words={OUTLINE_FAILED} reason={view.failedReasons?.[OUTLINE_STEP]} />
            )}
            {outlineFailed && lastFormat && editGate.shown && (
              <Control reason={editGate.reason}>
                <Button
                  variant="outline"
                  disabled={blocked || editGate.reason !== null}
                  onClick={() => reformat(lastFormat, 'retry')}
                >
                  {pressed('retry') && <Spin />}
                  {pressed('retry') ? 'Running…' : 'Try again'}
                </Button>
              </Control>
            )}
            {writeGate.shown && (
              <StepAction>
                {pressed('write') && (
                  <Working words="Writing three versions of the slides · this can take a minute" />
                )}
                <Control reason={writeGate.reason}>
                  <Button disabled={blocked || writeGate.reason !== null} onClick={write}>
                    {pressed('write') && <Spin />}
                    {pressed('write') ? 'Running…' : failed ? 'Try again' : 'Write the slides'}
                  </Button>
                </Control>
              </StepAction>
            )}
          </>
        }
      />
    </section>
  )
}

/**
 * One row of an outline, compact so five to eight fill the slides area without it scrolling: its
 * number, its fields in two short lines, and its moves and removal at the end.
 */
const compactRow = 'flex items-center gap-3 px-3 py-1.5'
const rowNumber = 'w-5 shrink-0 self-start pt-1 text-overline text-muted-foreground'
/** A field of a compact row: the shared Input, a line shorter. */
const compactField = 'h-7 py-1'

/** A slide's row: no frame, set apart from the next by spacing and the list's hairline. */
const slideRow = 'group flex items-start gap-3 py-2'
/**
 * The point, the row's main text: a field at body size that reads as text until pointed at or
 * focused, wraps instead of truncating, and grows as it is typed up to two lines, then scrolls.
 * The cap is two lines, its 0.5rem of padding and its two 1px hairline borders, top and bottom
 * (`field-sizing-content` ignores `rows`, so only `max-h` bounds it).
 */
const pointField =
  '-mx-2 field-sizing-content max-h-[calc(2lh+0.5rem+2px)] min-h-0 resize-none border-transparent px-2 py-1 text-base hover:border-input focus-visible:border-input'
/** Job and layout: small selects on one quiet line under the point, a hairline only when pointed at. */
const quietSelect = 'h-6 w-auto border-transparent px-1 py-0 hover:border-input'
/** The moves and removal, muted until the row is pointed at or holds the focus. */
const quietMoves =
  'text-muted-foreground group-focus-within:text-foreground group-hover:text-foreground'

/**
 * One slide of the outline: its number, then its point to edit in place (saved when the field is
 * left changed) and under it its job and layout to choose, and the moves and removal; read-only
 * to a viewer who may not edit. A layout the look would not take here is not offered.
 */
function OutlineRow(props: {
  slide: OutlineSlide
  n: number
  total: number
  editable: boolean
  disabled: boolean
  check: Check
  onEdit: (op: OutlineOp) => void
}) {
  const { slide, n, total, disabled, check, onEdit } = props
  const ids = useId()
  const [point, setPoint] = useState(slide.point)
  const layouts = LAYOUT_IDS.filter(
    (layout) => layout === slide.layout || check({ op: 'change', slide: n, layout }) === null,
  )
  const move = (to: number): OutlineOp => ({ op: 'move', slide: n, to })
  const remove: OutlineOp = { op: 'remove', slide: n }

  return (
    <li aria-label={`Slide ${n}`} className={slideRow}>
      <span aria-hidden="true" className={rowNumber}>
        {n}
      </span>
      {props.editable ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Label htmlFor={`${ids}-point`} className="sr-only">
              Point
            </Label>
            <Textarea
              id={`${ids}-point`}
              rows={2}
              className={pointField}
              value={point}
              disabled={disabled}
              onChange={(e) => setPoint(firstChars(e.target.value, POINT_MAX))}
              onKeyDown={(e) => {
                // A point is one line that wraps: Enter leaves the field, as it did on one line.
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
              onBlur={() => {
                if (point.trim() !== slide.point) onEdit({ op: 'change', slide: n, point })
              }}
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex items-center gap-1">
                <Label htmlFor={`${ids}-job`} className={reasonText}>
                  Job
                </Label>
                <NativeSelect
                  id={`${ids}-job`}
                  className={quietSelect}
                  value={slide.job}
                  disabled={disabled}
                  onChange={(e) =>
                    onEdit({ op: 'change', slide: n, job: e.target.value as OutlineJob })
                  }
                >
                  {OUTLINE_JOBS.map((job) => (
                    <option key={job} value={job}>
                      {JOB_LABELS[job]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex items-center gap-1">
                <Label htmlFor={`${ids}-layout`} className={reasonText}>
                  Layout
                </Label>
                <NativeSelect
                  id={`${ids}-layout`}
                  className={quietSelect}
                  value={slide.layout}
                  disabled={disabled}
                  onChange={(e) =>
                    onEdit({ op: 'change', slide: n, layout: e.target.value as LayoutId })
                  }
                >
                  {layouts.map((layout) => (
                    <option key={layout} value={layout}>
                      {LAYOUT_LABELS[layout]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>
          <div className={quietMoves}>
            <ReorderButtons
              name={`slide ${n}`}
              up={
                n > 1
                  ? {
                      disabled: disabled || check(move(n - 1)) !== null,
                      onClick: () => onEdit(move(n - 1)),
                    }
                  : undefined
              }
              down={
                n < total
                  ? {
                      disabled: disabled || check(move(n + 1)) !== null,
                      onClick: () => onEdit(move(n + 1)),
                    }
                  : undefined
              }
              remove={{
                disabled: disabled || check(remove) !== null,
                onClick: () => onEdit(remove),
              }}
            />
          </div>
        </>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p>{slide.point}</p>
          <p className={reasonText}>
            {`${JOB_LABELS[slide.job]} · ${LAYOUT_LABELS[slide.layout]}`}
          </p>
        </div>
      )}
    </li>
  )
}

export type BlogOutlineStepProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<WorkbenchActions, 'editBlogOutlineAction' | 'writeBlogAction'>
}

/** The step a blog's text is written in (server/commands/blog.ts BLOG_TEXT_STEP). */
const BLOG_TEXT_STEP = 'blog_text'
const WRITE_FAILED = 'Writing failed. Your outline is kept.'

/** Why a change to the sections is refused (lib/blog-outline.ts editBlogSections), or null. */
type SectionCheck = (op: BlogOutlineOp) => string | null

/**
 * A blog's outline (BR2): its sections as a list, each a question-style heading and the one point
 * it makes, reworded in place (saved when the field is left changed; a heading that is not a
 * question is refused beside it), moved up or down, or removed; beside them the angle, the fields
 * that add a section at the end, "Write the blog", which writes the text in the background (the
 * step shows it in words, and a failed writing offers "Try again"), then the key takeaways and the
 * FAQ the blog ends with. A change the outline would not take is disabled, with why said once
 * below the list. Each control asks editWaitError, so at a passed step it waits while any step
 * runs (criterion 122), and a change there moves the blog back to its outline (GD28); a viewer who
 * may not edit sees the outline only.
 */
export function BlogOutlineStep({ view, viewer, actions }: BlogOutlineStepProps) {
  const { pending, run, error } = usePostAction()
  const ids = useId()
  const [newHeading, setNewHeading] = useState('')
  const [newPoint, setNewPoint] = useState('')
  const outline = view.current.blogOutline?.body ?? null
  const running = view.running.includes(BLOG_TEXT_STEP) || view.running.includes(OUTLINE_STEP)
  const waiting = running ? movesWait(view.running, view.progress) : null
  const failed = !running && (view.failed?.includes(BLOG_TEXT_STEP) ?? false)

  const anyRunning = movesWait(view.running, view.progress)
  const gate = (action: PostAction) => {
    const reason = editWaitError(action, viewer, view.stage, anyRunning)
    return { shown: reason !== WORKFLOW_ERRORS.notAuthorised, reason }
  }
  const editGate = gate('editBlogOutline')
  const writeGate = gate('writeBlog')
  const blocked = pending || running

  if (!outline) {
    return (
      <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-8">
        <h2 id={`${ids}-heading`} className="sr-only">
          Outline
        </h2>
        <p className={reasonText}>No outline for these facts. Pick an angle to outline it.</p>
      </section>
    )
  }

  const { sections, takeaways, faq } = outline
  const check: SectionCheck = (op) => {
    const edited = editBlogSections(sections, op, view.current.source?.body.language)
    return edited.ok ? null : edited.error
  }
  const edit = (op: BlogOutlineOp) =>
    run(() => actions.editBlogOutlineAction(view.id, view.version, op), 'Outline changed')
  const write = () => run(() => actions.writeBlogAction(view.id, view.version), 'Writing the blog')

  const add: BlogOutlineOp = {
    op: 'add',
    at: sections.length + 1,
    section: { heading: newHeading, point: newPoint },
  }
  const filled = newHeading.trim() !== '' && newPoint.trim() !== ''
  // At eight sections the add is refused whatever is typed; otherwise once both are typed.
  const addReason = filled
    ? check(add)
    : check({ ...add, section: { heading: 'A section?', point: 'A point.' } })

  // Why a section's removal is off, said once for every section it holds back.
  const reasons = new Set<string>()
  if (editGate.shown) {
    sections.forEach((_, i) => {
      const reason = check({ op: 'remove', section: i + 1 })
      if (reason) reasons.add(reason)
    })
  }

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-8">
      <h2 id={`${ids}-heading`} className="sr-only">
        Outline
      </h2>

      <StepAreas
        slides={
          <>
            {error && <p className={reasonText}>{error}</p>}
            <ol className="flex flex-col gap-1.5">
              {sections.map((section, i) => (
                <SectionRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: a row is its place; every change saves a new outline and keys the screen again.
                  key={i}
                  section={section}
                  n={i + 1}
                  total={sections.length}
                  editable={editGate.shown}
                  disabled={blocked || editGate.reason !== null}
                  check={check}
                  onEdit={edit}
                />
              ))}
            </ol>
            {reasons.size > 0 && (
              <ul className="flex flex-col gap-1">
                {[...reasons].map((reason) => (
                  <li key={reason} className={reasonText}>
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </>
        }
        actions={
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              {outline.idea && (
                <>
                  <dt className={reasonText}>Angle</dt>
                  <dd>{outline.idea.angle}</dd>
                </>
              )}
              <dt className={reasonText}>Sections</dt>
              <dd>{`${sections.length} of ${BLOG_SECTIONS.min} to ${BLOG_SECTIONS.max}`}</dd>
            </dl>
            {/* Beside the sections, not under them, so the sections alone fill the slides area. */}
            {editGate.shown && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${ids}-new-heading`}>New section's heading</Label>
                  <Input
                    id={`${ids}-new-heading`}
                    value={newHeading}
                    placeholder="A question a student asks?"
                    disabled={blocked || editGate.reason !== null}
                    onChange={(e) => setNewHeading(firstChars(e.target.value, HEADING_MAX))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${ids}-new-point`}>New section's point</Label>
                  <Input
                    id={`${ids}-new-point`}
                    value={newPoint}
                    disabled={blocked || editGate.reason !== null}
                    onChange={(e) => setNewPoint(firstChars(e.target.value, BLOG_POINT_MAX))}
                  />
                </div>
                <Control reason={addReason}>
                  <Button
                    variant="outline"
                    disabled={blocked || editGate.reason !== null || !filled || addReason !== null}
                    onClick={() => edit(add)}
                  >
                    Add a section
                  </Button>
                </Control>
              </div>
            )}
            {waiting && <Working words={waiting} />}
            {failed && (
              <FailedLine words={WRITE_FAILED} reason={view.failedReasons?.[BLOG_TEXT_STEP]} />
            )}
            {writeGate.shown && (
              <Control reason={writeGate.reason}>
                <Button disabled={blocked || writeGate.reason !== null} onClick={write}>
                  {failed ? 'Try again' : 'Write the blog'}
                </Button>
              </Control>
            )}
            <div className="flex max-w-prose flex-col gap-2">
              <h3 className="text-h4">Key takeaways</h3>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {takeaways.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="flex max-w-prose flex-col gap-2">
              <h3 className="text-h4">FAQ</h3>
              <dl className="flex flex-col gap-3">
                {faq.map((f) => (
                  <div key={f.q} className="flex flex-col gap-1">
                    <dt className="font-heading">{f.q}</dt>
                    <dd className={reasonText}>{f.point}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        }
      />
    </section>
  )
}

/**
 * One section of a blog's outline, on one compact card: its number, its heading and under it its
 * point to edit in place (saved when the field is left changed, or refused under them), and its
 * moves and removal; read-only to a viewer who may not edit.
 */
function SectionRow(props: {
  section: BlogSection
  n: number
  total: number
  editable: boolean
  disabled: boolean
  check: SectionCheck
  onEdit: (op: BlogOutlineOp) => void
}) {
  const { section, n, total, disabled, check, onEdit } = props
  const ids = useId()
  const [heading, setHeading] = useState(section.heading)
  const [point, setPoint] = useState(section.point)
  const [refusal, setRefusal] = useState<string | null>(null)
  const reword = (field: 'heading' | 'point', text: string) => {
    if (text.trim() === section[field]) {
      setRefusal(null)
      return
    }
    const op: BlogOutlineOp = { op: 'reword', section: n, [field]: text }
    const reason = check(op)
    setRefusal(reason)
    if (reason === null) onEdit(op)
  }
  const move = (to: number): BlogOutlineOp => ({ op: 'move', section: n, to })
  const remove: BlogOutlineOp = { op: 'remove', section: n }
  const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  return (
    <li aria-label={`Section ${n}`}>
      <Blueprint className={compactRow}>
        <span aria-hidden="true" className={rowNumber}>
          {n}
        </span>
        {props.editable ? (
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label htmlFor={`${ids}-heading`} className="sr-only">
                Heading
              </Label>
              <Input
                id={`${ids}-heading`}
                className={cn(compactField, 'font-heading')}
                value={heading}
                disabled={disabled}
                onChange={(e) => setHeading(firstChars(e.target.value, HEADING_MAX))}
                onKeyDown={blurOnEnter}
                onBlur={() => reword('heading', heading)}
              />
              <Label htmlFor={`${ids}-point`} className="sr-only">
                Point
              </Label>
              <Input
                id={`${ids}-point`}
                className={compactField}
                value={point}
                disabled={disabled}
                onChange={(e) => setPoint(firstChars(e.target.value, BLOG_POINT_MAX))}
                onKeyDown={blurOnEnter}
                onBlur={() => reword('point', point)}
              />
              {refusal && <p className={reasonText}>{refusal}</p>}
            </div>
            <ReorderButtons
              name={`section ${n}`}
              up={n > 1 ? { disabled, onClick: () => onEdit(move(n - 1)) } : undefined}
              down={n < total ? { disabled, onClick: () => onEdit(move(n + 1)) } : undefined}
              remove={{
                disabled: disabled || check(remove) !== null,
                onClick: () => onEdit(remove),
              }}
            />
          </>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="text-h4">{section.heading}</h3>
            <p>{section.point}</p>
          </div>
        )}
      </Blueprint>
    </li>
  )
}

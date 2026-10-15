'use client'

import { useRouter } from 'next/navigation'
import { type KeyboardEvent, useId, useState } from 'react'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import type { Staff } from '@/shared/lib/auth/access'
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
import { editOutline, JOB_LABELS, type OutlineOp, outlineRange } from '../../lib/outline'
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
  movesWait,
  ReorderButtons,
  reasonText,
  StepAction,
  StepAreas,
  Working,
} from '../parts'
import { usePostAction } from '../usePostAction'
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
  const { pending, run, error } = usePostAction()
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
        <h2 id={`${ids}-heading`} className="text-h3">
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
  const edit = (op: OutlineOp) =>
    run(() => actions.editOutlineAction(view.id, view.version, op), 'Outline changed')
  const reformat = (format: string) => {
    setLastFormat(format)
    run(() => actions.outlineFormatAction(view.id, view.version, format), 'Outlined again')
  }
  const formats = rankedFormats(view.current.ideas?.body.formats)
  const chosen = outline.format ? formatById(outline.format) : null
  const write = () =>
    run(
      () => actions.writeSlidesAction(view.id, view.version),
      'Versions drafted',
      // Drafted, the post is at its text versions: their screen opens (GD27).
      () => router.push(stepPath(view.id, stepOfStage('structures', false))),
    )

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
  const { min, max } = outlineRange(template)
  const angles = outline.ideas.map((c) => c.angle).join(' + ')

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-8">
      <h2 id={`${ids}-heading`} className="text-h3">
        Outline
      </h2>

      <StepAreas
        slides={
          <>
            {error && <p className={reasonText}>{error}</p>}
            <ol className="flex flex-col gap-4">
              {slides.map((slide, i) => (
                <OutlineRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: a row is its place; every change saves a new outline and keys the screen again.
                  key={i}
                  slide={slide}
                  n={i + 1}
                  total={slides.length}
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
                    onChange={(e) => reformat(e.target.value)}
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
            {waiting && <Working words={waiting} />}
            {failed && <p className={reasonText}>{DRAFT_FAILED}</p>}
            {outlineFailed && <p className={reasonText}>{OUTLINE_FAILED}</p>}
            {outlineFailed && lastFormat && editGate.shown && (
              <Control reason={editGate.reason}>
                <Button
                  variant="outline"
                  disabled={blocked || editGate.reason !== null}
                  onClick={() => reformat(lastFormat)}
                >
                  Try again
                </Button>
              </Control>
            )}
            {writeGate.shown && (
              <StepAction>
                <Control reason={writeGate.reason}>
                  <Button disabled={blocked || writeGate.reason !== null} onClick={write}>
                    {failed ? 'Try again' : 'Write the slides'}
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
 * One slide of the outline: its number, then its job and layout to choose and its point to edit
 * in place (saved when the field is left changed), and the moves and removal; read-only to a
 * viewer who may not edit. A layout the look would not take here is not offered.
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
    <li aria-label={`Slide ${n}`}>
      <Blueprint className="flex flex-col gap-3 p-4">
        <p className="text-overline uppercase text-muted-foreground">{`Slide ${n}`}</p>
        {props.editable ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${ids}-job`}>Job</Label>
                <NativeSelect
                  id={`${ids}-job`}
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
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${ids}-layout`}>Layout</Label>
                <NativeSelect
                  id={`${ids}-layout`}
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
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${ids}-point`}>Point</Label>
              <Input
                id={`${ids}-point`}
                value={point}
                disabled={disabled}
                onChange={(e) => setPoint(firstChars(e.target.value, POINT_MAX))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
                onBlur={() => {
                  if (point.trim() !== slide.point) onEdit({ op: 'change', slide: n, point })
                }}
              />
            </div>
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
          </>
        ) : (
          <>
            <p className={reasonText}>
              {`${JOB_LABELS[slide.job]} · ${LAYOUT_LABELS[slide.layout]}`}
            </p>
            <p>{slide.point}</p>
          </>
        )}
      </Blueprint>
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
 * question is refused beside it), moved up or down, or removed, and a section added at the end;
 * then the key takeaways and the FAQ it ends with, and beside them the angle and "Write the
 * blog", which writes the text in the background (the step shows it in words, and a failed
 * writing offers "Try again"). A change the outline would not take is disabled, with why said once
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
        <h2 id={`${ids}-heading`} className="text-h3">
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
      <h2 id={`${ids}-heading`} className="text-h3">
        Outline
      </h2>

      <StepAreas
        slides={
          <>
            {error && <p className={reasonText}>{error}</p>}
            <ol className="flex flex-col gap-4">
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
            {waiting && <Working words={waiting} />}
            {failed && <p className={reasonText}>{WRITE_FAILED}</p>}
            {writeGate.shown && (
              <Control reason={writeGate.reason}>
                <Button disabled={blocked || writeGate.reason !== null} onClick={write}>
                  {failed ? 'Try again' : 'Write the blog'}
                </Button>
              </Control>
            )}
          </>
        }
      />
    </section>
  )
}

/**
 * One section of a blog's outline: its number, its heading and point to edit in place (saved
 * when the field is left changed, or refused beside it), and its moves and removal; read-only to
 * a viewer who may not edit.
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
      <Blueprint className="flex flex-col gap-3 p-4">
        <p className="text-overline uppercase text-muted-foreground">{`Section ${n}`}</p>
        {props.editable ? (
          <>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${ids}-heading`}>Heading</Label>
              <Input
                id={`${ids}-heading`}
                value={heading}
                disabled={disabled}
                onChange={(e) => setHeading(firstChars(e.target.value, HEADING_MAX))}
                onKeyDown={blurOnEnter}
                onBlur={() => reword('heading', heading)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${ids}-point`}>Point</Label>
              <Input
                id={`${ids}-point`}
                value={point}
                disabled={disabled}
                onChange={(e) => setPoint(firstChars(e.target.value, BLOG_POINT_MAX))}
                onKeyDown={blurOnEnter}
                onBlur={() => reword('point', point)}
              />
            </div>
            {refusal && <p className={reasonText}>{refusal}</p>}
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
          <>
            <h3 className="text-h4">{section.heading}</h3>
            <p>{section.point}</p>
          </>
        )}
      </Blueprint>
    </li>
  )
}

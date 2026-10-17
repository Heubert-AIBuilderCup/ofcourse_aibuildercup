'use client'

import { Check } from 'lucide-react'
import { type KeyboardEvent, type Ref, useImperativeHandle, useRef, useState } from 'react'
import {
  type AnswerGroup,
  type AnswerRow,
  answerLabel,
  ExactScore,
  effectOf,
  isVisible,
  NOT_SURE,
  parseAnswer,
  questionOf,
  type RoadChangeOf,
  type RowKey,
} from '@/features/opening'
import { Note } from '@/shared/components/Note'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'
import {
  type AnswerValue,
  AREAS_MAX,
  type QuestionKey,
  type RoadmapTag,
  type StoredAnswer,
  type StoredAnswers,
} from '@/shared/types/student'
import type { Road } from '../model/road-data'
import styles from './answers.module.css'

/** From scratch, what a question she has not answered yet says in place of its default. */
const UNANSWERED = 'Not answered yet'

/** Picks not saved yet, by question: an option, "Not sure", or the areas picked. */
type Pending = Partial<Record<QuestionKey, AnswerValue>>

const same = (a: AnswerValue | undefined, b: AnswerValue | undefined) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((x) => b.includes(x))
    : a === b

/**
 * The option a row has checked now: a stated answer itself; "Not sure" for an assumed one, or for
 * an unanswered one that reads as its default; nothing for one skipped.
 */
function currentOf(row: AnswerRow, answers: StoredAnswers): AnswerValue | undefined {
  const answer = answers[row.key as QuestionKey]
  const unsure = row.options.some((o) => o.value === NOT_SURE)
  if (!answer) return unsure && row.open === null ? NOT_SURE : undefined
  return answer.state === 'assumed' && unsure ? NOT_SURE : answer.value
}

const sameAnswer = (a: StoredAnswer | undefined, b: StoredAnswer | undefined) =>
  a === b || (!!a && !!b && a.state === b.state && same(a.value, b.value))

/** A row changed by the last Save, and the answer it saved (none: no longer asked). */
type Done = { key: QuestionKey; answer: StoredAnswer | undefined }

/**
 * Her answers with these picks merged in, each stored as onboarding stores it, less any answer to a
 * question they no longer ask (the field or the areas after another "know", "Do you know anyone…"
 * after community's No).
 */
function withPicks(answers: StoredAnswers, picks: Pending): StoredAnswers {
  const next = { ...answers }
  for (const [key, value] of Object.entries(picks) as [QuestionKey, AnswerValue][]) {
    const answer = parseAnswer(key, value)
    if (answer) next[key] = answer
  }
  return Object.fromEntries(
    Object.entries(next).filter(([key]) => isVisible(key as QuestionKey, next)),
  ) as StoredAnswers
}

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * How the panel ends: Your answers saves changes to the roadmap (`onSave`, her answers with them
 * merged in) or closes (`onClose`); a new roadmap's draft, a copy of `copyOf` (null from scratch),
 * is created with them (`onCreate`) or cancelled (`onCancel`).
 */
type Ends =
  | { mode?: 'edit'; onSave: (answers: StoredAnswers) => void; onClose: () => void }
  | {
      mode: 'draft'
      copyOf: string | null
      onCreate: (answers: StoredAnswers) => void
      onCancel: () => void
    }

/**
 * Closing the panel from outside it: as its own Close does, asking first when picks wait; `then`
 * follows once it has closed, and never if she keeps editing.
 */
export type AnswersCloser = { close: (then: () => void) => void }

/**
 * "Your answers" over the board: every onboarding answer of this roadmap, by the step that asked
 * it, each row opening its options in place (one at a time). A pick that differs from her answer
 * waits, marked "Not saved", says what it would change ("If you save, on your roadmap") and
 * previews it on the map (`onPreview`, the tiles' words); changes wait together under the bar until
 * Save changes (`onSave`, her answers with them merged in) or Discard. Closing with changes asks
 * first. Her person is shown without a Change; the tags read from her own words follow under "In
 * your own words", each as the words she wrote, wellbeing ones too, never changed here. `place`: in the card column or the
 * phone's sheet, whose padding the sticky bar and ask reach across.
 *
 * In `mode: 'draft'` it is a new roadmap's: the source's answers, changed here before anything is
 * made, or from scratch (no `copyOf`) none, every question open. The bar is always there, counting
 * the answers changed (or given); Create roadmap waits for one, and Close or Cancel with changes
 * asks whether to discard the new roadmap.
 */
export function AnswersPanel({
  groupsFor,
  answers,
  road,
  place = 'column',
  tags = [],
  rematch,
  onPreview,
  closer,
  ...ends
}: {
  /** Its rows for a set of answers: the questions those answers ask (answerGroups). */
  groupsFor: (answers: StoredAnswers) => AnswerGroup[]
  /** The roadmap's saved answers; in a draft, its source's. */
  answers: StoredAnswers
  road: Road
  place?: 'column' | 'sheet'
  /** What was read from her own words; shown, never changed here. */
  tags?: RoadmapTag[]
  /** The board draws the road her answers match: its rule, so a pick says when it would change it. */
  rematch?: RoadChangeOf
  onPreview: (prev: Record<string, string>) => void
  /** The board's way to close it from outside, through the same ask (Find opening over it). */
  closer?: Ref<AnswersCloser>
} & Ends) {
  const [openKey, setOpenKey] = useState<RowKey | null>(null)
  const [pending, setPending] = useState<Pending>({})
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState<Done[]>([])
  // Her saved answers changed under the panel (Undo): a row they no longer hold is not "Changed just now".
  const [seen, setSeen] = useState(answers)
  if (seen !== answers) {
    setSeen(answers)
    setDone(done.filter((d) => sameAnswer(answers[d.key], d.answer)))
  }
  const count = Object.keys(pending).length
  const draft = ends.mode === 'draft'
  const scratch = ends.mode === 'draft' && ends.copyOf === null
  // From scratch every question is open: a default it would count as is not her answer yet.
  const asShown = (row: AnswerRow): AnswerRow =>
    scratch && row.editable && !(row.key in answers) ? { ...row, shown: '', open: UNANSWERED } : row
  const leave = ends.mode === 'draft' ? ends.onCancel : ends.onClose
  // What follows the close she is being asked about (Find opening); dropped if she keeps editing.
  const then = useRef<(() => void) | null>(null)

  function keepEditing() {
    setAsking(false)
    then.current = null
  }

  function change(picks: Pending) {
    // A pick on a question the others no longer ask goes with it.
    const asked = withPicks(answers, picks)
    const next = Object.fromEntries(
      Object.entries(picks).filter(([key]) => isVisible(key as QuestionKey, asked)),
    ) as Pending
    setPending(next)
    keepEditing()
    onPreview(
      Object.assign(
        {},
        ...Object.entries(next).map(
          ([key, value]) => effectOf(road, key as RowKey, value, answers, rematch).prev,
        ),
      ),
    )
  }

  function pick(row: AnswerRow, value: AnswerValue) {
    const key = row.key as QuestionKey
    const { [key]: _, ...rest } = pending
    change(same(value, currentOf(row, answers)) ? rest : { ...rest, [key]: value })
  }

  /** Areas: up to three, never none. */
  function toggle(row: AnswerRow, value: string) {
    const was = (pending[row.key as QuestionKey] ?? currentOf(row, answers) ?? []) as string[]
    const next = was.includes(value) ? was.filter((v) => v !== value) : [...was, value]
    if (next.length === 0 || next.length > AREAS_MAX) return
    pick(row, next)
  }

  /** What Save or Create sends: her answers with the picks waiting merged in. */
  const merged = () => withPicks(answers, pending)

  function save() {
    if (ends.mode === 'draft') {
      if (count) ends.onCreate(merged())
      return
    }
    const next = merged()
    setDone((Object.keys(pending) as QuestionKey[]).map((key) => ({ key, answer: next[key] })))
    setPending({})
    setOpenKey(null)
    ends.onSave(next)
  }

  function discard() {
    const next = then.current
    change({})
    leave()
    next?.()
  }

  /** Close, asking first when picks wait; `next` follows once it has closed. */
  function close(next: (() => void) | null = null) {
    if (count) {
      setAsking(true)
      then.current = next
    } else {
      leave()
      next?.()
    }
  }

  useImperativeHandle(closer, () => ({ close }))

  const question = draft
    ? 'Discard this new roadmap?'
    : `Discard ${counted(count, 'change', 'changes')}?`

  const foot =
    place === 'sheet' ? 'sticky bottom-0 -mx-4 px-4' : 'sticky -bottom-6 -mx-6 -mb-6 px-6'

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape from anywhere inside closes it as Close does
    <div
      className="flex flex-col gap-3"
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key !== 'Escape' || asking) return
        e.stopPropagation()
        close()
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="m-0 text-overline text-muted-foreground uppercase">
            {ends.mode !== 'draft'
              ? 'From onboarding · change any of them'
              : scratch
                ? 'New roadmap · from scratch'
                : `New roadmap · a copy of ${ends.copyOf}`}
          </p>
          <h2 className="m-0 text-h2 leading-none">
            {scratch ? 'Answer the questions' : draft ? 'Change any answers' : 'Your answers'}
          </h2>
        </div>
        <Button type="button" variant="text" onClick={() => close()}>
          Close
        </Button>
      </div>
      <p className="m-0 text-muted-foreground">
        {scratch
          ? 'Start with no answers. Each one you give draws more of the map.'
          : draft
            ? 'It starts with the same answers. Change one or more; the map shows what would be different before you create it.'
            : 'Pick one to change it. Your roadmap shows what would move before anything moves.'}
      </p>

      {/* The rows her answers would ask with the picks waiting: a follow-up shows at once. */}
      {groupsFor(merged()).map((group) => (
        <section key={group.n} className="mt-2 flex flex-col">
          <h3 className="mb-1 flex items-baseline gap-2 text-h4">
            <span className="text-caption text-muted-foreground">{group.n}</span>
            <span>{group.name}</span>
          </h3>
          <ul className="m-0 list-none p-0">
            {group.rows.map(asShown).map((row) => (
              <AnswerItem
                key={row.key}
                row={row}
                current={currentOf(row, answers)}
                picked={pending[row.key as QuestionKey]}
                open={openKey === row.key}
                done={
                  done.some((d) => d.key === row.key) &&
                  pending[row.key as QuestionKey] === undefined
                }
                lines={(value) => effectOf(road, row.key, value, answers, rematch).lines}
                onToggle={() => {
                  setOpenKey(openKey === row.key ? null : row.key)
                  keepEditing()
                }}
                onPick={(value) => (isMulti(row) ? toggle(row, value as string) : pick(row, value))}
              />
            ))}
          </ul>
        </section>
      ))}

      {tags.length > 0 ? (
        <section className="mt-2 flex flex-col gap-2">
          <h3 className="m-0 text-h4">In your own words</h3>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {tags.map((tag) => (
              <li
                key={`${tag.step}|${tag.text}|${tag.quote}`}
                className="border border-dashed border-neutral-500 px-2 py-0.5 text-caption text-muted-foreground"
              >
                {/* Her quote, checked against what she wrote; the model's note is never shown as hers. */}
                “{tag.quote}”
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {asking ? (
        <div
          role="alertdialog"
          aria-label={question}
          className={cn(styles.ask, foot, 'z-3 flex flex-col gap-2 bg-background pt-4 pb-5')}
        >
          <p className="m-0 font-heading text-h4 font-semibold">{question}</p>
          <Note tone="hint" icon={null}>
            {draft
              ? 'Nothing is created. Your other roadmaps stay as they are.'
              : 'Your answers and your roadmap stay as they are.'}
          </Note>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={discard}>
              Discard
            </Button>
            <Button type="button" variant="strong" className="h-11" onClick={keepEditing}>
              Keep editing
            </Button>
          </div>
        </div>
      ) : count || draft ? (
        <div
          className={cn(
            styles.bar,
            foot,
            'z-2 flex items-center gap-2 border-t bg-background py-3',
          )}
        >
          <span className="flex-1 text-sm font-medium">
            {!draft
              ? `${counted(count, 'change', 'changes')} not saved`
              : scratch
                ? count
                  ? `${counted(count, 'answer', 'answers')} given`
                  : 'Answer at least one question'
                : count
                  ? `${counted(count, 'answer', 'answers')} changed`
                  : 'Change at least one answer'}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={draft ? () => close() : discard}
          >
            {draft ? 'Cancel' : 'Discard'}
          </Button>
          <Button
            type="button"
            variant="strong"
            className="h-11 aria-disabled:opacity-60"
            aria-disabled={draft && !count ? true : undefined}
            onClick={save}
          >
            {draft ? 'Create roadmap' : 'Save changes'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

const controlOf = (row: AnswerRow) =>
  row.editable ? questionOf(row.key as QuestionKey).control : null
/** Areas are picked several at a time. */
const isMulti = (row: AnswerRow) => controlOf(row) === 'multi'

/**
 * One answer: its question and answer as a row that opens its options (Change, Answer now for one
 * left open, Close while open), flagged "Not saved" or "Changed just now"; open, its why, its
 * options as cards (radios, or checkboxes for areas) or, for a `select` question, a select and,
 * with a pick not saved, what it would change. A row that is not changed here is its words alone.
 */
function AnswerItem({
  row,
  current,
  picked,
  open,
  done,
  lines,
  onToggle,
  onPick,
}: {
  row: AnswerRow
  current: AnswerValue | undefined
  picked: AnswerValue | undefined
  open: boolean
  done: boolean
  lines: (value: AnswerValue) => string[]
  onToggle: () => void
  onPick: (value: AnswerValue) => void
}) {
  const waiting = picked !== undefined
  const shown = waiting ? answerLabel(row.key as QuestionKey, picked) : row.shown
  const text = (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <span className="text-caption text-muted-foreground">{row.question}</span>
      {shown ? <span className="font-medium">{shown}</span> : null}
      {row.open && !waiting ? (
        <span className="border border-dashed border-foreground/40 px-1.5 text-caption text-muted-foreground">
          {row.open}
        </span>
      ) : null}
      {waiting ? (
        <span className="border border-accent-700 px-1.5 text-caption font-medium text-accent-800">
          Not saved
        </span>
      ) : null}
      {done ? (
        <span className="border px-1.5 text-caption text-muted-foreground">Changed just now</span>
      ) : null}
    </span>
  )

  if (!row.editable) return <li className="border-t py-2 pr-1">{text}</li>

  const multi = isMulti(row)
  const select = controlOf(row) === 'select'
  const value = waiting ? picked : current
  const checked = (option: AnswerValue) =>
    multi && Array.isArray(value) ? value.includes(option as string) : same(option, value)

  return (
    <li className={cn('border-t', waiting && [styles.pending, 'pl-3'])}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent py-2 pr-1 pl-0 text-left text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        {text}
        <span className="shrink-0 text-sm font-semibold text-accent-700">
          {open ? 'Close' : row.open && !waiting ? 'Answer now' : 'Change'}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2.5 pb-4">
          <p className="m-0 text-sm text-muted-foreground">{row.why}</p>
          {select ? (
            // Many options ("Where are you right now?"): a select, as onboarding asks it.
            <Select
              value={row.options.find((o) => same(o.value, value))?.label ?? ''}
              onValueChange={(label) => {
                const option = row.options.find((o) => o.label === label)
                if (option) onPick(option.value)
              }}
            >
              <SelectTrigger aria-label={row.question} className="h-11 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {row.options.map((option) => (
                  <SelectItem key={option.label} value={option.label} className="text-base">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            // biome-ignore lint/a11y/useAriaPropsSupportedByRole: a radiogroup, or a group of checkboxes for areas; both are named
            <div
              role={multi ? 'group' : 'radiogroup'}
              aria-label={row.question}
              className={styles.cards}
            >
              {row.options.map((option) => {
                const on = checked(option.value)
                const was = !multi && waiting && same(option.value, current)
                return (
                  // biome-ignore lint/a11y/useAriaPropsSupportedByRole: a radio, or a checkbox for areas: a card holding a label and a tick, as onboarding's own cards
                  <button
                    key={option.label}
                    type="button"
                    role={multi ? 'checkbox' : 'radio'}
                    aria-checked={on}
                    onClick={() => onPick(option.value)}
                    className={cn(
                      'group relative flex min-h-14 cursor-pointer flex-col items-start justify-center border border-border bg-transparent py-2 pr-9 pl-3.5 text-left font-heading text-lead font-semibold text-foreground',
                      'hover:not-aria-checked:border-foreground/40 hover:not-aria-checked:bg-foreground/4',
                      'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary',
                      'aria-checked:border-accent-700 aria-checked:bg-accent-100 aria-checked:text-accent-800 aria-checked:inset-ring aria-checked:inset-ring-accent-700',
                      option.value === NOT_SURE &&
                        'border-dashed font-sans text-base font-medium text-muted-foreground aria-checked:border-solid',
                    )}
                  >
                    <span>{option.label}</span>
                    {was ? (
                      <span className="font-sans text-caption font-normal text-muted-foreground">
                        Your answer now
                      </span>
                    ) : null}
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 right-3 flex size-5 -translate-y-1/2 scale-0 items-center justify-center bg-accent-700 text-background group-aria-checked:scale-100"
                    >
                      <Check className="size-icon-sm" />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {row.key === 'eng' ? <ExactScore value={value} onAnswer={onPick} /> : null}
          {waiting ? (
            <div
              aria-live="polite"
              className="border-l-2 border-accent-700 bg-accent-100/70 px-4 py-3"
            >
              <p className="m-0 text-overline text-accent-800 uppercase">
                If you save, on your roadmap
              </p>
              <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
                {lines(picked).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SignOutButton } from '@/features/auth/components/SignOutButton'
import {
  buildFutures,
  DIMENSION_LABELS,
  DIMENSIONS,
  type Dimension,
  diffFutures,
  type FuturesResult,
  type Notice,
} from '@/features/engine'
import { FrameMarks } from '@/shared/components/Blueprint'
import { buttonVariants } from '@/shared/components/ui/button'
import type { ActionResult } from '@/shared/types/action-result'
import type {
  AnswerValue,
  Coins,
  FutureId,
  QuestionKey,
  Relative,
  Reminder,
  StoredAnswer,
  StoredAnswers,
} from '@/shared/types/student'
import { SAVE_FAILED } from '../model/messages'
import { chipText, DEFAULTS, PARTICULAR, parseAnswer, SUGGEST_ME } from '../model/questions'
import { ChipList } from './ChipEditor'
import { FutureCard } from './FutureCard'
import { Hero } from './Hero'
import { Progress, SCREEN_COUNT } from './Progress'
import { SealedView } from './SealedView'
import { WeightsPlaque } from './WeightsPlaque'

const ATTENTION_PATH = '/attention'
const FUTURES_STEP = 5
const BACK_PATH = '/opening/after'
const REMINDER_SAVED = "Reminder saved. You'll see it in your feed once it's ready."
const SEALED_CHIPS: readonly QuestionKey[] = ['amount', 'hard']

type View = {
  answers: StoredAnswers
  result: FuturesResult
  changed: Partial<Record<FutureId, Dimension[]>>
  /** What the last redraw changed, as its tag reads ("budget about AUD 36k a year"). */
  redrawn: string | null
}
type Patch = Partial<Record<QuestionKey, AnswerValue | StoredAnswer>>

const reminderKey = (futureId: FutureId, courseId: string) => `${futureId}:${courseId}`
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/** A chip's choice as the answers it changes: a field also says she knows what she wants. */
function patchOf(key: QuestionKey, raw: AnswerValue): Patch {
  if (key !== 'field') return { [key]: raw }
  return raw === SUGGEST_ME ? { know: SUGGEST_ME } : { know: PARTICULAR, field: raw }
}

/** The patch as stored answers, or null when any entry is not an answer. */
function parsePatch(patch: Patch): StoredAnswers | null {
  const parsed: StoredAnswers = {}
  for (const [key, raw] of Object.entries(patch) as [QuestionKey, unknown][]) {
    const answer = parseAnswer(key, raw)
    if (!answer) return null
    parsed[key] = answer
  }
  return parsed
}

/** What Undo puts back for these keys: the stored answer, or the default an unanswered one had. */
function restoreOf(before: StoredAnswers, keys: QuestionKey[]): StoredAnswers {
  const restore: StoredAnswers = {}
  for (const key of keys) {
    const fallback = DEFAULTS[key]
    const previous =
      before[key] ?? (fallback === undefined ? undefined : { value: fallback, state: 'assumed' })
    if (previous) restore[key] = previous
  }
  return restore
}

const weightsLine = (weights: FuturesResult['weights']) =>
  `Weighed from your answers, 0–3: ${DIMENSIONS.map((dim) => `${DIMENSION_LABELS[dim]} ${weights[dim]}`).join(' · ')} · the heavier, the larger it’s drawn`

/**
 * Screen 5, and home on a return visit: three futures, nothing ranked. A chip opens its question
 * in place; a choice redraws all three in the browser at once, from the same engine the server
 * used, then saves in the background with an Undo. "Remind me" saves a reminder to her account.
 */
export function FuturesScreen({
  initialAnswers,
  relative,
  initial,
  coins,
  reminders,
  returning,
  saveAnswersAction,
  addReminderAction,
}: {
  initialAnswers: StoredAnswers
  /** Her person while screen 3 still shows them (activeRelative), else null. */
  relative: Relative | null
  initial: FuturesResult
  coins: Coins | null
  reminders: Reminder[]
  returning: boolean
  saveAnswersAction: (patch: Patch | StoredAnswers) => Promise<ActionResult>
  addReminderAction: (reminder: { futureId: FutureId; courseId: string }) => Promise<ActionResult>
}) {
  const [view, setView] = useState<View>({
    answers: initialAnswers,
    result: initial,
    changed: {},
    redrawn: null,
  })
  const [open, setOpen] = useState<string | null>(null)
  const [set, setSet] = useState(
    () => new Set(reminders.map((r) => reminderKey(r.futureId, r.courseId))),
  )
  const [reminding, setReminding] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const save = (write: () => Promise<ActionResult<object>>) =>
    startTransition(async () => {
      try {
        const result = await write()
        if (!result.ok) toast.error(result.error)
      } catch {
        toast.error(SAVE_FAILED)
      }
    })

  function undo(before: StoredAnswers, keys: QuestionKey[]) {
    const restore = restoreOf(before, keys)
    setView((current) => {
      const answers = { ...current.answers, ...restore }
      return { answers, result: buildFutures({ answers, relative }), changed: {}, redrawn: null }
    })
    save(() => saveAnswersAction(restore))
  }

  // Everything she sees changes here, before any request (criterion 50).
  function choose(key: QuestionKey, raw: AnswerValue) {
    const patch = patchOf(key, raw)
    const parsed = parsePatch(patch)
    if (!parsed) return
    const before = view.answers
    const answers = { ...before, ...parsed }
    const result = buildFutures({ answers, relative })
    const redrawn = lowerFirst(chipText(key, answers))
    setView({ answers, result, changed: diffFutures(view.result, result), redrawn })
    setOpen(null)
    save(() => saveAnswersAction(patch))
    toast(`Redrawn: ${redrawn}`, {
      action: { label: 'Undo', onClick: () => undo(before, Object.keys(parsed) as QuestionKey[]) },
    })
  }

  function remind(futureId: FutureId, courseId: string) {
    const key = reminderKey(futureId, courseId)
    setReminding(key)
    startTransition(async () => {
      try {
        const result = await addReminderAction({ futureId, courseId })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setSet((current) => new Set(current).add(key))
        toast.success(REMINDER_SAVED)
      } catch {
        toast.error(SAVE_FAILED)
      } finally {
        setReminding(null)
      }
    })
  }

  const toggle = (chip: string) => setOpen((current) => (current === chip ? null : chip))
  const chips = (scope: string, keys: readonly QuestionKey[]) => (
    <ChipList
      scope={scope}
      keys={keys}
      answers={view.answers}
      open={open}
      onToggle={toggle}
      onChoose={choose}
    />
  )

  const { result } = view
  // A field that stands in for one she chose is said on each card (criterion 44); with no cards
  // (sealed, or no route at all), above them like every other notice.
  const onCards = (notice: Notice) =>
    result.kind === 'futures' && result.futures.length > 0 && notice.kind === 'field-substituted'
  const cardNotes = result.notices.filter(onCards).map((notice) => notice.text)
  return (
    // The container the phone layout (@max-[35rem]) and the three columns (@min-[64rem]) query.
    <div className="@container">
      <Hero
        overline={
          returning
            ? 'Your three futures · nothing ranked'
            : `Step ${FUTURES_STEP} of ${SCREEN_COUNT} · three futures, nothing ranked`
        }
        title="Here's what each would give you"
      />
      <div className="flex flex-col gap-block px-gutter py-section @max-[35rem]:px-5 @max-[35rem]:py-6">
        <Progress step={FUTURES_STEP} />
        <div className="flex max-w-3xl items-center gap-3 border border-primary bg-accent-100 px-4 py-3">
          <Image src="/brand/duck.png" alt="" width={32} height={32} />
          <p className="m-0">
            Here's what each of these would give you and cost you. Tell me what I got wrong.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 text-caption">{weightsLine(result.weights)}</p>
          <WeightsPlaque weights={result.weights} reasons={result.reasons} />
        </div>

        {result.notices
          .filter((notice) => !onCards(notice))
          .map((notice, i) => (
            <div key={notice.text} className="flex max-w-3xl flex-col gap-2">
              <p role="status" className="m-0 border-l-2 border-primary bg-accent-100 px-3 py-2">
                {notice.text}
              </p>
              {notice.chip ? chips(`notice-${i}`, [notice.chip]) : null}
            </div>
          ))}

        {result.kind === 'sealed' ? (
          <SealedView
            budgetK={result.budgetK}
            nearest={result.nearest}
            chips={chips('sealed', SEALED_CHIPS)}
          />
        ) : (
          <div className="grid items-start gap-block @min-[64rem]:grid-cols-3">
            {result.futures.map((future) => {
              const key = reminderKey(future.id, future.courseId)
              return (
                <FutureCard
                  key={future.id}
                  future={future}
                  changed={view.changed[future.id]}
                  redrawn={view.redrawn}
                  notes={cardNotes}
                  chips={chips(future.id, future.chips)}
                  reminderSet={set.has(key)}
                  reminding={reminding === key}
                  onRemind={() => remind(future.id, future.courseId)}
                />
              )
            })}
          </div>
        )}

        <footer className="flex max-w-xl flex-col items-start gap-3">
          <p className="m-0 text-caption text-muted-foreground">
            Shown in no order. None of these is a ranking or a pick. Figures are mock.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={BACK_PATH} className={buttonVariants({ variant: 'outline' })}>
              <FrameMarks />
              Back
            </Link>
            {coins === null || coins.state === 'later' ? (
              <Link href={ATTENTION_PATH} className={buttonVariants({ variant: 'outline' })}>
                <FrameMarks />
                {coins === null ? 'Next: your attention · optional' : 'Spend your ten coins'}
              </Link>
            ) : null}
          </div>
          <SignOutButton />
        </footer>
      </div>
    </div>
  )
}

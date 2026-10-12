'use client'

import { ArrowLeft, ArrowRight, Check, CircleAlert, Info, LoaderCircle } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { AnswerValue, QuestionKey, Relative } from '@/shared/types/student'
import {
  type SaveAnswers,
  type SaveRelative,
  type SaveStatus,
  useAnswerSave,
  useRelativeSave,
} from '../model/answer-save'
import { impactView } from '../model/impact'
import { ANSWER_SAVE_FAILED } from '../model/messages'
import {
  askedQuestions,
  forwardPath,
  PERSON,
  QUESTION_STEPS,
  type QuestionStep,
  questionOfPath,
  questionPath,
  type StepKey,
  shownQuestion,
} from '../model/onboarding'
import { useOnboardingAnswers } from '../model/onboarding-answers'
import { parseAnswer, type Question, questionOf } from '../model/questions'
import { AnswerCards } from './AnswerCards'
import { AreaChecks } from './AreaChecks'
import styles from './facts.module.css'
import shell from './onboarding.module.css'
import { PersonForm } from './PersonForm'
import picture from './picture.module.css'

type Notes = Record<Exclude<SaveStatus, 'failed'>, string>
const NOTES: Notes = {
  idle: "“Not sure” is a fine answer. Skip, and I'll assume a sensible default you can change later.",
  saving: 'Saving…',
  saved: 'Saved. Tap another answer to change it.',
}
/** The areas have no "Not sure", and a tap on a chosen area removes it. */
const AREA_NOTES: Notes = {
  idle: "Pick one, two or three. Skip, and I'll start wide, with every field in this preview.",
  saving: 'Saving…',
  saved: 'Saved. Tap an area again to remove it.',
}
/** A single choice with no "Not sure" (climate): nothing is assumed when she skips. */
const OPTIONAL_NOTES: Notes = { ...NOTES, idle: "Optional. Skip, and it's left out." }
/** Step 04's two exceptions: stay's "Not sure" is a real answer, and long-term is left blank. */
const STAY_NOTES: Notes = {
  ...NOTES,
  idle: "“Not sure” is a real answer here. Skip, and I'll use it.",
}
const SETTLE_NOTES: Notes = { ...NOTES, idle: "Optional. Skip, and it's left blank." }
/** Step 03's person form, which saves as she types. */
const PERSON_NOTES: Notes = {
  ...NOTES,
  idle: 'Every change saves as you go. Skip, and no one is added.',
  saved: 'Saved. Every change saves as you go.',
}
const PERSON_SAVE_FAILED =
  "We couldn't save that. What you entered is still here. Check your connection and try again."
/** What the note under the question says, by what the question is. */
function notesFor(question: Question | null): Notes {
  if (question === null) return PERSON_NOTES
  if (question.key === 'stay') return STAY_NOTES
  if (question.key === 'settle') return SETTLE_NOTES
  if (question.control === 'multi') return AREA_NOTES
  return question.notSure ? NOTES : OPTIONAL_NOTES
}
/** Step 03's person is saved through this when the page passes no action (steps 01, 02 and 04 never ask). */
const NO_PERSON_SAVE: SaveRelative = async () => ({ ok: true })
const NOTE_ICONS = {
  idle: <Info aria-hidden="true" className="icon-on-line-sm size-icon-sm shrink-0" />,
  saving: (
    <LoaderCircle
      aria-hidden="true"
      className={cn(picture.spin, 'icon-on-line-sm size-icon-sm shrink-0')}
    />
  ),
  saved: <Check aria-hidden="true" className="icon-on-line-sm size-icon-sm shrink-0" />,
}

/**
 * Onboarding steps 01 to 04 (the design's Facts, Study, Live and Grad): one question per screen, the question
 * named by the URL's last segment, its slug. The questions asked follow her answers as she taps
 * (the field or the areas only after "know"), so the count and the next question change at once;
 * a URL naming a question not asked shows her first open one and is replaced with its URL.
 * A tap shows what it does at once and saves in the background; a refused save keeps the answer
 * and offers to try again; removing the last area clears it. Moving between questions changes
 * only the URL (history.pushState, which Next.js syncs with usePathname: the linking guide's
 * "window.history.pushState"), so the screen and its saves stay; Skip stores nothing. Leaving the
 * step sends any save still waiting, so a quick tap is never lost. Step 03's "Who, and where?" is
 * a form instead of cards: her person is held here from the one the page passed (a
 * `router.refresh()` does not overwrite what she entered), so "Do you know anyone…" speaks of the
 * person on screen, and each change saves as the answers do. Step 04's last question leads out of
 * onboarding, to the futures.
 */
export function QuestionScreen({
  step,
  relative,
  saveAnswersAction,
  saveRelativeAction,
}: {
  step: QuestionStep
  /** As stored when the page rendered. */
  relative: Relative | null
  saveAnswersAction: SaveAnswers
  /** Step 03 only: the others never ask for her person. */
  saveRelativeAction?: SaveRelative
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [answers, setAnswers] = useOnboardingAnswers()
  const { title, back, nextName } = QUESTION_STEPS[step]
  const asked = askedQuestions(step, answers)
  const named = questionOfPath(step, pathname)
  // A question not asked for her answers on screen (the field without "Something particular") is
  // never shown: her first open one is, and the URL follows. The server cannot judge this, as her
  // last tap may not be saved yet. A router.refresh() in that window cannot send her back (the
  // provider keeps her taps); a hard reload before the save lands (300 ms) still opens her first
  // open question.
  const item = shownQuestion(step, pathname, answers)
  const replacement = named !== null && named.key !== item.key ? questionPath(step, item.key) : null
  const index = Math.max(
    asked.findIndex((q) => q.key === item.key),
    0,
  )
  const last = index === asked.length - 1
  const forward = forwardPath(step, answers)
  const [person, setPerson] = useState(relative)
  const answerSave = useAnswerSave(saveAnswersAction)
  const personSave = useRelativeSave(saveRelativeAction ?? NO_PERSON_SAVE)
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const shown = useRef(item.key)
  const headingId = useId()

  // The URL follows the question shown, with no new history entry (Next.js syncs usePathname).
  useEffect(() => {
    if (replacement) window.history.replaceState(null, '', replacement)
  }, [replacement])

  // A new question takes focus, so a screen reader reads it; not the first one she lands on.
  useEffect(() => {
    if (shown.current === item.key) return
    shown.current = item.key
    heading.current?.focus({ preventScroll: true })
  }, [item.key])

  function go(key: StepKey) {
    window.history.pushState(null, '', questionPath(step, key))
    const top = root.current?.getBoundingClientRect().top ?? 0
    if (top < 0) root.current?.scrollIntoView({ block: 'start' })
  }

  function flush() {
    answerSave.flush()
    personSave.flush()
  }

  function leave(path: string) {
    flush()
    router.push(path)
  }

  /** A tap, or `null` when she removed the last area: the answer is cleared, as if never given. */
  function answer(key: QuestionKey, raw: AnswerValue | null) {
    if (raw === null) {
      setAnswers(({ [key]: _cleared, ...rest }) => rest)
      answerSave.save(key, null)
      return
    }
    const parsed = parseAnswer(key, raw)
    if (!parsed) return
    setAnswers((current) => ({ ...current, [key]: parsed }))
    answerSave.save(key, raw)
    // Anything but a stated Yes to knowing someone (No, or Not sure, assumed No): her person is forgotten.
    if (
      key === 'knows' &&
      person !== null &&
      !(parsed.state === 'stated' && parsed.value === 'Yes')
    ) {
      changePerson(null)
    }
  }

  function changePerson(next: Relative | null) {
    setPerson(next)
    personSave.save(PERSON, next)
  }

  const { key } = item
  const question = key === PERSON ? null : questionOf(key)
  const multi = question?.control === 'multi'
  const answered = key === PERSON ? person !== null : answers[key] !== undefined
  const impact = answered || item.opensWithLine ? impactView(item.itemId, answers, person) : null
  const tagStop = impact?.tag?.after.startsWith('.') ? '.' : ''
  const status = key === PERSON ? personSave.statusOf(key) : answerSave.statusOf(key)
  const notes = notesFor(question)

  return (
    <div ref={root} className="mx-auto flex w-full max-w-2xl flex-col gap-5 @max-xl:gap-4">
      <div className={cn(shell.rise, shell.d2, 'flex min-h-11 items-center')}>
        <p className="m-0 text-overline uppercase text-accent-700">
          {title} ·{' '}
          <b className="font-medium text-muted-foreground">
            {index + 1} of {asked.length}
          </b>
        </p>
      </div>

      <div key={item.key} className={cn(styles.question, 'flex flex-col gap-5 @max-xl:gap-4')}>
        {item.group ? <p className="m-0 text-lead text-muted-foreground">{item.group}</p> : null}
        <h1
          ref={heading}
          id={headingId}
          tabIndex={-1}
          className="m-0 font-heading text-h1 font-semibold tracking-[-0.015em] outline-none"
        >
          {item.question}
        </h1>
        <p className="m-0 max-w-prose leading-relaxed text-muted-foreground">{item.why}</p>
        <div className={styles.cards}>
          {question === null ? (
            <PersonForm relative={person} onChange={changePerson} labelledBy={headingId} />
          ) : multi ? (
            <AreaChecks
              question={question}
              labelledBy={headingId}
              answer={answers[question.key]}
              onAnswer={(raw) => answer(question.key, raw)}
            />
          ) : (
            <AnswerCards
              question={question}
              labelledBy={headingId}
              answer={answers[question.key]}
              onAnswer={(raw) => answer(question.key, raw)}
            />
          )}
        </div>

        {/* Empty, the live region leaves the flow (it stays rendered for screen readers), so it
            adds no second gap between the cards and the note. */}
        <div aria-live="polite" className="flex flex-col gap-2 empty:absolute">
          {impact ? (
            <>
              <div
                key={impact.text}
                className={cn(
                  styles.impact,
                  'flex items-start gap-2.5 border-l-2 border-accent-700 bg-accent-100/70 px-4 py-3',
                  impact.kind === 'assume' && 'border-dashed',
                  impact.kind === 'limit' && 'border-neutral-600 bg-neutral-100',
                )}
              >
                {impact.kind === 'plain' ? (
                  <ArrowRight
                    aria-hidden="true"
                    className="icon-on-line-sm size-icon-sm shrink-0 text-accent-700"
                  />
                ) : null}
                {impact.kind === 'limit' ? (
                  <Info
                    aria-hidden="true"
                    className="icon-on-line-sm size-icon-sm shrink-0 text-neutral-700"
                  />
                ) : null}
                <p className="m-0">
                  <span className="sr-only">What this does: </span>
                  <span>{impact.text}</span>
                  {impact.tag ? (
                    <>
                      {/* The tag never starts a line, nor leaves its full stop behind. */}
                      <span className="whitespace-nowrap">
                        {' · '}
                        <span className="border border-dashed border-neutral-500 px-1.5 text-overline uppercase tracking-[0.06em] text-muted-foreground">
                          {impact.tag.text}
                        </span>
                        {tagStop}
                      </span>
                      {impact.tag.after.slice(tagStop.length)}
                    </>
                  ) : null}
                </p>
              </div>
              {impact.chips.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {impact.chips.map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex items-center gap-1.5 border border-dashed border-accent-700 bg-background px-2.5 py-0.75 text-caption text-accent-800"
                    >
                      <b className="text-micro font-normal uppercase text-muted-foreground">
                        Assumed
                      </b>
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {status === 'failed' ? (
          <div
            role="alert"
            className={cn(
              picture.errorIn,
              'flex flex-wrap items-center gap-x-2.5 gap-y-2 border border-danger-300 bg-danger-100 px-3.5 py-2.5 text-caption text-danger-800',
            )}
          >
            <CircleAlert aria-hidden="true" className="size-icon shrink-0 text-danger-700" />
            <span className="min-w-45 flex-1">
              {key === PERSON ? PERSON_SAVE_FAILED : ANSWER_SAVE_FAILED}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => (key === PERSON ? personSave.retry(key) : answerSave.retry(key))}
              className="h-11 border-danger-300 px-3.5 text-danger-800 hover:bg-danger-200 hover:text-danger-800"
            >
              Try again
            </Button>
          </div>
        ) : (
          <p
            role="status"
            className="m-0 flex items-start gap-2 text-caption text-muted-foreground"
          >
            {NOTE_ICONS[status]}
            <span>{notes[status]}</span>
          </p>
        )}
      </div>

      {last ? null : (
        <Link
          href={forward}
          onClick={flush}
          className="inline-flex min-h-11 items-center self-start text-caption font-medium text-accent-700"
        >
          {`Leave the rest for now: go to ${nextName}`}
        </Link>
      )}

      <div
        className={cn(
          shell.rise,
          shell.d8,
          'mt-1 flex items-center justify-between gap-3.5',
          '@max-xl:sticky @max-xl:bottom-0 @max-xl:z-5 @max-xl:-mx-4 @max-xl:border-t @max-xl:bg-background @max-xl:px-4 @max-xl:pt-3 @max-xl:pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => (index === 0 ? leave(back) : go(asked[index - 1].key))}
          className="min-w-33 @max-xl:min-w-24 @max-xl:flex-none"
        >
          <ArrowLeft aria-hidden="true" className="size-icon-sm" />
          Back
        </Button>
        <Button
          type="button"
          variant={last || answered ? 'strong' : 'outline'}
          size="lg"
          onClick={() => (last ? leave(forward) : go(asked[index + 1].key))}
          className="min-w-33 @max-xl:min-w-0 @max-xl:flex-1"
        >
          {last ? `Next: ${nextName}` : answered ? 'Continue' : 'Skip'}
          <ArrowRight aria-hidden="true" className="size-icon-sm" />
        </Button>
      </div>
    </div>
  )
}

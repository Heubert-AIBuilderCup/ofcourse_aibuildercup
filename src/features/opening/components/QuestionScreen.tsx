'use client'

import { ArrowLeft, ArrowRight, Check, Info, LoaderCircle } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import motion from '@/shared/components/motion.module.css'
import { Note } from '@/shared/components/Note'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import type {
  AnswerValue,
  QuestionKey,
  Relative,
  StoredAnswer,
  StoredAnswers,
} from '@/shared/types/student'
import {
  type SaveAnswers,
  type SaveRelative,
  type SaveStatus,
  useAnswerSave,
  useRelativeSave,
} from '../model/answer-save'
import { type EnglishScores, impactView } from '../model/impact'
import { ANSWER_SAVE_FAILED, PERSON_SAVE_FAILED } from '../model/messages'
import {
  askedQuestions,
  backPath,
  forwardPath,
  nextPath,
  OWN_WORDS_STEP_AT,
  PERSON,
  QUESTION_STEPS,
  type QuestionStep,
  questionOfPath,
  questionPath,
  type StepKey,
  shownQuestion,
} from '../model/onboarding'
import { useOnboardingAnswers } from '../model/onboarding-answers'
import { afterOwnWords } from '../model/own-words-next'
import { parseAnswer, type Question, questionOf } from '../model/questions'
import { AnswerCards } from './AnswerCards'
import { AreaChecks } from './AreaChecks'
import { ExactScore } from './ExactScore'
import styles from './facts.module.css'
import { OwnWordsBox, type ReadOwnWords } from './OwnWordsBox'
import { PersonForm } from './PersonForm'
import { SaveFailed } from './SaveFailed'
import { StepActions } from './StepActions'
import { StepHeading, StepKicker } from './StepHeading'

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
  idle: '“Not sure” is a real answer here. Skip, and your road may stay or go home.',
}
const SETTLE_NOTES: Notes = { ...NOTES, idle: "Optional. Skip, and it's left blank." }
/** Step 03's person form, which saves as she types. */
const PERSON_NOTES: Notes = {
  ...NOTES,
  idle: 'Every change saves as you go. Skip, and no one is added.',
  saved: 'Saved. Every change saves as you go.',
}
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
      className={cn(motion.spin, 'icon-on-line-sm size-icon-sm shrink-0')}
    />
  ),
  saved: <Check aria-hidden="true" className="icon-on-line-sm size-icon-sm shrink-0" />,
}
/** How long a chosen card shows its tick before the next question opens. */
const ADVANCE_MS = 350

/** The impact line's icon by what it says: the accent arrow (the tone's own), none for an assumption, the grey Info for a limit. */
const IMPACT_ICONS = {
  plain: undefined,
  assume: null,
  limit: (
    <Info aria-hidden="true" className="icon-on-line-sm size-icon-sm shrink-0 text-neutral-700" />
  ),
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
 * person on screen, and each change saves as the answers do. Step 04's last question leads on to
 * step 05, Your attention. With `readOwnWordsAction`, the first question of steps 02 to 04 (step
 * 01's facts offer none) has "Tell me in your own words" above it: the chips she uses are stored at once, and the step moves on to its first
 * question still open; from then Next skips every question answered after the one shown, so no
 * question a chip answered is asked again.
 */
export function QuestionScreen({
  step,
  relative,
  saveAnswersAction,
  saveRelativeAction,
  englishScores,
  borrowedAreas,
  readOwnWordsAction,
}: {
  step: QuestionStep
  /** As stored when the page rendered. */
  relative: Relative | null
  saveAnswersAction: SaveAnswers
  /** Step 03 only: the others never ask for her person. */
  saveRelativeAction?: SaveRelative
  /** Each course's English score, from the roads' catalogue: step 01's English line counts them. */
  englishScores: EnglishScores
  /** Step 02: the areas no road teaches a course in, each noted as borrowing the nearest field. */
  borrowedAreas?: readonly string[]
  /** Reads her own words on the step; without it, no box is offered. */
  readOwnWordsAction?: ReadOwnWords
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [answers, setAnswers] = useOnboardingAnswers()
  const { title, nextName } = QUESTION_STEPS[step]
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
  const forward = forwardPath(step, answers)
  const [person, setPerson] = useState(relative)
  // Once her own words answered some of the step, Next skips every question answered after this
  // one; with none left open it leaves the step.
  const [wordsUsed, setWordsUsed] = useState(false)
  // Where Continue goes, by the same rule as a tap's move on.
  const onward = nextPath(step, answers, item.key, person, wordsUsed)
  const last = onward.leaves
  const answerSave = useAnswerSave(saveAnswersAction)
  const personSave = useRelativeSave(saveRelativeAction ?? NO_PERSON_SAVE)
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const shown = useRef(item.key)
  const headingId = useId()
  const ownStep = OWN_WORDS_STEP_AT[step]
  // Where "Use these" goes: worked out from her answers with the chips she kept.
  const afterWords = useRef<string | null>(null)
  // A tap's move on, waiting out ADVANCE_MS and its save; only the latest tap's (`tapped`) may move,
  // and it is dropped when she moves another way, the question changes or the screen goes.
  const advance = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const tapped = useRef(0)
  const dropAdvance = () => {
    clearTimeout(advance.current)
    tapped.current += 1
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new question drops the pending move
  useEffect(() => dropAdvance, [item.key])

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
    goTo(questionPath(step, key))
  }

  /** To another question of the step; a tap's move on still waiting is dropped, so it moves once. */
  function goTo(path: string) {
    dropAdvance()
    window.history.pushState(null, '', path)
    const top = root.current?.getBoundingClientRect().top ?? 0
    if (top < 0) root.current?.scrollIntoView({ block: 'start' })
  }

  function flush() {
    answerSave.flush()
    personSave.flush()
  }

  /** Out of the step; as `goTo`, a tap's move on still waiting is dropped. */
  function leave(path: string) {
    dropAdvance()
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

  /**
   * A single-choice tap (or Enter or Space on a card, never an arrow key) answers and moves on, no
   * Continue needed: to the next question for her answers with this one counted, or out of the
   * step from its last. Its save is sent at once, and she moves on once it is stored, and no sooner
   * than ADVANCE_MS after the tap, so the tick shows; refused, she stays, with the save-failed alert
   * and Try again. A second tap in the wait replaces the first.
   */
  function choose(key: QuestionKey, raw: AnswerValue) {
    const parsed = parseAnswer(key, raw)
    if (!parsed) return
    const after = nextPath(step, { ...answers, [key]: parsed }, item.key, person, wordsUsed)
    dropAdvance()
    const mine = tapped.current
    const paused = new Promise<void>((done) => {
      advance.current = setTimeout(done, ADVANCE_MS)
    })
    void Promise.all([answerSave.saveNow(key, raw), paused]).then(([status]) => {
      if (tapped.current !== mine || status !== 'saved') return
      if (after.leaves) leave(after.path)
      else goTo(after.path)
    })
  }

  /** The chips she kept from her own words, saved as her taps are, all at once. */
  async function saveOwnWords(patch: StoredAnswers): Promise<ActionResult> {
    answerSave.flush()
    const raw: Partial<Record<QuestionKey, AnswerValue>> = {}
    for (const [key, stored] of Object.entries(patch) as [QuestionKey, StoredAnswer][]) {
      raw[key] = stored.value
    }
    const result = await saveAnswersAction(raw)
    if (result.ok) {
      setAnswers((current) => ({ ...current, ...patch }))
      setWordsUsed(true)
      if (ownStep) afterWords.current = afterOwnWords(ownStep, { ...answers, ...patch }, person)
    }
    return result
  }

  function changePerson(next: Relative | null) {
    setPerson(next)
    personSave.save(PERSON, next)
  }

  const { key } = item
  const question = key === PERSON ? null : questionOf(key)
  const multi = question?.control === 'multi'
  const answered = key === PERSON ? person !== null : answers[key] !== undefined
  const impact =
    answered || item.opensWithLine ? impactView(item.itemId, answers, person, englishScores) : null
  const tagStop = impact?.tag?.after.startsWith('.') ? '.' : ''
  const status = key === PERSON ? personSave.statusOf(key) : answerSave.statusOf(key)
  const notes = notesFor(question)

  return (
    <div ref={root} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 @max-xl:gap-4">
      <div className={cn(motion.rise, motion.d2, 'flex min-h-11 items-center')}>
        <StepKicker detail={`${index + 1} of ${asked.length}`}>{title}</StepKicker>
      </div>

      <div key={item.key} className={cn(styles.question, 'flex flex-col gap-5 @max-xl:gap-4')}>
        {item.group ? <p className="m-0 text-lead text-muted-foreground">{item.group}</p> : null}
        <StepHeading ref={heading} id={headingId} tabIndex={-1}>
          {item.question}
        </StepHeading>
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
              borrowed={borrowedAreas}
            />
          ) : (
            <AnswerCards
              question={question}
              labelledBy={headingId}
              answer={answers[question.key]}
              onAnswer={(raw) => answer(question.key, raw)}
              onChoose={(raw) => choose(question.key, raw)}
            />
          )}
          {key === 'eng' ? (
            <div className="mt-4">
              <ExactScore
                value={answers.eng?.state === 'stated' ? answers.eng.value : undefined}
                onAnswer={(raw) => answer('eng', raw)}
              />
            </div>
          ) : null}
        </div>

        {readOwnWordsAction && ownStep && item.key === asked[0]?.key ? (
          <OwnWordsBox
            step={ownStep}
            answers={answers}
            readAction={readOwnWordsAction}
            saveAnswers={saveOwnWords}
            onDone={() => {
              if (afterWords.current) goTo(afterWords.current)
            }}
          />
        ) : null}

        {/* Empty, the live region leaves the flow (it stays rendered for screen readers), so it
            adds no second gap between the cards and the note. */}
        <div aria-live="polite" className="flex flex-col gap-2 empty:absolute">
          {impact ? (
            <>
              <Note
                key={impact.text}
                tone="impact"
                appear
                icon={IMPACT_ICONS[impact.kind]}
                className={cn(
                  impact.kind === 'assume' && 'border-dashed',
                  impact.kind === 'limit' && 'border-neutral-600 bg-neutral-100',
                )}
              >
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
              </Note>
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
          <SaveFailed
            message={key === PERSON ? PERSON_SAVE_FAILED : ANSWER_SAVE_FAILED}
            onRetry={() => (key === PERSON ? personSave.retry(key) : answerSave.retry(key))}
          />
        ) : (
          <Note tone="hint" role="status" icon={NOTE_ICONS[status]}>
            {notes[status]}
          </Note>
        )}
      </div>

      {last ? null : (
        <Link
          href={forward}
          onClick={flush}
          className={cn(buttonVariants({ variant: 'text' }), 'self-start')}
        >
          {`Leave the rest for now: go to ${nextName}`}
        </Link>
      )}

      <StepActions className="justify-between">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => (index === 0 ? leave(backPath(step, answers)) : go(asked[index - 1].key))}
          className="min-w-33 @max-xl:min-w-24 @max-xl:flex-none"
        >
          <ArrowLeft aria-hidden="true" className="size-icon-sm" />
          Back
        </Button>
        <Button
          type="button"
          variant={last || answered ? 'strong' : 'outline'}
          size="lg"
          onClick={() => (onward.leaves ? leave(onward.path) : goTo(onward.path))}
          className="min-w-33 @max-xl:min-w-0 @max-xl:flex-1"
        >
          {last ? `Next: ${nextName}` : answered ? 'Continue' : 'Skip'}
          <ArrowRight aria-hidden="true" className="size-icon-sm" />
        </Button>
      </StepActions>
    </div>
  )
}

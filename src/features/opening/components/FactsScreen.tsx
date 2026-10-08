'use client'

import { ArrowLeft, ArrowRight, Check, CircleAlert, Info, LoaderCircle } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { SignOutButton } from '@/features/auth'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { AnswerValue, Relative, StoredAnswers } from '@/shared/types/student'
import { type SaveAnswers, type SaveStatus, useAnswerSave } from '../model/answer-save'
import { impactView } from '../model/impact'
import { ANSWER_SAVE_FAILED } from '../model/messages'
import {
  FACT_QUESTIONS,
  factIndexOfPath,
  factPath,
  PICTURE_PATH,
  STUDY_PATH,
} from '../model/onboarding'
import { parseAnswer, questionOf } from '../model/questions'
import { AnswerCards } from './AnswerCards'
import styles from './facts.module.css'
import shell from './onboarding.module.css'
import picture from './picture.module.css'

const LEAVE = "Leave the rest for now: go to What you'd study"
const NEXT = "Next: What you'd study"
const NOTES: Record<Exclude<SaveStatus, 'failed'>, string> = {
  idle: "“Not sure” is a fine answer. Skip, and I'll assume a sensible default you can change later.",
  saving: 'Saving…',
  saved: 'Saved. Tap another answer to change it.',
}
const NOTE_ICONS = {
  idle: <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />,
  saving: (
    <LoaderCircle aria-hidden="true" className={cn(picture.spin, 'mt-0.5 size-3.5 shrink-0')} />
  ),
  saved: <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />,
}

/**
 * Onboarding step 01, "Facts about you" (the design's Facts): one question per screen, the
 * question named by the URL's last segment, its slug. A tap shows what it does at once and saves in the background; a refused
 * save keeps the answer and offers to try again. Moving between questions changes only the URL
 * (history.pushState), so the screen and its saves stay; Skip stores nothing. Leaving the step
 * sends any save still waiting, so a quick tap is never lost.
 */
export function FactsScreen({
  answers: savedAnswers,
  relative,
  saveAnswersAction,
}: {
  answers: StoredAnswers
  relative: Relative | null
  saveAnswersAction: SaveAnswers
}) {
  const router = useRouter()
  const at = factIndexOfPath(usePathname())
  const index = at < 0 ? 0 : at
  const item = FACT_QUESTIONS[index] ?? FACT_QUESTIONS[0]
  const last = index === FACT_QUESTIONS.length - 1
  const [answers, setAnswers] = useState(savedAnswers)
  const { statusOf, save, retry, flush } = useAnswerSave(saveAnswersAction)
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const shown = useRef(index)
  const headingId = useId()

  // A new question takes focus, so a screen reader reads it; not the first one she lands on.
  useEffect(() => {
    if (shown.current === index) return
    shown.current = index
    heading.current?.focus({ preventScroll: true })
  }, [index])

  function answer(raw: AnswerValue) {
    const parsed = parseAnswer(item.key, raw)
    if (!parsed) return
    setAnswers((current) => ({ ...current, [item.key]: parsed }))
    save(item.key, raw)
  }

  function go(to: number) {
    window.history.pushState(null, '', factPath(FACT_QUESTIONS[to].key))
    const top = root.current?.getBoundingClientRect().top ?? 0
    if (top < 0) root.current?.scrollIntoView({ block: 'start' })
  }

  function leave(path: string) {
    flush()
    router.push(path)
  }

  const answered = answers[item.key] !== undefined
  const impact = answered ? impactView(item.itemId, answers, relative) : null
  const status = statusOf(item.key)

  return (
    <div ref={root} className="mx-auto flex w-full max-w-2xl flex-col gap-5 @max-xl:gap-4">
      <div className={cn(shell.rise, shell.d2, 'flex min-h-11 items-center justify-between gap-4')}>
        <p className="m-0 text-overline uppercase text-accent-700">
          Facts about you ·{' '}
          <b className="font-medium text-muted-foreground">
            {index + 1} of {FACT_QUESTIONS.length}
          </b>
        </p>
        <SignOutButton />
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
          <AnswerCards
            question={questionOf(item.key)}
            labelledBy={headingId}
            answer={answers[item.key]}
            onAnswer={answer}
          />
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
                    className="mt-1 size-3.5 shrink-0 text-accent-700"
                  />
                ) : null}
                {impact.kind === 'limit' ? (
                  <Info aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-neutral-700" />
                ) : null}
                <p className="m-0">
                  <span className="sr-only">What this does: </span>
                  <span>{impact.text}</span>
                  {impact.mock ? (
                    <>
                      {' · '}
                      <span className="border border-dashed border-neutral-500 px-1.5 text-overline uppercase tracking-[0.06em] text-muted-foreground">
                        mock
                      </span>
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
            <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-danger-700" />
            <span className="min-w-45 flex-1">{ANSWER_SAVE_FAILED}</span>
            <Button
              type="button"
              variant="outline"
              onClick={() => retry(item.key)}
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
            <span>{NOTES[status]}</span>
          </p>
        )}
      </div>

      {last ? null : (
        <Link
          href={STUDY_PATH}
          onClick={flush}
          className="inline-flex min-h-11 items-center self-start text-caption font-medium text-accent-700"
        >
          {LEAVE}
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
          onClick={() => (index === 0 ? leave(PICTURE_PATH) : go(index - 1))}
          className="min-w-33 @max-xl:min-w-24 @max-xl:flex-none"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back
        </Button>
        <Button
          type="button"
          variant={last || answered ? 'strong' : 'outline'}
          size="lg"
          onClick={() => (last ? leave(STUDY_PATH) : go(index + 1))}
          className="min-w-33 @max-xl:min-w-0 @max-xl:flex-1"
        >
          {last ? NEXT : answered ? 'Continue' : 'Skip'}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

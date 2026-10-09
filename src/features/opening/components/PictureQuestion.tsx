'use client'

import { ArrowRight, Check, CircleAlert, Info, LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import type { Persona } from '@/shared/types/student'
import { ANSWER_SAVE_FAILED } from '../model/messages'
import { FACT_QUESTIONS, factPath } from '../model/onboarding'
import shell from './onboarding.module.css'
import styles from './picture.module.css'

/** "Prefer not to say" stores 'neutral', as Skip and Start with nothing chosen do. */
const CHOICES = [
  { label: 'Male', persona: 'male', rise: shell.d5 },
  { label: 'Female', persona: 'female', rise: shell.d6 },
  { label: 'Prefer not to say', persona: 'neutral', rise: shell.d7 },
] as const satisfies readonly { label: string; persona: Persona; rise: string }[]

const OPTIONAL =
  "Optional. Skip, and we'll draw a neutral character. We never guess this from your name or photo."
const CLEAR = 'Press your choice again to clear it.'

type Status = 'idle' | 'saving' | 'failed'

/**
 * Onboarding step 00, "Your comic character" (the design's PictureQ), the step's own column in the
 * onboarding shell, whose panel says where she is and what comes next. The question offers three
 * figures, one at a time, and pressing the chosen one again clears it. Continue saves the choice
 * (neutral when none) and Skip saves neutral; while it saves the choices hold, and once saved
 * screen 1 opens at once. A failed save keeps her choice and offers to try again. Nothing else
 * sets the character, not her name or photo (criterion 15). The welcome greets her, so this step
 * opens on its kicker, and focus moves to the question. `persona` is her saved answer when she comes back from
 * screen 1: male or female is pressed again; neutral shows nothing pressed, since Skip and
 * "nothing chosen" save it too. On a phone (below @xl) the actions sit in a bar within thumb reach.
 */
export function PictureQuestion({
  savePersonaAction,
  persona,
}: {
  savePersonaAction: (persona: Persona) => Promise<ActionResult>
  persona: Persona | null
}) {
  const router = useRouter()
  const questionId = useId()
  const question = useRef<HTMLHeadingElement>(null)

  // Arriving (from the welcome's Start, or Back from screen 1): focus on the question.
  useEffect(() => {
    question.current?.focus({ preventScroll: true })
  }, [])
  const [choice, setChoice] = useState<Persona | null>(persona === 'neutral' ? null : persona)
  const [status, setStatus] = useState<Status>('idle')
  const saving = status === 'saving'

  function pick(persona: Persona) {
    if (saving) return
    setChoice(choice === persona ? null : persona)
    setStatus('idle')
  }

  async function save(persona: Persona) {
    if (saving) return
    setStatus('saving')
    try {
      const result = await savePersonaAction(persona)
      // Saved: still "Saving…" while screen 1 opens; a slow one shows the duck loader.
      if (result.ok) return router.push(factPath(FACT_QUESTIONS[0].key))
    } catch {
      // It never reached the server: said as a refusal is, below.
    }
    setStatus('failed')
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 @max-xl:gap-4.5">
      <p className={cn(shell.rise, shell.d2, 'm-0 text-overline uppercase text-accent-700')}>
        Your comic character · <b className="font-medium text-muted-foreground">optional</b>
      </p>
      <h1
        ref={question}
        id={questionId}
        tabIndex={-1}
        className={cn(
          shell.rise,
          shell.d3,
          'm-0 font-heading text-h1 font-semibold tracking-[-0.015em] outline-none',
        )}
      >
        How would you like your comic character drawn?
      </h1>
      <p
        className={cn(
          shell.rise,
          shell.d4,
          'm-0 max-w-prose leading-relaxed text-muted-foreground',
        )}
      >
        Later, short comics walk through each route with one student in them.{' '}
        <strong className="font-medium text-foreground">
          This only sets how that student is drawn.
        </strong>{' '}
        Nothing else reads your answer.
      </p>

      <fieldset
        aria-labelledby={questionId}
        className="m-0 mt-1 grid min-w-0 grid-cols-3 gap-4 border-0 p-0 @max-xl:grid-cols-1 @max-xl:gap-2.5"
      >
        {CHOICES.map((c) => {
          const chosen = choice === c.persona
          return (
            <Blueprint
              key={c.persona}
              as="button"
              type="button"
              aria-pressed={chosen}
              aria-disabled={saving || undefined}
              onClick={() => pick(c.persona)}
              className={cn(
                styles.choice,
                shell.rise,
                c.rise,
                c.persona === 'neutral' && styles.none,
                'flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 bg-transparent px-3 py-5 text-center font-heading text-h4 font-semibold text-foreground',
                'motion-safe:transition-[color,background-color,border-color,box-shadow] motion-safe:duration-200',
                'hover:not-aria-pressed:border-foreground/40 hover:not-aria-pressed:bg-foreground/4',
                'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary',
                'aria-pressed:border-accent-700 aria-pressed:bg-accent-100 aria-pressed:text-accent-800 aria-pressed:inset-ring aria-pressed:inset-ring-accent-700',
                'aria-disabled:cursor-default aria-disabled:not-aria-pressed:opacity-55',
                '@max-xl:min-h-18 @max-xl:flex-row @max-xl:justify-start @max-xl:gap-3.5 @max-xl:px-4 @max-xl:py-3 @max-xl:text-left',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  styles.art,
                  'block size-18 shrink-0 [--sw:1.5] @max-xl:size-11 @max-xl:[--sw:2.4]',
                )}
              >
                <Figure persona={c.persona} />
              </span>
              <span>{c.label}</span>
              <span
                aria-hidden="true"
                className={cn(
                  styles.tick,
                  'absolute top-2.5 right-2.5 flex size-5.5 items-center justify-center bg-accent-700 text-background @max-xl:static @max-xl:ml-auto',
                )}
              >
                <Check className="size-icon-sm" />
              </span>
            </Blueprint>
          )
        })}
      </fieldset>

      <p
        className={cn(
          shell.rise,
          shell.d7,
          'm-0 flex items-start gap-2 text-caption text-muted-foreground',
        )}
      >
        <Info aria-hidden="true" className="icon-on-line-sm size-icon-sm shrink-0" />
        <span>{choice ? CLEAR : OPTIONAL}</span>
      </p>

      {status === 'failed' ? (
        <div
          role="alert"
          className={cn(
            styles.errorIn,
            'flex items-start gap-2 border border-danger-300 bg-danger-100 px-3.5 py-2.5 text-caption text-danger-800',
          )}
        >
          <CircleAlert
            aria-hidden="true"
            className="icon-on-line size-icon shrink-0 text-danger-700"
          />
          <span>{ANSWER_SAVE_FAILED}</span>
        </div>
      ) : null}

      <div
        className={cn(
          shell.rise,
          shell.d8,
          'mt-1 flex items-center justify-end gap-3.5',
          '@max-xl:sticky @max-xl:bottom-0 @max-xl:z-5 @max-xl:-mx-4 @max-xl:border-t @max-xl:bg-background @max-xl:px-4 @max-xl:pt-3 @max-xl:pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-disabled={saving || undefined}
          onClick={() => void save('neutral')}
          className="min-w-33 aria-disabled:cursor-default aria-disabled:opacity-55 @max-xl:min-w-0 @max-xl:flex-1"
        >
          Skip
        </Button>
        <Button
          type="button"
          variant="strong"
          size="lg"
          aria-disabled={saving || undefined}
          onClick={() => void save(choice ?? 'neutral')}
          className="min-w-33 aria-disabled:cursor-default aria-disabled:opacity-55 @max-xl:min-w-0 @max-xl:flex-1"
        >
          {saving ? (
            <>
              <LoaderCircle aria-hidden="true" className={cn(styles.spin, 'size-icon-sm')} />
              Saving…
            </>
          ) : (
            <>
              {status === 'failed' ? 'Try again' : 'Continue'}
              <ArrowRight aria-hidden="true" className="size-icon-sm" />
            </>
          )}
        </Button>
      </div>

      <p role="status" className="sr-only">
        {saving ? 'Saving your answer' : ''}
      </p>
    </div>
  )
}

/**
 * A choice's figure, from the design's motion study: a body, a head, hair for male and female, a
 * face with three mouths and hover brows, and for "Prefer not to say" a puzzled face and a "?".
 */
function Figure({ persona }: { persona: Persona }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 72 72" className="block size-full overflow-visible">
      <g className={styles.body}>
        <path className={styles.s} pathLength={1} d="M14 66c0-12 9.5-19 22-19s22 7 22 19" />
      </g>
      <g className={styles.head}>
        <circle className={cn(styles.s, styles.i1)} pathLength={1} cx="36" cy="30" r="12" />
        {persona === 'male' ? (
          <g className={styles.hair}>
            <path
              className={cn(styles.s, styles.i2)}
              pathLength={1}
              d="M24.5 27c0-8 5-12.5 11.5-12.5S48 18.5 48 26c-3.5-4-8-5.5-12.5-5-4.5.5-8.5 2.5-11 6z"
            />
          </g>
        ) : null}
        {persona === 'female' ? (
          <g className={cn(styles.hair, styles.hairLong)}>
            <path
              className={cn(styles.s, styles.i2)}
              pathLength={1}
              d="M23 33c-1.5-12 4.5-19 13-19s14.5 7 13 19l1.5 10c-3.5 2-7 1.5-9-1"
            />
            <path
              className={cn(styles.s, styles.i3)}
              pathLength={1}
              d="M23 33l-1.5 10c3.5 2 7 1.5 9-1"
            />
            <path
              className={cn(styles.s, styles.i4)}
              pathLength={1}
              d="M25 25c4-1 8-4 10.5-8 2 4 7 7 12.5 8"
            />
          </g>
        ) : null}
        <g className={styles.face}>
          <g className={styles.eyes}>
            <circle className={styles.dot} cx="31.5" cy="29.5" r="1.5" />
            <circle className={styles.dot} cx="40.5" cy="29.5" r="1.5" />
          </g>
        </g>
        <g className={styles.face}>
          <g className={styles.brows}>
            <path className={styles.m} d="M29.6 26.4q1.9-1.1 3.8 0" />
            <path className={styles.m} d="M38.6 26.4q1.9-1.1 3.8 0" />
          </g>
        </g>
        <g className={styles.face}>
          <path className={cn(styles.m, styles.mouthFlat)} d="M33 35.5h6" />
          <path className={cn(styles.m, styles.mouthSoft)} d="M33 35c2 1.3 4 1.3 6 0" />
          <path className={cn(styles.m, styles.mouthSmile)} d="M31.5 34.3c2.8 2.8 6.2 2.8 9 0" />
        </g>
        {persona === 'neutral' ? (
          <g className={styles.face}>
            <g className={styles.browsQ}>
              <path className={styles.m} d="M29.6 27.2q1.9-.5 3.8 0" />
              <path className={styles.m} d="M38.6 25.4q1.9-1.8 3.8-.4" />
            </g>
            <path
              className={cn(styles.m, styles.mouthWavy)}
              d="M32.4 35.8q1.2-1.3 2.4 0t2.4 0t2.4 0"
            />
          </g>
        ) : null}
      </g>
      {persona === 'neutral' ? (
        <g className={styles.qmark}>
          <path
            className={styles.m}
            d="M49.2 11.6c0-2 1.6-3.4 3.5-3.4s3.4 1.3 3.4 3.1c0 2.7-3.4 2.6-3.4 5.3"
          />
          <circle className={styles.dot} cx="52.7" cy="20.4" r="1.2" />
        </g>
      ) : null}
      {persona === 'neutral' ? (
        <g className={styles.thumb}>
          <g transform="translate(45 2.5) scale(.6)">
            <path className={styles.m} d="M7 10v12" />
            <path
              className={styles.m}
              d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
            />
          </g>
        </g>
      ) : null}
    </svg>
  )
}

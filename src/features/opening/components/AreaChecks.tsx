'use client'

import { Check } from 'lucide-react'
import { useId, useState } from 'react'
import { AREA_FIELDS } from '@/features/engine'
import { cn } from '@/shared/lib/utils'
import { type AnswerValue, AREAS_MAX, type StoredAnswer } from '@/shared/types/student'
import type { Question } from '../model/questions'
import { Note } from './Note'

const MARKS = [1, 2, 3] as const
const REFUSAL = "Three is the most for now. Tap one you've chosen to make room."
const NOTE = 'Nearest field used for now'

/**
 * "Pick up to three" (step 02's one multi-select): the areas as checkbox cards under a count with
 * three marks. A tap chooses an area (at the end) or removes it; removing the last reports `null`,
 * a clear. A fourth tap changes nothing and shows a calm refusal until she removes an area; while
 * three are chosen the others read as full but stay pressable, since the refusal is the answer.
 * An area the preview has no courses for says it borrows the nearest field (AREA_FIELDS).
 * `labelledBy` is the id of the h1 that asks the question.
 */
export function AreaChecks({
  question,
  labelledBy,
  answer,
  onAnswer,
}: {
  question: Question
  labelledBy: string
  answer: StoredAnswer | undefined
  /** The areas now chosen, in the order she chose them; null when she removed the last one. */
  onAnswer: (raw: AnswerValue | null) => void
}) {
  const [refused, setRefused] = useState(false)
  const countId = useId()
  const value = answer?.value
  const chosen: readonly string[] = Array.isArray(value) && value.length <= AREAS_MAX ? value : []
  const full = chosen.length >= AREAS_MAX

  function tap(area: string) {
    if (chosen.includes(area)) {
      const next = chosen.filter((a) => a !== area)
      setRefused(false)
      onAnswer(next.length > 0 ? next : null)
    } else if (full) {
      setRefused(true)
    } else {
      onAnswer([...chosen, area])
    }
  }

  return (
    <div className="flex flex-col gap-4 @max-xl:gap-2.5">
      <p
        id={countId}
        aria-live="polite"
        className="m-0 mt-1 flex items-center gap-2.5 text-caption font-medium text-muted-foreground"
      >
        <span aria-hidden="true" className="inline-flex gap-1">
          {MARKS.map((n) => (
            <span
              key={n}
              className={cn(
                'h-1 w-3 bg-neutral-300 motion-safe:transition-colors motion-safe:duration-250',
                n <= chosen.length && 'bg-accent-700',
              )}
            />
          ))}
        </span>
        <span>{`${chosen.length} of ${AREAS_MAX} chosen`}</span>
      </p>

      {/* Rendered before the refusal, so a screen reader hears it arrive; empty, it leaves the flow
          (it stays rendered), so it adds no gap. */}
      <div role="status" aria-live="polite" className="empty:absolute">
        {refused ? (
          <Note
            tone="limit"
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-350 motion-safe:ease-out"
          >
            {REFUSAL}
          </Note>
        ) : null}
      </div>

      {/* A fieldset is a group; min-w-0 undoes its min-content width, so the grid can narrow. */}
      <fieldset
        aria-labelledby={labelledBy}
        aria-describedby={countId}
        className="mt-1 grid min-w-0 grid-cols-3 gap-3 @max-xl:grid-cols-2 @max-xl:gap-2.5"
      >
        {question.options.map((option) => {
          const area = String(option)
          const checked = chosen.includes(area)
          const borrowed = AREA_FIELDS[area]?.substitutedFrom !== undefined
          return (
            // biome-ignore lint/a11y/useSemanticElements: a card holding a name, a note and a box is not an input; the checkbox pattern on a native button is built here
            <button
              key={area}
              type="button"
              role="checkbox"
              aria-checked={checked}
              data-full={(full && !checked) || undefined}
              onClick={() => tap(area)}
              className={cn(
                'group relative flex min-h-16 cursor-pointer items-center border border-border bg-transparent py-3 pr-12 pl-4 text-left font-heading text-h4 font-semibold text-foreground',
                'motion-safe:transition-[color,background-color,border-color,box-shadow] motion-safe:duration-200',
                'hover:not-aria-checked:border-foreground/40 hover:not-aria-checked:bg-foreground/4',
                'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary',
                'aria-checked:border-accent-700 aria-checked:bg-accent-100 aria-checked:text-accent-800 aria-checked:inset-ring aria-checked:inset-ring-accent-700',
                'data-full:text-muted-foreground',
                '@max-xl:min-h-14 @max-xl:py-2.5 @max-xl:pr-10 @max-xl:pl-3',
              )}
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span>{area}</span>
                {borrowed ? (
                  <span className="font-sans text-caption leading-snug font-normal text-muted-foreground group-aria-checked:text-accent-800">
                    {NOTE}
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-1/2 right-3.5 flex size-5.5 -translate-y-1/2 items-center justify-center border border-neutral-500 text-transparent',
                  'motion-safe:transition-[color,background-color,border-color] motion-safe:duration-200',
                  'group-hover:border-foreground group-data-full:border-dashed',
                  'group-aria-checked:border-accent-700 group-aria-checked:bg-accent-700 group-aria-checked:text-background',
                  '@max-xl:right-2.5 @max-xl:size-5',
                )}
              >
                <Check className="size-icon-sm" />
              </span>
            </button>
          )
        })}
      </fieldset>
    </div>
  )
}

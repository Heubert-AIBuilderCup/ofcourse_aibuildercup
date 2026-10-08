'use client'

import { Check } from 'lucide-react'
import { type KeyboardEvent, useRef } from 'react'
import { cn } from '@/shared/lib/utils'
import type { AnswerValue, StoredAnswer } from '@/shared/types/student'
import { NOT_SURE, type Question } from '../model/questions'
import { labelOf } from './OptionButtons'

/**
 * A single-choice question's options as a radiogroup of cards, then "Not sure" when the question
 * offers it (step 01 asks 'chips' and 'select' questions this way, never 'multi'). A stated answer
 * checks its card; an assumed one ("Not sure" was tapped) checks "Not sure". One card is in the
 * tab order, the checked one (the first when none is), and the arrow keys, Home and End move to a
 * card and pick it as they go, wrapping at the ends. Pressing the checked card again does nothing.
 * `labelledBy` is the id of the h1 that asks the question.
 */
export function AnswerCards({
  question,
  labelledBy,
  answer,
  onAnswer,
}: {
  question: Question
  labelledBy: string
  answer: StoredAnswer | undefined
  onAnswer: (raw: AnswerValue) => void
}) {
  const cards = useRef<(HTMLButtonElement | null)[]>([])
  const options: readonly AnswerValue[] = question.notSure
    ? [...question.options, NOT_SURE]
    : question.options
  const assumed = answer?.state === 'assumed'
  const stated = answer?.state === 'stated' ? answer.value : undefined

  const isChecked = (option: AnswerValue, unsure: boolean) => (unsure ? assumed : stated === option)
  const isUnsure = (i: number) => question.notSure && i === options.length - 1
  const checkedAt = options.findIndex((o, i) => isChecked(o, isUnsure(i)))
  const tabStop = checkedAt < 0 ? 0 : checkedAt

  function pick(i: number) {
    onAnswer(options[i])
    cards.current[i]?.focus()
  }

  function onKeyDown(e: KeyboardEvent, i: number) {
    const last = options.length - 1
    const target =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? i === last
          ? 0
          : i + 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? i === 0
            ? last
            : i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : -1
    if (target < 0) return
    e.preventDefault()
    pick(target)
  }

  const four = options.length === 4
  const compact = options.length <= 4

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={cn(
        'mt-1 grid gap-3 @max-xl:gap-2.5',
        four ? 'grid-cols-2' : 'grid-cols-3',
        compact ? '@max-xl:grid-cols-1' : '@max-xl:grid-cols-2',
      )}
    >
      {options.map((option, i) => {
        const unsure = isUnsure(i)
        const checked = isChecked(option, unsure)
        return (
          // biome-ignore lint/a11y/useSemanticElements: a card holding a label and a tick is not an input; the radiogroup pattern with roving tabindex is built here
          <button
            key={String(option)}
            ref={(el) => {
              cards.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => {
              if (!checked) onAnswer(option)
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'group relative flex min-h-16 cursor-pointer items-center gap-2.5 border border-border bg-transparent py-3 pr-10 pl-4 text-left font-heading text-h4 font-semibold text-foreground',
              'motion-safe:transition-[color,background-color,border-color,box-shadow] motion-safe:duration-200',
              'hover:not-aria-checked:border-foreground/40 hover:not-aria-checked:bg-foreground/4',
              'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary',
              'aria-checked:border-accent-700 aria-checked:bg-accent-100 aria-checked:text-accent-800 aria-checked:inset-ring aria-checked:inset-ring-accent-700',
              '@max-xl:min-h-14 @max-xl:py-2.5 @max-xl:pl-3.5',
              unsure &&
                'border-dashed font-sans text-base font-medium text-muted-foreground aria-checked:border-solid',
            )}
          >
            {unsure ? (
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-caption leading-none"
              >
                ?
              </span>
            ) : null}
            <span>{labelOf(option)}</span>
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-1/2 right-3 flex size-5.5 -translate-y-1/2 items-center justify-center bg-accent-700 text-background',
                'scale-0 group-aria-checked:scale-100',
                'motion-safe:transition-[scale] motion-safe:duration-300 motion-safe:ease-(--spring)',
              )}
            >
              <Check className="size-icon-sm" />
            </span>
          </button>
        )
      })}
    </div>
  )
}

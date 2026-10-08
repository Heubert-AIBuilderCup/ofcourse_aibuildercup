'use client'

import type { ComponentProps } from 'react'
import { Button } from '@/shared/components/ui/button'
import type { AnswerValue, StoredAnswer } from '@/shared/types/student'
import { NOT_SURE, type Question } from '../model/questions'

const AREAS_MAX = 3

/** A native select, drawn as the Input is. */
export const NATIVE_SELECT =
  'h-11 w-full max-w-sm rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/** A question's options, side by side and wrapping (a fieldset, so a group named by its label). */
export const OPTIONS = 'flex min-w-0 flex-wrap gap-2'

/** An option: an outline button, pressed in the selected-row tint. Long labels wrap. */
export function OptionToggle({
  pressed,
  ...props
}: { pressed: boolean } & ComponentProps<'button'>) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={pressed}
      className="h-auto min-h-11 whitespace-normal font-sans text-base font-normal aria-pressed:border-primary aria-pressed:bg-accent-200"
      {...props}
    />
  )
}

/** "AUD 24k" for an amount (the only numbers); any other option reads as itself. */
export const labelOf = (option: AnswerValue): string =>
  typeof option === 'number' ? `AUD ${option}k` : String(option)

/**
 * One question's options: toggle buttons, a native select (where she is now), or up to three
 * toggles (areas), with "Not sure" where the question offers it. Shows the stored answer and
 * reports a tap as what parseAnswer takes: an option, "Not sure", or the areas now chosen.
 */
export function OptionButtons({
  question,
  answer,
  labelledBy,
  onAnswer,
}: {
  question: Question
  answer: StoredAnswer | undefined
  /** The id of the text that asks the question: its label, or the item's title. */
  labelledBy: string
  onAnswer: (raw: AnswerValue) => void
}) {
  const assumed = answer?.state === 'assumed'
  const stated = answer?.state === 'stated' ? answer.value : undefined

  if (question.control === 'select') {
    return (
      <select
        aria-labelledby={labelledBy}
        value={assumed ? NOT_SURE : stated === undefined ? '' : String(stated)}
        onChange={(e) => onAnswer(e.target.value)}
        className={NATIVE_SELECT}
      >
        <option value="" disabled>
          Choose one
        </option>
        {question.options.map((option) => (
          <option key={String(option)} value={String(option)}>
            {labelOf(option)}
          </option>
        ))}
        {question.notSure ? <option value={NOT_SURE}>{NOT_SURE}</option> : null}
      </select>
    )
  }

  if (question.control === 'multi') {
    const chosen = Array.isArray(stated) ? stated : []
    // An answer is one to three areas, so the last one chosen stays.
    const toggle = (area: string) => {
      const next = chosen.includes(area) ? chosen.filter((a) => a !== area) : [...chosen, area]
      if (next.length > 0) onAnswer(next)
    }
    return (
      <fieldset aria-labelledby={labelledBy} className={OPTIONS}>
        {question.options.map(String).map((area) => (
          <OptionToggle
            key={area}
            pressed={chosen.includes(area)}
            disabled={!chosen.includes(area) && chosen.length >= AREAS_MAX}
            onClick={() => toggle(area)}
          >
            {area}
          </OptionToggle>
        ))}
      </fieldset>
    )
  }

  return (
    <fieldset aria-labelledby={labelledBy} className={OPTIONS}>
      {question.options.map((option) => (
        <OptionToggle
          key={String(option)}
          pressed={stated === option}
          onClick={() => onAnswer(option)}
        >
          {labelOf(option)}
        </OptionToggle>
      ))}
      {question.notSure ? (
        <OptionToggle pressed={assumed} onClick={() => onAnswer(NOT_SURE)}>
          {NOT_SURE}
        </OptionToggle>
      ) : null}
    </fieldset>
  )
}

'use client'

import { type FormEvent, useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  ENGLISH_TEST_NAMES,
  ENGLISH_TESTS,
  type EnglishTest,
  englishError,
  exactScore,
  parseEnglish,
} from '../model/english'
import { questionOf } from '../model/questions'

const LABEL = 'mb-1.5 block text-caption font-medium text-muted-foreground'
const FIELD =
  'block min-h-12 w-full border border-input bg-muted px-3.5 py-2.5 text-base text-foreground caret-primary hover:border-foreground/45 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors'

/** Her answer when it is an exact score no quick option holds ("PTE 58"); else nothing. */
const exactOf = (value: unknown) =>
  questionOf('eng').options.includes(value as string) ? null : parseEnglish(value)

/**
 * The English question's way to give an exact score under its quick options: a test picker and
 * one number field, opened by "Enter my exact score" (already open on a score she gave). "Use this
 * score" hands on the stored form ("PTE 58"); a score outside the test's range says the range and
 * hands on nothing. `value` is the answer now (for the open field to show it).
 */
export function ExactScore({
  value,
  onAnswer,
}: {
  value: unknown
  onAnswer: (raw: string) => void
}) {
  const id = useId()
  const given = exactOf(value)
  const [open, setOpen] = useState(given !== null)
  const [test, setTest] = useState<EnglishTest>(given?.test ?? 'IELTS')
  const [typed, setTyped] = useState(given ? String(given.score) : '')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const stored = exactScore(test, typed)
    if (stored === null) {
      setError(englishError(test))
      return
    }
    setError(null)
    onAnswer(stored)
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="text"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        className="self-start"
      >
        Enter my exact score
      </Button>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 @max-xl:grid-cols-1">
        <div>
          <label htmlFor={`${id}-test`} className={LABEL}>
            Test
          </label>
          <select
            id={`${id}-test`}
            value={test}
            onChange={(e) => {
              setTest(e.target.value as EnglishTest)
              setError(null)
            }}
            className={`${FIELD} cursor-pointer`}
          >
            {ENGLISH_TESTS.map((t) => (
              <option key={t} value={t}>
                {ENGLISH_TEST_NAMES[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-score`} className={LABEL}>
            Score
          </label>
          <input
            id={`${id}-score`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            maxLength={5}
            value={typed}
            aria-invalid={error !== null}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => {
              setTyped(e.target.value)
              setError(null)
            }}
            className={FIELD}
          />
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="m-0 text-caption text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" className="h-11 self-start">
        Use this score
      </Button>
    </form>
  )
}

'use client'

import { LoaderCircle } from 'lucide-react'
import { useId, useState } from 'react'
import motion from '@/shared/components/motion.module.css'
import { Note } from '@/shared/components/Note'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import {
  OWN_WORDS_MAX,
  type OwnWordsStep,
  type RoadmapTag,
  type StoredAnswers,
} from '@/shared/types/student'
import { SAVE_FAILED } from '../model/messages'
import { OWN_WORDS_STEP_OF, QUESTION_STEPS } from '../model/onboarding'
// Its type alone: own-words.ts loads the full zod, which must stay out of the browser.
import type { OwnWordsChip } from '../model/own-words'
import { ownWordsPatch } from '../model/own-words-next'
import { display } from '../model/questions'
import { SaveFailed } from './SaveFailed'

/** Reads her words on a step (readOwnWordsAction): chips for its questions, tags for the rest. */
export type ReadOwnWords = (
  step: OwnWordsStep,
  text: string,
) => Promise<ActionResult<{ chips: OwnWordsChip[]; tags: RoadmapTag[]; failed: boolean }>>

/** Criterion 42, word for word. */
const NOTHING_READ = "I couldn't pick anything out; the questions below are the same"

type Reading = { chips: OwnWordsChip[]; tags: RoadmapTag[] }

/**
 * "Tell me in your own words" at the top of a question step. Her words are read (`readAction`) into
 * chips, each quoting her: an ordinary one starts selected; one that needs a tap (a high-stakes
 * field, or a change to an answer she gave) starts unselected. "Use these" stores the chips she
 * kept (`saveAnswers`, once; none her `answers` with them would not ask) and moves on (`onDone`).
 * The tags show the words she wrote. While it reads, the box is busy and its button says so. A
 * reading that fails, is refused or finds nothing says so, and the questions below carry on.
 */
export function OwnWordsBox({
  step,
  answers,
  readAction,
  saveAnswers,
  onDone,
}: {
  step: OwnWordsStep
  /** Her answers on screen, which decide what the chips' questions are asked. */
  answers: StoredAnswers
  readAction: ReadOwnWords
  saveAnswers: (patch: StoredAnswers) => Promise<ActionResult>
  onDone: () => void
}) {
  const headingId = useId()
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const [read, setRead] = useState<Reading | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const questions = QUESTION_STEPS[OWN_WORDS_STEP_OF[step]].questions

  async function readWords() {
    setReading(true)
    setRead(null)
    setFailed(false)
    setSaveFailed(false)
    try {
      const result = await readAction(step, text.trim())
      if (!result.ok || result.failed) {
        setFailed(true)
      } else {
        setRead({ chips: result.chips, tags: result.tags })
        setSelected(new Set(result.chips.flatMap((chip, i) => (chip.needsTap ? [] : [i]))))
      }
    } catch {
      setFailed(true)
    }
    setReading(false)
  }

  function toggle(i: number) {
    setSelected((was) => {
      const next = new Set(was)
      if (!next.delete(i)) next.add(i)
      return next
    })
  }

  async function use() {
    if (!read) return
    setSaving(true)
    setSaveFailed(false)
    let ok = false
    try {
      ok = (await saveAnswers(ownWordsPatch(read.chips, selected, answers))).ok
    } catch {
      // It never reached the server: said as a refusal is.
    }
    setSaving(false)
    if (!ok) return setSaveFailed(true)
    setRead(null)
    onDone()
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={reading}
      className="flex flex-col gap-3 border p-4"
    >
      <h2 id={headingId} className="m-0 text-h4">
        Tell me in your own words
      </h2>
      <p className="m-0 max-w-prose text-muted-foreground">
        Write it the way you'd say it. I'll pick out answers to the questions below, and you choose
        which to use.
      </p>
      <Textarea
        aria-labelledby={headingId}
        value={text}
        maxLength={OWN_WORDS_MAX}
        onChange={(e) => setText(e.target.value)}
        className="min-h-24 text-base"
      />
      <Button
        type="button"
        variant="outline"
        disabled={reading || text.trim() === ''}
        onClick={readWords}
        className="self-start"
      >
        {reading ? (
          <LoaderCircle aria-hidden="true" className={cn(motion.spin, 'size-icon-sm')} />
        ) : null}
        {reading ? 'Reading…' : 'Read my words'}
      </Button>

      <div aria-live="polite" className="flex flex-col gap-3 empty:hidden">
        {failed ? <Note tone="limit">{NOTHING_READ}</Note> : null}
        {read && read.chips.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {read.chips.map((chip, i) => {
              const on = selected.has(i)
              const question = questions.find((q) => q.key === chip.key)?.question
              return (
                <li key={chip.key}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(i)}
                    className={cn(
                      'flex min-h-11 cursor-pointer flex-col items-start gap-0.5 border border-dashed border-border bg-transparent px-3 py-2 text-left text-foreground',
                      'hover:not-aria-pressed:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary',
                      'aria-pressed:border-solid aria-pressed:border-accent-700 aria-pressed:bg-accent-100 aria-pressed:text-accent-800',
                    )}
                  >
                    <span className="text-caption text-muted-foreground">{question}</span>
                    <span className="font-medium">
                      {chip.key === 'amount' ? `AUD ${chip.value}k` : display(chip.value)}
                    </span>
                    <span className="text-caption text-muted-foreground">“{chip.quote}”</span>
                    {chip.change ? (
                      <span className="text-caption font-medium">Would change your answer</span>
                    ) : null}
                    {chip.needsTap && !on ? (
                      <span className="text-overline text-accent-700 uppercase">Tap to use</span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
        {read && read.tags.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-caption text-muted-foreground">Kept with your answers</p>
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {read.tags.map((tag) => (
                <li
                  key={`${tag.text}|${tag.quote}`}
                  className="border border-dashed border-neutral-500 px-2 py-0.5 text-caption text-muted-foreground"
                >
                  “{tag.quote}”
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {saveFailed ? <SaveFailed message={SAVE_FAILED} /> : null}
      {read && read.chips.length > 0 ? (
        <Button
          type="button"
          variant="strong"
          disabled={saving || selected.size === 0}
          onClick={use}
          className="self-start"
        >
          Use these
        </Button>
      ) : null}
    </section>
  )
}

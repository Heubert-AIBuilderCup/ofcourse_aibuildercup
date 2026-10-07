'use client'

import { useId } from 'react'
import { Button } from '@/shared/components/ui/button'
import type { AnswerValue, QuestionKey, StoredAnswer, StoredAnswers } from '@/shared/types/student'
import {
  chipText,
  editLabel,
  effective,
  PARTICULAR,
  type Question,
  questionOf,
  SUGGEST_ME,
} from '../model/questions'
import { OPTIONS, OptionButtons } from './OptionButtons'

/** The field's editor: the four fields and "Suggest me", which stands in for "Not sure". */
const fieldQuestion = (): Question => {
  const field = questionOf('field')
  return { ...field, options: [...field.options, SUGGEST_ME], notSure: false }
}

/** What the field's editor shows as chosen: the field she named, or "Suggest me" if she said it. */
function fieldAnswer(answers: StoredAnswers): StoredAnswer | undefined {
  const know = effective(answers, 'know')
  if (know === PARTICULAR) return answers.field
  if (know === SUGGEST_ME && answers.know?.state === 'stated') {
    return { value: SUGGEST_ME, state: 'stated' }
  }
  return undefined
}

/** The label as a sentence: a question keeps its own mark. */
const asSentence = (label: string) => (label.endsWith('?') ? label : `${label}.`)

/** A chip's question, open in place under it: "<question>. All three futures redraw." */
export function ChipEditor({
  id,
  chipKey,
  answers,
  onChoose,
}: {
  id: string
  chipKey: QuestionKey
  answers: StoredAnswers
  onChoose: (key: QuestionKey, raw: AnswerValue) => void
}) {
  const headingId = useId()
  const isField = chipKey === 'field'
  return (
    <div id={id} className="flex flex-col gap-2 border-l-2 border-primary bg-accent-100 px-3 py-2">
      <p id={headingId} className="m-0 font-heading text-h4">
        {`${asSentence(editLabel(chipKey))} All three futures redraw.`}
      </p>
      <OptionButtons
        question={isField ? fieldQuestion() : questionOf(chipKey)}
        answer={isField ? fieldAnswer(answers) : answers[chipKey]}
        labelledBy={headingId}
        onAnswer={(raw) => onChoose(chipKey, raw)}
      />
    </div>
  )
}

/**
 * The answers a view rests on, as chips; pressing one opens its editor under the chips. `scope`
 * names where the chips sit, so only the chip she pressed opens.
 */
export function ChipList({
  scope,
  keys,
  answers,
  open,
  onToggle,
  onChoose,
}: {
  scope: string
  keys: readonly QuestionKey[]
  answers: StoredAnswers
  /** The open chip, as `${scope}:${key}`, or null. */
  open: string | null
  onToggle: (chip: string) => void
  onChoose: (key: QuestionKey, raw: AnswerValue) => void
}) {
  const id = useId()
  const openKey = keys.find((key) => open === `${scope}:${key}`)
  return (
    <div className="flex flex-col gap-2">
      <div className={OPTIONS}>
        {keys.map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={key === openKey}
            aria-controls={key === openKey ? `${id}-editor` : undefined}
            className="h-auto min-h-9 whitespace-normal font-sans font-normal aria-expanded:border-primary aria-expanded:bg-accent-200"
            onClick={() => onToggle(`${scope}:${key}`)}
          >
            {chipText(key, answers)}
          </Button>
        ))}
      </div>
      {openKey ? (
        <ChipEditor id={`${id}-editor`} chipKey={openKey} answers={answers} onChoose={onChoose} />
      ) : null}
    </div>
  )
}

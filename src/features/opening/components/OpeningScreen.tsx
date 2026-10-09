'use client'

import Link from 'next/link'
import { type ReactNode, useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FrameMarks } from '@/shared/components/Blueprint'
import { buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import {
  type AnswerValue,
  OPENING_STEPS,
  type QuestionKey,
  type Relative,
  type StoredAnswers,
} from '@/shared/types/student'
import { impactLine } from '../model/impact'
import { SAVE_FAILED } from '../model/messages'
import { ONBOARDING_PATH, questionPath } from '../model/onboarding'
import { type Item, isVisible, parseAnswer, type Screen } from '../model/questions'
import { Hero } from './Hero'
import { OptionButtons } from './OptionButtons'
import { Progress, SCREEN_COUNT } from './Progress'
import { RelativeForm } from './RelativeForm'

const FUTURES_PATH = '/futures'
// Screen 3's Back: step 02's last question, on the onboarding shell.
const STUDY_BACK_PATH = questionPath(2, 'length')

const stepPath = (index: number) => `${ONBOARDING_PATH}/${OPENING_STEPS[index]}`

/** One item: its title, each question she is shown, and the line on what her answers do. */
function ItemBlock({
  item,
  answers,
  line,
  onAnswer,
  children,
}: {
  item: Item
  answers: StoredAnswers
  line: string | null
  onAnswer: (key: QuestionKey, raw: AnswerValue) => void
  children?: ReactNode
}) {
  const id = useId()
  const titleId = `${id}-title`
  return (
    <div className="flex flex-col gap-3">
      <h2 id={titleId} className="m-0 font-heading text-h4">
        {item.title}
      </h2>
      {item.questions
        .filter((question) => isVisible(question.key, answers))
        .map((question) => {
          // A question with no label is asked by the item's title.
          const labelId = question.label ? `${id}-${question.key}` : titleId
          return (
            <div key={question.key} className="flex flex-col gap-2">
              {question.label ? (
                <p id={labelId} className="m-0 text-caption text-muted-foreground">
                  {question.label}
                </p>
              ) : null}
              <OptionButtons
                question={question}
                answer={answers[question.key]}
                labelledBy={labelId}
                onAnswer={(raw) => onAnswer(question.key, raw)}
              />
            </div>
          )
        })}
      {children}
      {/* Always in the page, so a screen reader hears the line that appears after a tap. */}
      <div role="status">
        {line ? (
          <p className="m-0 border-l-2 border-primary bg-accent-100 px-3 py-2">{line}</p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Opening screens 3–4, living and after (frames r1-3 and r1-4, desktop r1-10); steps 01 and 02 are
 * on the onboarding shell. A tap shows its answer and impact
 * line at once, from local state, and saves in the background; a refused save is said in a toast
 * and the answer stays on the screen. The futures read what was saved.
 */
export function OpeningScreen({
  screen,
  answers: savedAnswers,
  relative: savedRelative,
  saveAnswersAction,
  saveRelativeAction,
}: {
  screen: Screen
  answers: StoredAnswers
  relative: Relative | null
  saveAnswersAction: (patch: Partial<Record<QuestionKey, AnswerValue>>) => Promise<ActionResult>
  saveRelativeAction: (relative: Relative | null) => Promise<ActionResult>
}) {
  const [answers, setAnswers] = useState(savedAnswers)
  const [relative, setRelative] = useState(savedRelative)
  const [, startTransition] = useTransition()

  const save = (write: () => Promise<ActionResult>) =>
    startTransition(async () => {
      try {
        const result = await write()
        if (!result.ok) toast.error(result.error)
      } catch {
        toast.error(SAVE_FAILED)
      }
    })

  function saveRelative(next: Relative | null) {
    setRelative(next)
    save(() => saveRelativeAction(next))
  }

  function answer(key: QuestionKey, raw: AnswerValue) {
    const parsed = parseAnswer(key, raw)
    if (!parsed) return
    setAnswers((current) => ({ ...current, [key]: parsed }))
    save(() => saveAnswersAction({ [key]: raw }))
    // Her person goes with "Yes"; any other answer forgets them.
    if (key === 'knows' && parsed.value !== 'Yes' && relative !== null) saveRelative(null)
  }

  const index = screen.number - 1
  const back = index === 2 ? STUDY_BACK_PATH : stepPath(index - 1)
  const next = index < OPENING_STEPS.length - 1 ? stepPath(index + 1) : FUTURES_PATH
  const asksWho = isVisible('knows', answers) && answers.knows?.value === 'Yes'

  return (
    // The container the phone layout (@max-[35rem]) and the two columns (@min-[48rem]) query.
    <div className="@container">
      <Hero
        overline={`Getting started · step ${screen.number} of ${SCREEN_COUNT}`}
        title={screen.title}
        sub={screen.sub}
      />
      <div className="flex max-w-5xl flex-col gap-block px-gutter py-section @max-[35rem]:px-5 @max-[35rem]:py-6">
        <Progress step={screen.number} />
        <div className="grid items-start gap-block @min-[48rem]:grid-cols-2">
          {screen.items.map((item) => (
            <ItemBlock
              key={item.id}
              item={item}
              answers={answers}
              line={impactLine(item.id, answers, relative)}
              onAnswer={answer}
            >
              {item.id === 'community' && asksWho ? (
                <RelativeForm relative={relative} onSave={saveRelative} />
              ) : null}
            </ItemBlock>
          ))}
        </div>
        <footer className="flex max-w-xl flex-col gap-3">
          <div className="flex gap-2">
            {back ? (
              <Link href={back} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                <FrameMarks />
                Back
              </Link>
            ) : null}
            <Link
              href={next}
              className={cn(
                buttonVariants({ variant: 'strong', size: 'lg' }),
                'h-auto min-h-11 flex-1 whitespace-normal text-center',
              )}
            >
              <FrameMarks />
              {screen.next}
            </Link>
          </div>
          <p className="m-0 text-caption text-muted-foreground">
            “Not sure” is fine anywhere. It becomes an assumption you can correct on each future.
          </p>
        </footer>
      </div>
    </div>
  )
}

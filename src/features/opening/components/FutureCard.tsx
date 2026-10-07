'use client'

import { House } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import {
  BANDS,
  DIMENSION_LABELS,
  type Dimension,
  FEELS,
  type Future,
  type FutureLine,
} from '@/features/engine'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

const PIPS_MAX = 5

const MARKS = {
  gives: '▲ Gives you',
  costs: '▼ Costs you',
  neutral: '● Neutral',
} as const

/** Each effect's left edge has its own shape, so no line is told apart by colour alone (DS-R4). */
const EDGES = {
  gives: 'border-solid border-primary',
  costs: 'border-dashed border-foreground',
  neutral: 'border-dotted border-foreground',
} as const

const labelsOf = (dims: Dimension[]) => dims.map((dim) => DIMENSION_LABELS[dim]).join(', ')

const OVERLINE = 'm-0 text-overline uppercase text-muted-foreground'
const DISCLOSURE =
  'text-caption underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** One dimension: its mark, its words, how sure we are, and how it might feel. */
function Line({ line, changed }: { line: FutureLine; changed: boolean }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const { claim } = line
  const pips = '●'.repeat(claim.pips) + '○'.repeat(PIPS_MAX - claim.pips)
  return (
    <li
      className={cn(
        'flex flex-col gap-1 border-l-2 py-2 pl-3',
        EDGES[line.effect],
        changed && 'bg-accent-100',
      )}
    >
      <p className={OVERLINE}>
        {`${DIMENSION_LABELS[line.dim]} · ${MARKS[line.effect]}`}
        {line.weighMost ? ' · You weigh this most' : ''}
      </p>
      <p className={cn('m-0', line.weighMost && 'font-heading text-h4')}>{line.text}</p>
      <p className="m-0 flex flex-wrap items-center gap-2 text-caption">
        <span role="img" aria-label={`Strength ${claim.pips} of ${PIPS_MAX}`}>
          {pips}
        </span>
        <span className="text-muted-foreground">{`${BANDS[claim.pips]} · ${claim.state}`}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-how`}
          className={DISCLOSURE}
          onClick={() => setOpen((o) => !o)}
        >
          How we know
        </button>
      </p>
      {open ? (
        <div id={`${id}-how`} className="flex flex-col gap-1 text-caption">
          {claim.detail.map((detail) => (
            <p key={detail} className="m-0">
              {detail}
            </p>
          ))}
          <p className="m-0 text-muted-foreground">{`Source: ${claim.source} · ${claim.date}`}</p>
        </div>
      ) : null}
      {claim.notSure ? (
        <p className="m-0 border border-dotted border-foreground px-3 py-2 text-caption">
          We're not sure about this yet.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-caption">
        <p className="m-0">{`Might feel: ${line.feel}`}</p>
        <ul className="m-0 flex list-none gap-1 p-0">
          {FEELS.map((feel) => (
            <li
              key={feel}
              aria-current={feel === line.feel ? 'true' : undefined}
              className={cn(
                'border px-2',
                feel === line.feel ? 'border-foreground bg-foreground text-background' : '',
              )}
            >
              {feel}
            </li>
          ))}
        </ul>
      </div>
      {changed ? <p className={OVERLINE}>Changed with your answer</p> : null}
    </li>
  )
}

/**
 * One future (frames r1-5, r1-6, r7d-0, r8c-2): what it is built around, its route, how far it is
 * from her person, its six lines, the answers it rests on and one way to keep options open. No
 * number and no order word: the three sit side by side, unranked.
 */
export function FutureCard({
  future,
  changed,
  redrawn,
  notes,
  chips,
  reminderSet,
  reminding,
  onRemind,
}: {
  future: Future
  /** The dimensions the last redraw changed on this future; undefined when nothing changed. */
  changed: Dimension[] | undefined
  /** What the last redraw changed, as the tag reads it. */
  redrawn: string | null
  /** What the futures stand in for, said on every card (a field the preview lacks). */
  notes: string[]
  /** The chips, with their editor (ChipList). */
  chips: ReactNode
  reminderSet: boolean
  reminding: boolean
  onRemind: () => void
}) {
  const headingId = useId()
  return (
    <Blueprint as="article" aria-labelledby={headingId} className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={headingId} className={cn(OVERLINE, 'font-sans font-normal')}>
          {future.heading}
        </h2>
        {changed && redrawn ? (
          <p className="m-0 bg-accent-100 px-2 text-caption">{`Redrawn: ${redrawn}`}</p>
        ) : null}
      </div>
      <h3 className="m-0 font-heading text-h3">{future.route}</h3>
      {future.distance ? (
        <p className="m-0 flex items-start gap-2 text-caption">
          <House aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-3.5 shrink-0" />
          {future.distance}
        </p>
      ) : null}
      {notes.map((note) => (
        <p key={note} className="m-0 border-l-2 border-primary bg-accent-100 px-3 py-2">
          {note}
        </p>
      ))}
      <div className="flex flex-col gap-1">
        {future.strongOn.length > 0 ? (
          <p className="m-0 font-semibold">
            {`Strong on what you weight most: ${labelsOf(future.strongOn)}`}
          </p>
        ) : null}
        {future.costsOn.length > 0 ? (
          <p className="m-0">{`Costs you on: ${labelsOf(future.costsOn)}`}</p>
        ) : null}
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {future.lines.map((line) => (
          <Line key={line.dim} line={line} changed={changed?.includes(line.dim) ?? false} />
        ))}
      </ul>
      <section className="flex flex-col gap-2">
        <p className={OVERLINE}>What I assumed · tap to correct</p>
        {chips}
      </section>
      <section className="flex flex-col gap-2">
        <p className={OVERLINE}>Keep options open</p>
        <p className="m-0">
          {`${future.keepOpen.text} · `}
          <strong>{future.keepOpen.doors}</strong>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={reminderSet || reminding}
          onClick={onRemind}
        >
          {reminderSet ? 'Reminder set' : 'Remind me'}
        </Button>
      </section>
    </Blueprint>
  )
}

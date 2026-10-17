'use client'

import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { CITIES } from '@/features/engine'
import type { FieldId } from '@/features/engine/types'
import { MockTag, PanelHead } from '@/features/road/client'
import { FIELDS } from '@/features/roads/data/fields'
import { Note } from '@/shared/components/Note'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Textarea } from '@/shared/components/ui/textarea'
import { cn } from '@/shared/lib/utils'
import type { FinderHit, FinderWhy } from '../model/types'
import { type FinderRoom, type FinderSearch, type FinderWhyCall, useFinder } from './useFinder'

/** What the board needs to offer the finder: the box's first words and the two actions. */
export type FinderProps = { seed: string; search: FinderSearch; why: FinderWhyCall }

/** The longest text the search action takes. */
const TEXT_MAX = 300

const cityName = (id: string): string => CITIES.find((c) => c.id === id)?.name ?? id
const yearsOf = (n: number): string => `${n} year${n === 1 ? '' : 's'}`
const fieldName = (id: FieldId): string => FIELDS.find((f) => f.id === id)?.name ?? id
/** Subjects by name: "A and B", "A, B and C". */
const subjectNames = (fields: FieldId[]): string => {
  const names = fields.map(fieldName)
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/**
 * Find courses: her words (prefilled with `seed`, editable), Search, then a card per course that
 * passes her filters, each with its why once it arrives, and "How this was found", the engine room
 * a judge opens: her query, the model, every hit with its score and the filter it failed, the
 * keyword search's hits, each why's quote and the times. Everything stacks in one column, as
 * narrow as the card column. Opening it puts focus in the box; Escape from anywhere inside closes
 * it, as Close does.
 */
export function FinderPanel({
  roadmapId,
  seed,
  search,
  why,
  onClose,
}: FinderProps & { roadmapId: string; onClose: () => void }) {
  const [text, setText] = useState(seed)
  const { state, cards, whys, room, run } = useFinder({ roadmapId, search, why })
  const boxId = useId()
  const said = state.error ?? state.message
  const boxRef = useRef<HTMLTextAreaElement>(null)
  // Opened, from wherever it was opened, she starts in the box.
  useEffect(() => {
    boxRef.current?.focus()
  }, [])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape from anywhere inside closes it as Close does
    <div
      className="flex flex-col gap-4"
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key !== 'Escape') return
        e.stopPropagation()
        onClose()
      }}
    >
      <div className="flex flex-col gap-2">
        <PanelHead kicker="Course finder" title="Find courses" onClose={onClose} />
        <p className="m-0 text-caption text-muted-foreground">
          A sample catalogue for this demo: the courses are illustrative, not real offerings of
          these universities.
        </p>
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim() && !state.searching) void run(text)
        }}
      >
        <label htmlFor={boxId} className="font-medium">
          What you enjoy and what you’re good at
        </label>
        <Textarea
          ref={boxRef}
          id={boxId}
          aria-describedby={`${boxId}-sent`}
          rows={4}
          maxLength={TEXT_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-base"
        />
        <p id={`${boxId}-sent`} className="m-0 text-caption text-muted-foreground">
          What you type here is sent to Google’s AI to find courses and explain them.
        </p>
        <Button
          type="submit"
          className="self-start"
          aria-disabled={state.searching || !text.trim()}
        >
          Search
        </Button>
      </form>
      <div role="status" aria-live="polite">
        {state.searching ? (
          <Note tone="hint" icon={null}>
            Searching…
          </Note>
        ) : said ? (
          <Note tone="limit">{said}</Note>
        ) : null}
      </div>
      {cards.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {cards.map((hit) => (
            <li key={hit.courseId}>
              <FoundCard hit={hit} why={whys[hit.courseId]} />
            </li>
          ))}
        </ul>
      ) : null}
      {room ? <EngineRoom room={room} whys={whys} /> : null}
    </div>
  )
}

/** A course she might take: what and where, its fee and match, a wildcard's field, its why. */
function FoundCard({ hit, why }: { hit: FinderHit; why: FinderWhy | 'loading' | undefined }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <h3 className="m-0 text-h4 leading-tight">{hit.name}</h3>
      {hit.fields.length > 1 ? (
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
          <span>Combines {subjectNames(hit.fields)}</span>
          {hit.fitsBoth ? (
            <span className="border border-accent-700 px-2 py-0.5 text-accent-800">
              <span aria-hidden="true">Fits both</span>
              <span className="sr-only">Fits both your interests</span>
            </span>
          ) : null}
        </p>
      ) : null}
      <p className="m-0 text-caption text-muted-foreground">
        {hit.university} · {cityName(hit.cityId)} · {hit.level} · {yearsOf(hit.years)}
      </p>
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>AUD {hit.feeK}k a year</span>
        <span className="text-caption text-muted-foreground">match {hit.score.toFixed(2)}</span>
        <MockTag label="sample data" />
      </p>
      {hit.niche ? (
        <p className="m-0 flex flex-col items-start gap-1 text-caption text-muted-foreground">
          <span className="border border-accent-700 px-2 py-0.5 text-accent-800">Wildcard</span>
          {hit.definition}
        </p>
      ) : null}
      {why === 'loading' ? (
        <p className="m-0 text-caption text-muted-foreground">Writing why…</p>
      ) : why ? (
        <p className="m-0 text-caption">
          {why.text}
          {why.quote ? (
            <span className="mt-1 block text-muted-foreground">“{why.quote}”</span>
          ) : null}
        </p>
      ) : null}
    </Card>
  )
}

/** "How this was found": the engine room, one list under another. */
function EngineRoom({
  room,
  whys,
}: {
  room: FinderRoom
  whys: Record<string, FinderWhy | 'loading'>
}) {
  const written = Object.values(whys).filter((w): w is FinderWhy => w !== 'loading')
  const whyMs = written.length > 0 ? Math.max(...written.map((w) => w.ms)) : null
  const nameOf = new Map(room.hits.map((h) => [h.courseId, h.name]))
  return (
    <details className="flex flex-col gap-3 text-caption">
      <summary className="cursor-pointer font-medium">How this was found</summary>
      <div className="mt-3 flex flex-col gap-4">
        <dl className="m-0 flex flex-col gap-1">
          <dt className="text-muted-foreground">Query</dt>
          <dd className="m-0">{room.query}</dd>
          <dt className="text-muted-foreground">Model</dt>
          <dd className="m-0">
            {room.model}
            {room.cached ? ' · cached' : ''}
          </dd>
          <dt className="text-muted-foreground">Time</dt>
          <dd className="m-0">
            Search {room.searchMs} ms
            {whyMs !== null ? ` · why up to ${whyMs} ms` : ''}
          </dd>
        </dl>
        <section className="flex flex-col gap-1">
          <h3 className="m-0 text-h4">Meaning search found</h3>
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {room.hits.map((h) => (
              <li
                key={h.courseId}
                className={cn('flex flex-col', h.failed.length > 0 && 'text-muted-foreground')}
              >
                <span>
                  {h.score.toFixed(3)} · {h.name}
                </span>
                <span>Subjects: {h.fields.map(fieldName).join(', ')}</span>
                {h.failed.length > 0 ? <span>Fails: {h.failed.join(', ')}</span> : null}
              </li>
            ))}
          </ol>
        </section>
        <section className="flex flex-col gap-1">
          <h3 className="m-0 text-h4">Keyword search found</h3>
          {room.keyword.length > 0 ? (
            <ol className="m-0 flex list-none flex-col gap-1 p-0">
              {room.keyword.map((k) => (
                <li key={k.courseId}>
                  {k.rank.toFixed(3)} · {k.name}
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 text-muted-foreground">Nothing for these words.</p>
          )}
        </section>
        {written.length > 0 ? (
          <section className="flex flex-col gap-1">
            <h3 className="m-0 text-h4">What each why quoted</h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {written.map((w) => (
                <li key={w.courseId} className="flex flex-col">
                  <span className="text-muted-foreground">
                    {nameOf.get(w.courseId)} · {w.source} · {w.ms} ms
                  </span>
                  <span>{w.quote ? `“${w.quote}”` : 'The template, no quote'}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </details>
  )
}

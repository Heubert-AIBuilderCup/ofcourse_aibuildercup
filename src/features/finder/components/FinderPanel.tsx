'use client'

import { type KeyboardEvent, type Ref, useEffect, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { CITIES } from '@/features/engine'
import type { FieldId } from '@/features/engine/types'
import { MockTag, PanelHead, WhatChanges } from '@/features/road/client'
import { FIELDS } from '@/features/roads/data/fields'
import type { CompareRow } from '@/features/roads/data/types'
import { Note } from '@/shared/components/Note'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Textarea } from '@/shared/components/ui/textarea'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import type { FinderHit, FinderWhy } from '../model/types'
import { CourseDetail } from './CourseDetail'
import { type FinderRoom, type FinderSearch, type FinderWhyCall, useFinder } from './useFinder'

/** compareCourseAction's shape: her roadmap's road beside a found course's. */
export type FinderCompare = (
  roadmapId: string,
  courseId: string,
) => Promise<ActionResult<{ rows: CompareRow[]; pinnable: boolean }>>

/**
 * What the board needs to offer the finder: the box's first words and the two actions, and with
 * compare on (COMPARE_ON) the comparison's.
 */
export type FinderProps = {
  seed: string
  search: FinderSearch
  why: FinderWhyCall
  compare?: FinderCompare
}

/** A found course she is comparing: loading, its comparison, or what went wrong. */
type Comparing = {
  hit: FinderHit
  result: 'loading' | { rows: CompareRow[]; pin: string | null } | { error: string }
}

const COMPARE_FAILED = "Couldn't compare right now"

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
 * keyword search's hits, each why's quote and the times. With `compare`, each card offers
 * "Compare with my roadmap": the course's name over Back to results, then "What changes", take the
 * results' place, and focus moves to that name; Back to results gives them back as they were, with
 * focus on the Compare she pressed. One status region, mounted in both views, says the search's or
 * the comparison's progress and errors. Everything stacks in one column, as narrow as the card
 * column. Opening it puts focus in the box; Escape from anywhere inside closes it, as Close does.
 */
export function FinderPanel({
  roadmapId,
  seed,
  search,
  why,
  compare,
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
  const [comparing, setComparing] = useState<Comparing | null>(null)
  // The latest comparison asked for; an answer to an earlier one is dropped.
  const latest = useRef(0)
  const titleRef = useRef<HTMLHeadingElement>(null)
  // Each card's Compare by course, so Back to results can return focus to the one she pressed.
  const compareButtons = useRef(new Map<string, HTMLButtonElement>())

  const compareWith = compare
    ? async (hit: FinderHit) => {
        const n = ++latest.current
        // Drawn at once, so focus can move to the comparison's title.
        flushSync(() => setComparing({ hit, result: 'loading' }))
        titleRef.current?.focus()
        let result: Comparing['result']
        try {
          const answer = await compare(roadmapId, hit.courseId)
          result = answer.ok
            ? { rows: answer.rows, pin: answer.pinnable ? hit.courseId : null }
            : { error: answer.error }
        } catch {
          result = { error: COMPARE_FAILED }
        }
        if (latest.current === n) setComparing({ hit, result })
      }
    : undefined
  const backToResults = () => {
    latest.current++
    const pressed = comparing?.hit.courseId
    flushSync(() => setComparing(null))
    if (pressed) compareButtons.current.get(pressed)?.focus()
  }

  const closeOnEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    onClose()
  }

  const result = comparing?.result
  const compared = result && result !== 'loading' ? result : null
  const hint = comparing
    ? result === 'loading'
      ? 'Comparing…'
      : null
    : state.searching
      ? 'Searching…'
      : null
  const limit = comparing ? (compared && 'error' in compared ? compared.error : null) : said

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape from anywhere inside closes it as Close does
    <div className="flex flex-col gap-4" onKeyDown={closeOnEscape}>
      {comparing ? (
        <>
          <PanelHead
            kicker="Compare with my roadmap"
            title={comparing.hit.name}
            titleRef={titleRef}
            onClose={onClose}
          />
          <Button type="button" variant="text" className="self-start" onClick={backToResults}>
            Back to results
          </Button>
        </>
      ) : (
        <>
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
        </>
      )}
      <div role="status" aria-live="polite">
        {hint ? (
          <Note tone="hint" icon={null}>
            {hint}
          </Note>
        ) : limit ? (
          <Note tone="limit">{limit}</Note>
        ) : null}
      </div>
      {comparing ? (
        compared && 'rows' in compared ? (
          <WhatChanges rows={compared.rows} pin={compared.pin} roadmapId={roadmapId} />
        ) : null
      ) : (
        <>
          {cards.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {cards.map((hit) => (
                <li key={hit.courseId}>
                  <FoundCard
                    hit={hit}
                    why={whys[hit.courseId]}
                    onCompare={compareWith}
                    compareRef={(el) => {
                      if (el) compareButtons.current.set(hit.courseId, el)
                      else compareButtons.current.delete(hit.courseId)
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {room ? <EngineRoom room={room} whys={whys} /> : null}
        </>
      )}
    </div>
  )
}

/**
 * A course she might take: what and where, its fee and match, a wildcard's field, its why, and,
 * with the course detail on, its jobs and the fields close to it, folded under the rest; with
 * `onCompare`, "Compare with my roadmap" (handed to `compareRef`, for focus to return to).
 */
function FoundCard({
  hit,
  why,
  onCompare,
  compareRef,
}: {
  hit: FinderHit
  why: FinderWhy | 'loading' | undefined
  onCompare?: (hit: FinderHit) => void
  compareRef?: Ref<HTMLButtonElement>
}) {
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
      {hit.detail ? <CourseDetail detail={hit.detail} /> : null}
      {onCompare ? (
        <Button
          ref={compareRef}
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => onCompare(hit)}
        >
          Compare with my roadmap
        </Button>
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

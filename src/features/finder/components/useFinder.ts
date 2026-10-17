'use client'

import { useRef, useState } from 'react'
import type { ActionResult } from '@/shared/types/action-result'
import { WHY_TOP } from '../model/config'
import type { FinderHit, FinderResult, FinderWhy, KeywordHit } from '../model/types'

/** findCoursesAction's shape: a search of her words for one of her roadmaps. */
export type FinderSearch = (
  roadmapId: string,
  text: string,
) => Promise<ActionResult<{ result: FinderResult }>>

/** finderWhyAction's shape: why a found course fits her words. */
export type FinderWhyCall = (
  roadmapId: string,
  courseId: string,
  text: string,
) => Promise<ActionResult<{ why: FinderWhy }>>

/** What "How this was found" shows of a search: every hit, failed ones too. */
export type FinderRoom = {
  query: string
  model: string
  cached: boolean
  searchMs: number
  hits: FinderHit[]
  keyword: KeywordHit[]
}

export const NOTHING_CLOSE = 'Nothing close yet; tell us a bit more.'
const NONE_FIT =
  'None of the closest courses fit your level, budget or destination. How this was found lists them.'
const SEARCH_FAILED = "Couldn't search right now"

type State = { searching: boolean; error: string | null; message: string | null }
const IDLE: State = { searching: false, error: null, message: null }

/**
 * The Find panel's state. `run` searches her words; the cards are the hits that pass every
 * filter, and the first WHY_TOP of them ask why they fit, each once, after the results are shown
 * (`whys`: 'loading' until it arrives; a why that fails is dropped, the card shows none). A search
 * or a why that answers after a newer search is ignored. A refused or failed search is said in
 * `state.error`, a search with nothing close, or none of whose close courses passes her filters,
 * in `state.message`; either shows no cards.
 */
export function useFinder({
  roadmapId,
  search,
  why,
}: {
  roadmapId: string
  search: FinderSearch
  why: FinderWhyCall
}) {
  const [state, setState] = useState<State>(IDLE)
  const [cards, setCards] = useState<FinderHit[]>([])
  const [whys, setWhys] = useState<Record<string, FinderWhy | 'loading'>>({})
  const [room, setRoom] = useState<FinderRoom | null>(null)
  // The latest search; an answer to an older one is dropped.
  const latest = useRef(0)

  function askWhy(n: number, courseId: string, text: string) {
    const drop = () =>
      setWhys((now) => {
        const { [courseId]: _, ...rest } = now
        return rest
      })
    why(roadmapId, courseId, text).then(
      (answer) => {
        if (latest.current !== n) return
        if (answer.ok) setWhys((now) => ({ ...now, [courseId]: answer.why }))
        else drop()
      },
      () => {
        if (latest.current === n) drop()
      },
    )
  }

  async function run(text: string) {
    const n = ++latest.current
    setState({ ...IDLE, searching: true })
    let answer: Awaited<ReturnType<FinderSearch>>
    try {
      answer = await search(roadmapId, text)
    } catch {
      answer = { ok: false, error: SEARCH_FAILED }
    }
    if (latest.current !== n) return
    if (!answer.ok) {
      setState({ ...IDLE, error: answer.error })
      setCards([])
      setWhys({})
      setRoom(null)
      return
    }
    const { result } = answer
    const hits = result.kind === 'results' ? result.hits : []
    const shown = hits.filter((h) => h.failed.length === 0)
    const asked = shown.slice(0, WHY_TOP).map((h) => h.courseId)
    const message =
      result.kind === 'nothing-close' ? NOTHING_CLOSE : shown.length === 0 ? NONE_FIT : null
    setState({ ...IDLE, message })
    setCards(shown)
    setWhys(Object.fromEntries(asked.map((id) => [id, 'loading' as const])))
    setRoom({
      query: result.query,
      model: result.model,
      cached: result.cached,
      searchMs: result.searchMs,
      hits,
      keyword: result.keyword,
    })
    for (const id of asked) askWhy(n, id, text)
  }

  return { state, cards, whys, room, run }
}

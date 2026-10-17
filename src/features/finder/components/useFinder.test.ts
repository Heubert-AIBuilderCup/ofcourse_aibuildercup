/// <reference lib="dom" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { FilterKey, FinderHit, FinderResult, FinderWhy } from '../model/types'
import { type FinderSearch, type FinderWhyCall, useFinder } from './useFinder'

afterEach(cleanup)

/** A found course; `failed` names the filters it fails. */
const hit = (n: number, failed: FilterKey[] = []): FinderHit => ({
  courseId: `c-${n}`,
  name: `Course ${n}`,
  university: 'Uni',
  cityId: 'perth',
  level: "Master's",
  years: 2,
  feeK: 30,
  field: 'it',
  fields: ['it'],
  fitsBoth: false,
  graphField: 'it',
  niche: false,
  definition: null,
  description: 'What it teaches.',
  score: 0.8 - n / 100,
  failed,
})

const searched = { query: 'x', model: 'm', cached: false, searchMs: 120, keyword: [] }
const results = (hits: FinderHit[]): FinderResult => ({ ...searched, kind: 'results', hits })

/** Ten hits, the 2nd, 4th, 6th and 8th failing a filter. */
const TEN = Array.from({ length: 10 }, (_, i) => hit(i + 1, i % 2 === 1 && i < 8 ? ['fee'] : []))

/** A why action whose answers the test gives, call by call. */
function whys() {
  const settles: (() => void)[] = []
  const action = mock<FinderWhyCall>(
    (_roadmapId, courseId) =>
      new Promise((resolve) => {
        const why: FinderWhy = { courseId, text: 'Because.', quote: 'q', source: 'model', ms: 9 }
        settles.push(() => resolve({ ok: true, why }))
      }),
  )
  return { action, settle: (i: number) => settles[i]() }
}

/** A search answering each call in turn, the last answer from then on. */
const searchOf = (...answers: Awaited<ReturnType<FinderSearch>>[]) => {
  let call = 0
  return mock<FinderSearch>(async () => answers[Math.min(call++, answers.length - 1)])
}

describe('useFinder', () => {
  it('shows only the hits that pass every filter, and keeps all ten for the engine room', async () => {
    const search = mock<FinderSearch>(async () => ({ ok: true, result: results(TEN) }))
    const { action: why } = whys()
    const { result } = renderHook(() => useFinder({ roadmapId: 'r1', search, why }))
    await act(() => result.current.run('x'))
    expect(result.current.cards.length).toBe(6)
    expect(result.current.room?.hits.length).toBe(10)
    expect(search).toHaveBeenCalledWith('r1', 'x')
  })

  it('asks why once each for the first three cards, never for the others or a failed hit', async () => {
    const search = mock<FinderSearch>(async () => ({ ok: true, result: results(TEN) }))
    const { action: why } = whys()
    const { result } = renderHook(() => useFinder({ roadmapId: 'r1', search, why }))
    await act(() => result.current.run('x'))
    expect(why.mock.calls.map((c) => c[1])).toEqual(['c-1', 'c-3', 'c-5'])
    expect(why.mock.calls.every((c) => c[0] === 'r1' && c[2] === 'x')).toBe(true)
    expect(Object.keys(result.current.whys)).toEqual(['c-1', 'c-3', 'c-5'])
    expect(result.current.whys['c-1']).toBe('loading')
  })

  it('shows a why once it arrives', async () => {
    const search = mock<FinderSearch>(async () => ({ ok: true, result: results(TEN) }))
    const { action: why, settle } = whys()
    const { result } = renderHook(() => useFinder({ roadmapId: 'r1', search, why }))
    await act(() => result.current.run('x'))
    await act(async () => settle(0))
    const got = result.current.whys['c-1']
    expect(got === 'loading' ? null : got?.text).toBe('Because.')
  })

  it('ignores a why that arrives after a new search', async () => {
    const search = searchOf(
      { ok: true, result: results([hit(1)]) },
      { ok: true, result: results([hit(20)]) },
    )
    const { action: why, settle } = whys()
    const { result } = renderHook(() => useFinder({ roadmapId: 'r1', search, why }))
    await act(() => result.current.run('x'))
    await act(() => result.current.run('y'))
    await act(async () => settle(0))
    expect(result.current.cards.map((c) => c.courseId)).toEqual(['c-20'])
    expect(Object.keys(result.current.whys)).toEqual(['c-20'])
  })

  it('says a refused search and shows no cards', async () => {
    const search = searchOf(
      { ok: true, result: results(TEN) },
      { ok: false, error: "Couldn't search right now" },
    )
    const { action: why } = whys()
    const { result } = renderHook(() => useFinder({ roadmapId: 'r1', search, why }))
    await act(() => result.current.run('x'))
    await act(() => result.current.run('x'))
    expect(result.current.state.error).toBe("Couldn't search right now")
    expect(result.current.cards).toEqual([])
  })

  it('says a search that could not reach the server as a failure', async () => {
    const search = mock<FinderSearch>(async () => {
      throw new Error('Failed to fetch')
    })
    const { action: why } = whys()
    const { result } = renderHook(() => useFinder({ roadmapId: 'r1', search, why }))
    await act(() => result.current.run('x'))
    expect(result.current.state.error).toBe("Couldn't search right now")
  })

  it('says so when every close course fails her filters, and keeps them for the engine room', async () => {
    const failing = TEN.map((h) => ({ ...h, failed: ['fee' as const] }))
    const search = mock<FinderSearch>(async () => ({ ok: true, result: results(failing) }))
    const { action: why } = whys()
    const { result } = renderHook(() => useFinder({ roadmapId: 'r1', search, why }))
    await act(() => result.current.run('x'))
    expect(result.current.state.message).toBe(
      'None of the closest courses fit your level, budget or destination. How this was found lists them.',
    )
    expect(result.current.cards.length).toBe(0)
    expect(result.current.room?.hits.length).toBe(10)
    expect(why).not.toHaveBeenCalled()
  })

  it('asks for more words when nothing is close', async () => {
    const search = mock<FinderSearch>(async () => ({
      ok: true,
      result: { ...searched, kind: 'nothing-close', best: 0.3 },
    }))
    const { action: why } = whys()
    const { result } = renderHook(() => useFinder({ roadmapId: 'r1', search, why }))
    await act(() => result.current.run('x'))
    expect(result.current.state.message).toBe('Nothing close yet; tell us a bit more.')
    expect(result.current.cards).toEqual([])
    expect(why).not.toHaveBeenCalled()
  })
})

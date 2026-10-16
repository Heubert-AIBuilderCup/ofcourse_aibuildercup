/// <reference lib="dom" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { StoredAnswers } from '@/shared/types/student'
import { useTileWhy, type WhyAction } from './useTileWhy'

const TEMPLATE = 'On your road: Perth counts as regional for visas (mock).'

/** An action whose answer the test gives, when it chooses. */
function pending() {
  let settle: (r: Awaited<ReturnType<WhyAction>>) => void = () => {}
  let fail: (e: unknown) => void = () => {}
  const action = mock<WhyAction>(
    () =>
      new Promise((resolve, reject) => {
        settle = resolve
        fail = reject
      }),
  )
  return {
    action,
    settle: (r: Awaited<ReturnType<WhyAction>>) => settle(r),
    fail: (e: unknown) => fail(e),
  }
}

// The asked map lives as long as the module, so each case asks for its own tile.
let n = 0
const tileId = () => `tile-${++n}`

afterEach(cleanup)

describe('useTileWhy', () => {
  it('shows the template while it asks, and asks once for the roadmap and tile', () => {
    const { action } = pending()
    const tile = tileId()
    const { result } = renderHook(() =>
      useTileWhy({ roadmapId: 'r1', tileId: tile, template: TEMPLATE, action, enabled: true }),
    )
    expect(result.current).toEqual({ text: TEMPLATE, loading: true })
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith('r1', tile)
  })

  it('shows the model’s words once they arrive', async () => {
    const { action, settle } = pending()
    const tile = tileId()
    const { result } = renderHook(() =>
      useTileWhy({ roadmapId: 'r1', tileId: tile, template: TEMPLATE, action, enabled: true }),
    )
    await act(async () => settle({ ok: true, text: 'Because…', source: 'model' }))
    expect(result.current).toEqual({ text: 'Because…', loading: false })
  })

  it('keeps the template, with no error, when the action fails (criterion 17)', async () => {
    const { action, settle } = pending()
    const tile = tileId()
    const { result } = renderHook(() =>
      useTileWhy({ roadmapId: 'r1', tileId: tile, template: TEMPLATE, action, enabled: true }),
    )
    await act(async () => settle({ ok: false, error: 'Not found' }))
    expect(result.current).toEqual({ text: TEMPLATE, loading: false })
  })

  it('keeps the template, with no error, when the action rejects (criterion 17)', async () => {
    const { action, fail } = pending()
    const tile = tileId()
    const { result } = renderHook(() =>
      useTileWhy({ roadmapId: 'r1', tileId: tile, template: TEMPLATE, action, enabled: true }),
    )
    await act(async () => fail(new Error('offline')))
    expect(result.current).toEqual({ text: TEMPLATE, loading: false })
  })

  it('asks no second time for the same roadmap, tile and template (criterion 18)', async () => {
    const { action, settle } = pending()
    const tile = tileId()
    const props = { roadmapId: 'r1', tileId: tile, template: TEMPLATE, action, enabled: true }
    const first = renderHook(() => useTileWhy(props))
    await act(async () => settle({ ok: true, text: 'Because…', source: 'model' }))
    first.unmount()
    const again = renderHook(() => useTileWhy(props))
    expect(again.result.current).toEqual({ text: 'Because…', loading: false })
    await act(async () => {})
    expect(again.result.current).toEqual({ text: 'Because…', loading: false })
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('asks again when her answers change the template (criterion 12)', () => {
    const { action } = pending()
    const tile = tileId()
    const { rerender } = renderHook(
      ({ template }) =>
        useTileWhy({ roadmapId: 'r1', tileId: tile, template, action, enabled: true }),
      { initialProps: { template: TEMPLATE } },
    )
    rerender({ template: 'On your road because you plan to go home after; Perth (mock).' })
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('asks again when her saved answers change though the template stays: the model may quote them', () => {
    const { action } = pending()
    const tile = tileId()
    const masters: StoredAnswers = { level: { value: "Master's", state: 'stated' } }
    const { rerender } = renderHook(
      ({ answers }) =>
        useTileWhy({
          roadmapId: 'r1',
          tileId: tile,
          template: TEMPLATE,
          answers,
          action,
          enabled: true,
        }),
      { initialProps: { answers: masters } },
    )
    rerender({ answers: { level: { value: "Bachelor's", state: 'stated' } } })
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('asks nothing new for the same answers stored in another order', () => {
    const { action } = pending()
    const tile = tileId()
    const stay = { value: 'Yes', state: 'stated' } as const
    const level = { value: "Master's", state: 'stated' } as const
    const { rerender } = renderHook(
      ({ answers }) =>
        useTileWhy({
          roadmapId: 'r1',
          tileId: tile,
          template: TEMPLATE,
          answers,
          action,
          enabled: true,
        }),
      { initialProps: { answers: { stay, level } as StoredAnswers } },
    )
    rerender({ answers: { level, stay } })
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('asks nothing when it is off, or the card has no why', () => {
    const { action } = pending()
    const off = renderHook(() =>
      useTileWhy({ roadmapId: 'r1', tileId: tileId(), template: TEMPLATE, action, enabled: false }),
    )
    expect(off.result.current).toEqual({ text: TEMPLATE, loading: false })
    const none = renderHook(() =>
      useTileWhy({ roadmapId: 'r1', tileId: tileId(), template: undefined, action, enabled: true }),
    )
    expect(none.result.current).toEqual({ text: '', loading: false })
    expect(action).not.toHaveBeenCalled()
  })
})

/// <reference lib="dom" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ActionResult } from '@/shared/types/action-result'
import { SAVE_DEBOUNCE_MS, useAnswerSave } from './answer-save'

afterEach(cleanup)

const ok = async (_patch: unknown): Promise<ActionResult> => ({ ok: true })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pastDebounce = () => act(() => sleep(SAVE_DEBOUNCE_MS + 50))

function setup(impl: (patch: unknown) => Promise<ActionResult> = ok) {
  const action = mock(impl)
  const view = renderHook(() => useAnswerSave(action))
  return { action, ...view }
}

describe('useAnswerSave', () => {
  it('is idle before any save', () => {
    const { result } = setup()
    expect(result.current.statusOf('amount')).toBe('idle')
  })

  it('shows saving at once, calls the action after the debounce, then saved', async () => {
    const { result, action } = setup()
    act(() => result.current.save('amount', 36))
    expect(result.current.statusOf('amount')).toBe('saving')
    expect(action).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.statusOf('amount')).toBe('saved'))
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith({ amount: 36 })
  })

  it('saves only the last tap of a key within the debounce', async () => {
    const { result, action } = setup()
    act(() => {
      result.current.save('amount', 30)
      result.current.save('amount', 36)
    })
    await pastDebounce()
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith({ amount: 36 })
  })

  it('saves two keys separately', async () => {
    const { result, action } = setup()
    act(() => {
      result.current.save('amount', 36)
      result.current.save('covers', 'Fees only')
    })
    await pastDebounce()
    expect(action).toHaveBeenCalledTimes(2)
    expect(action).toHaveBeenCalledWith({ amount: 36 })
    expect(action).toHaveBeenCalledWith({ covers: 'Fees only' })
  })

  it('fails on { ok: false }, and retry sends the same answer at once', async () => {
    let answer: ActionResult = { ok: false, error: 'x' }
    const { result, action } = setup(async () => answer)
    act(() => result.current.save('amount', 36))
    await waitFor(() => expect(result.current.statusOf('amount')).toBe('failed'))
    answer = { ok: true }
    act(() => result.current.retry('amount'))
    expect(result.current.statusOf('amount')).toBe('saving')
    expect(action).toHaveBeenCalledTimes(2)
    expect(action).toHaveBeenLastCalledWith({ amount: 36 })
    await waitFor(() => expect(result.current.statusOf('amount')).toBe('saved'))
  })

  it('fails when the action rejects', async () => {
    const { result } = setup(async () => {
      throw new Error('network')
    })
    act(() => result.current.save('amount', 36))
    await waitFor(() => expect(result.current.statusOf('amount')).toBe('failed'))
  })

  it('ignores a result that comes back after a newer save for the same key', async () => {
    const resolvers: Array<(r: ActionResult) => void> = []
    const { result, action } = setup(() => new Promise<ActionResult>((r) => resolvers.push(r)))
    act(() => result.current.save('amount', 30))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    act(() => result.current.save('amount', 36))
    await act(async () => resolvers[0]({ ok: false, error: 'x' }))
    expect(result.current.statusOf('amount')).toBe('saving')
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2))
    await act(async () => resolvers[1]({ ok: true }))
    expect(result.current.statusOf('amount')).toBe('saved')
  })

  it('sends a save still waiting when unmounted before the debounce, once, with the last tap', async () => {
    const { result, action, unmount } = setup()
    act(() => {
      result.current.save('amount', 30)
      result.current.save('amount', 36)
    })
    unmount()
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith({ amount: 36 })
    await sleep(SAVE_DEBOUNCE_MS + 50)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('flush sends a waiting save at once and never re-sends one in flight', async () => {
    const { result, action } = setup(() => new Promise<ActionResult>(() => {}))
    act(() => result.current.save('amount', 36))
    expect(action).not.toHaveBeenCalled()
    act(() => result.current.flush())
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith({ amount: 36 })
    act(() => result.current.flush())
    await pastDebounce()
    expect(action).toHaveBeenCalledTimes(1)
  })
})

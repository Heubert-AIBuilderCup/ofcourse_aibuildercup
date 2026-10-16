/// <reference lib="dom" />
import { afterEach, describe, expect, it } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { useListView } from './useListView'

const KEY = 'ofcourse:roadmaps-view'

afterEach(() => {
  window.localStorage.clear()
})

describe('the list as cards or a table', () => {
  it('starts as cards', () => {
    const { result } = renderHook(() => useListView())
    expect(result.current.view).toBe('cards')
  })

  it('switches, and remembers the choice in this browser', () => {
    const { result } = renderHook(() => useListView())
    act(() => result.current.set('table'))
    expect(result.current.view).toBe('table')
    expect(window.localStorage.getItem(KEY)).toBe('table')
  })

  it('opens on the view she chose last time', () => {
    window.localStorage.setItem(KEY, 'table')
    const { result } = renderHook(() => useListView())
    expect(result.current.view).toBe('table')
  })

  it('ignores a stored value it does not know', () => {
    window.localStorage.setItem(KEY, 'mosaic')
    const { result } = renderHook(() => useListView())
    expect(result.current.view).toBe('cards')
  })

  it('with storage refused: starts as cards and still switches, without an error', () => {
    // As a browser with storage blocked does: reading window.localStorage itself throws.
    const own = Object.getOwnPropertyDescriptor(window, 'localStorage')
    let reads = 0
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        reads += 1
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    })
    try {
      const { result } = renderHook(() => useListView())
      expect(result.current.view).toBe('cards')
      act(() => result.current.set('table'))
      expect(result.current.view).toBe('table')
      expect(reads).toBeGreaterThan(1)
    } finally {
      if (own) Object.defineProperty(window, 'localStorage', own)
      else delete (window as { localStorage?: Storage }).localStorage
    }
  })
})

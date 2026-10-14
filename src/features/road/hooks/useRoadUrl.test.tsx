/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import * as navigation from 'next/navigation'
import { getRoad } from '../model/road-data'
import { DEFAULT_ROAD_STATE } from '../model/road-url'
import { buildScene, NEW_SESSION } from '../model/scene'

let query = ''
mock.module('next/navigation', () => ({
  ...navigation,
  useSearchParams: () => new URLSearchParams(query),
  usePathname: () => '/road',
}))

const { useRoadUrl } = await import('./useRoadUrl')

const tiles = buildScene(getRoad(), NEW_SESSION).tiles
let replace: ReturnType<typeof spyOn>
let push: ReturnType<typeof spyOn>

beforeEach(() => {
  replace = spyOn(window.history, 'replaceState').mockImplementation(() => {})
  push = spyOn(window.history, 'pushState').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  replace.mockRestore()
  push.mockRestore()
  query = ''
})

const hook = () => renderHook(() => useRoadUrl(tiles))

describe('useRoadUrl', () => {
  it('reads the board’s state from the query', () => {
    query = 'tile=data-science-uwa-perth&zoom=tile'
    expect(hook().result.current.state).toEqual({
      ...DEFAULT_ROAD_STATE,
      tile: 'data-science-uwa-perth',
      zoom: 'tile',
    })
  })

  it('drops an unknown tile or a bad value, and opens at the default', () => {
    query = 'tile=nowhere&zoom=huge&view=grid&open=list'
    expect(hook().result.current.state).toEqual(DEFAULT_ROAD_STATE)
  })

  it('replaces the history entry for a tile, a zoom or a view, defaults left out', () => {
    const { result } = hook()
    act(() => result.current.setState({ ...DEFAULT_ROAD_STATE, tile: 'perth', zoom: 'whole' }))
    expect(replace).toHaveBeenCalledWith(null, '', '/road?tile=perth&zoom=whole')
    act(() => result.current.setState({ ...result.current.state, view: 'map' }))
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road?tile=perth&zoom=whole&view=map')
    act(() => result.current.setState(DEFAULT_ROAD_STATE))
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road')
    expect(push).not.toHaveBeenCalled()
    expect(result.current.state).toEqual(DEFAULT_ROAD_STATE)
  })

  it('pushes a history entry to open the stack’s list, so Back closes it', () => {
    query = 'tile=more-courses-perth'
    const { result } = hook()
    act(() => result.current.setState({ ...result.current.state, open: 'list' }))
    expect(push).toHaveBeenCalledWith(null, '', '/road?tile=more-courses-perth&open=list')
    expect(replace).not.toHaveBeenCalled()
    expect(result.current.state.open).toBe('list')
  })

  it('follows the query when it changes under it (Back closes the list)', () => {
    query = 'tile=more-courses-perth&open=list'
    const { result, rerender } = hook()
    expect(result.current.state.open).toBe('list')
    query = 'tile=more-courses-perth'
    rerender()
    expect(result.current.state).toEqual({ ...DEFAULT_ROAD_STATE, tile: 'more-courses-perth' })
  })
})

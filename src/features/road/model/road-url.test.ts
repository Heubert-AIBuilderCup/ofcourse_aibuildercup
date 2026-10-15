import { describe, expect, it } from 'bun:test'
import { getRoad } from './road-data'
import {
  DEFAULT_ROAD_STATE,
  historyMode,
  parseRoadState,
  type RoadState,
  serializeRoadState,
} from './road-url'
import { buildScene, NEW_SESSION } from './scene'

const { tiles } = buildScene(getRoad(), NEW_SESSION)
const parse = (query: string) => parseRoadState(new URLSearchParams(query), tiles)
const state = (s: Partial<RoadState>): RoadState => ({ ...DEFAULT_ROAD_STATE, ...s })

describe('parseRoadState', () => {
  it('opens at Level, Road view, no card and no list when nothing is given', () => {
    expect(parse('')).toEqual({ tile: null, zoom: 'level', view: 'road', open: null })
  })

  it('reads each param', () => {
    expect(parse('tile=perth&zoom=whole&view=map')).toEqual(
      state({ tile: 'perth', zoom: 'whole', view: 'map' }),
    )
  })

  it('drops an unknown tile id and keeps the rest', () => {
    expect(parse('tile=sydney&zoom=tile')).toEqual(state({ zoom: 'tile' }))
  })

  it('drops a tile that is not on the board in this scene', () => {
    expect(parse('tile=information-systems-curtin-perth')).toEqual(DEFAULT_ROAD_STATE)
  })

  it('drops a bad zoom, view or open value', () => {
    expect(parse('zoom=road')).toEqual(DEFAULT_ROAD_STATE)
    expect(parse('view=list')).toEqual(DEFAULT_ROAD_STATE)
    expect(parse('tile=more-courses-perth&open=all')).toEqual(state({ tile: 'more-courses-perth' }))
  })

  it('opens the list only with a stack tile', () => {
    expect(parse('tile=more-courses-perth&open=list')).toEqual(
      state({ tile: 'more-courses-perth', open: 'list' }),
    )
    expect(parse('tile=perth&open=list')).toEqual(state({ tile: 'perth' }))
    expect(parse('open=list')).toEqual(DEFAULT_ROAD_STATE)
  })

  it('opens her answers whatever the tile', () => {
    expect(parse('open=answers')).toEqual(state({ open: 'answers' }))
    expect(parse('tile=perth&open=answers&view=map')).toEqual(
      state({ tile: 'perth', open: 'answers', view: 'map' }),
    )
  })
})

describe('a deep link', () => {
  it('opens the tile at the Level stop', () => {
    expect(parse('tile=data-science-uwa-perth')).toEqual(
      state({ tile: 'data-science-uwa-perth', zoom: 'level' }),
    )
  })

  it('restores the zoom and the view with the tile', () => {
    expect(parse('tile=data-science-uwa-perth&view=map&zoom=tile')).toEqual(
      state({ tile: 'data-science-uwa-perth', zoom: 'tile', view: 'map' }),
    )
  })
})

describe('serializeRoadState', () => {
  it('omits the defaults', () => {
    expect(serializeRoadState(state({ zoom: 'level', view: 'road' }))).toBe('')
    expect(serializeRoadState(state({ tile: 'more-courses-perth', open: 'list' }))).toBe(
      'tile=more-courses-perth&open=list',
    )
  })

  it('writes her answers open, and reads it back', () => {
    const s = state({ view: 'map', open: 'answers' })
    expect(serializeRoadState(s)).toBe('view=map&open=answers')
    expect(parse(serializeRoadState(s))).toEqual(s)
  })

  it('writes what parseRoadState reads back', () => {
    const s = state({ tile: 'perth', zoom: 'whole', view: 'map' })
    expect(serializeRoadState(s)).toBe('tile=perth&zoom=whole&view=map')
    expect(parse(serializeRoadState(s))).toEqual(s)
  })
})

describe('historyMode', () => {
  const at = state({ tile: 'perth' })

  it('replaces the entry for a press, a zoom or a Road/Map switch', () => {
    expect(historyMode(DEFAULT_ROAD_STATE, at)).toBe('replace')
    expect(historyMode(at, state({ tile: 'perth', zoom: 'whole' }))).toBe('replace')
    expect(historyMode(at, state({ tile: 'perth', view: 'map' }))).toBe('replace')
    expect(historyMode(at, DEFAULT_ROAD_STATE)).toBe('replace')
  })

  it('pushes one when the stack list opens, so Back closes it', () => {
    const stack = state({ tile: 'more-courses-perth' })
    expect(historyMode(stack, { ...stack, open: 'list' })).toBe('push')
  })

  it('pushes one when her answers open, so Back closes them; a switch while open replaces', () => {
    const answers = state({ open: 'answers' })
    expect(historyMode(at, { ...at, open: 'answers' })).toBe('push')
    expect(historyMode(answers, { ...answers, view: 'map' })).toBe('replace')
    expect(historyMode(answers, DEFAULT_ROAD_STATE)).toBe('replace')
  })
})

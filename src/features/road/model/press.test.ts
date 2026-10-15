import { describe, expect, it } from 'bun:test'
import { cardFor, pressTile, primaryAction } from './press'
import { getRoad } from './road-data'
import { DEFAULT_ROAD_STATE, type RoadState } from './road-url'
import { buildScene, NEW_SESSION } from './scene'

const road = getRoad()
const atCourse = buildScene(road, NEW_SESSION)
const swapped = buildScene(road, { ...NEW_SESSION, swapped: true })
const state = (s: Partial<RoadState>): RoadState => ({ ...DEFAULT_ROAD_STATE, ...s })

const CYBER = 'cyber-security-ecu-perth'
const DS = 'data-science-uwa-perth'

describe('pressTile', () => {
  it('opens the pressed tile in the card', () => {
    expect(pressTile(DEFAULT_ROAD_STATE, DS, atCourse)).toEqual(state({ tile: DS }))
  })

  it('at Whole road first brings the camera to Level, centred on the tile', () => {
    expect(pressTile(state({ zoom: 'whole' }), DS, atCourse)).toEqual(
      state({ zoom: 'level', tile: DS }),
    )
  })

  it('keeps the zoom at Tile and the view on the map', () => {
    const at = state({ zoom: 'tile', view: 'map' })
    expect(pressTile(at, 'perth', atCourse)).toEqual({ ...at, tile: 'perth' })
  })

  it('keeps the open tile when it is pressed again', () => {
    expect(pressTile(state({ tile: DS }), DS, atCourse)).toEqual(state({ tile: DS }))
  })

  it('shows where she is when she presses her own tile', () => {
    expect(pressTile(state({ tile: DS }), CYBER, atCourse)).toEqual(DEFAULT_ROAD_STATE)
  })

  it('closes the stack list', () => {
    const list = state({ tile: 'more-courses-perth', open: 'list' })
    expect(pressTile(list, DS, atCourse)).toEqual(state({ tile: DS }))
  })
})

describe('cardFor', () => {
  it('where she is: the course she’s on, with the look ahead', () => {
    expect(cardFor(road, atCourse, CYBER)).toMatchObject({
      kind: 'here',
      kicker: 'You are here · Course',
      name: 'Cyber Security',
      primary: 'Look ahead: Student visa · 500',
      secondary: 'Open route detail',
      because: 'The course you’re on',
      badges: ['offerings', 'ielts', 'fork'],
      routeId: 'student-visa-500',
      siblingsTitle: 'Also in Perth',
    })
  })

  it('opens the here card when no tile is open', () => {
    expect(cardFor(road, atCourse, null).kind).toBe('here')
  })

  it('a course not visited: swap it onto the road, or cancel', () => {
    expect(cardFor(road, atCourse, DS)).toMatchObject({
      kind: 'course',
      kicker: 'Not visited · Course',
      primary: 'Swap onto your road',
      secondary: 'Cancel',
      badges: ['maths'],
    })
  })

  it('a visited place: go there, or cancel', () => {
    expect(cardFor(road, atCourse, 'perth')).toMatchObject({
      kind: 'place',
      kicker: 'Visited · City',
      primary: 'Go to Perth',
      secondary: 'Cancel',
    })
  })

  it('a stack: show the rest, or cancel', () => {
    expect(cardFor(road, atCourse, 'more-courses-perth')).toMatchObject({
      kind: 'stack',
      kicker: 'Stack · Course',
      primary: 'Show 13 more courses',
      secondary: 'Cancel',
    })
  })

  it('a route step: look ahead, the duck stays, back to where she is', () => {
    expect(cardFor(road, atCourse, 'student-visa-500')).toMatchObject({
      kind: 'look',
      kicker: 'Look ahead · the duck stays · Route step',
      primary: 'Open route detail at this step',
      secondary: 'Back to Cyber Security',
      routeId: 'student-visa-500',
    })
    expect(cardFor(road, swapped, 'permanent-residency').secondary).toBe('Back to Data Science')
  })

  it('offers the lesson on the Master’s years only', () => {
    expect(cardFor(road, atCourse, 'masters-cyber-security-ecu').lesson).toBe('masters-years')
    expect(cardFor(road, atCourse, 'graduate-visa-485').lesson).toBeUndefined()
  })

  it('Point A: where she starts, nothing to act on', () => {
    const card = cardFor(road, atCourse, 'point-a')
    expect(card).toMatchObject({ kind: 'point', kicker: 'Point A · You', secondary: 'Cancel' })
    expect(card.primary).toBeUndefined()
  })

  it('after the swap: Data Science is where she is and Cyber Security reads as visited', () => {
    expect(cardFor(road, swapped, DS)).toMatchObject({
      kind: 'here',
      name: 'Data Science',
      badges: ['maths'],
    })
    expect(cardFor(road, swapped, CYBER)).toMatchObject({
      kind: 'course',
      kicker: 'Visited · Course',
    })
  })
})

describe('primaryAction: what the card’s primary does', () => {
  const first = buildScene(road, { ...NEW_SESSION, first: true })
  const city = buildScene(road, { ...NEW_SESSION, city: true })

  it('where she is on a course, looks ahead at the next step', () => {
    expect(primaryAction(road, atCourse, null)).toEqual({
      kind: 'look',
      tileId: 'student-visa-500',
    })
    expect(primaryAction(road, swapped, null)).toEqual({ kind: 'look', tileId: 'student-visa-500' })
  })

  it('swaps the alternative beside her onto her road, and back', () => {
    expect(primaryAction(road, atCourse, DS)).toEqual({ kind: 'swap', tileId: DS })
    expect(primaryAction(road, swapped, CYBER)).toEqual({ kind: 'swap', tileId: CYBER })
  })

  it('opens the list of the course stack', () => {
    expect(primaryAction(road, atCourse, 'more-courses-perth')).toEqual({ kind: 'list' })
  })

  it('walks to her city from its card or, on the first arrival, from where she is', () => {
    expect(primaryAction(road, atCourse, 'perth')).toEqual({ kind: 'walk', to: 'city' })
    expect(primaryAction(road, first, null)).toEqual({ kind: 'walk', to: 'city' })
  })

  it('at her city, walks on to her course', () => {
    expect(primaryAction(road, city, null)).toEqual({ kind: 'walk', to: 'course' })
  })

  it('walks back to her country from its card, from her course or her city', () => {
    expect(primaryAction(road, atCourse, 'australia')).toEqual({ kind: 'walk', to: 'country' })
    expect(primaryAction(road, city, 'australia')).toEqual({ kind: 'walk', to: 'country' })
  })

  it('has nothing to do where the data has no road: another city, the cities’ stack', () => {
    expect(primaryAction(road, atCourse, 'adelaide')).toBeNull()
    expect(primaryAction(road, atCourse, 'more-cities')).toBeNull()
  })

  it('does not swap a course put on the board from the stack (this round)', () => {
    const added = buildScene(road, { ...NEW_SESSION, added: true })
    expect(primaryAction(road, added, 'information-systems-curtin-perth')).toBeNull()
  })
})

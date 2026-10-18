import { describe, expect, it } from 'bun:test'
import { buildRoad } from '@/features/roads/model/build'
import { composeRoad } from '@/features/roads/model/compose'
import { type Card, cardFor, pressTile, primaryAction, withStart } from './press'
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

  it('keeps the camera at Whole road', () => {
    expect(pressTile(state({ zoom: 'whole' }), DS, atCourse)).toEqual(
      state({ zoom: 'whole', tile: DS }),
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
      primary: 'Swap onto your roadmap',
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

  it('a route step: look ahead, and back to where she is, the place said beside it', () => {
    expect(cardFor(road, atCourse, 'student-visa-500')).toMatchObject({
      kind: 'look',
      kicker: 'Look ahead · Route step',
      primary: 'Open route detail at this step',
      secondary: 'Back to where you are',
      backTo: 'Cyber Security',
      routeId: 'student-visa-500',
    })
    expect(cardFor(road, swapped, 'permanent-residency').backTo).toBe('Data Science')
  })

  it('offers the lesson on the Master’s years only', () => {
    expect(cardFor(road, atCourse, 'masters-cyber-security-ecu').lesson).toBe('masters-years')
    expect(cardFor(road, atCourse, 'graduate-visa-485').lesson).toBeUndefined()
  })

  it('the junction: the two ways to PR, nothing to act on', () => {
    const card = cardFor(road, atCourse, 'two-ways-to-pr')
    expect(card).toMatchObject({ kind: 'junction', kicker: 'Fork', secondary: 'Cancel' })
    expect(card.primary).toBeUndefined()
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

  it('walks on to the next place or course from its own card, pressed on the map', () => {
    const atCountry = buildScene(road, { ...NEW_SESSION, country: true })
    const atCity = buildScene(road, { ...NEW_SESSION, city: true })
    expect(primaryAction(road, atCountry, 'perth')).toEqual({ kind: 'walk', to: 'city' })
    expect(primaryAction(road, atCity, CYBER)).toEqual({ kind: 'walk', to: 'course' })
    // A route step ahead is a look, never a walk.
    expect(primaryAction(road, atCourse, 'student-visa-500')).toBeNull()
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

describe('withStart: a card’s primary with what compare can start', () => {
  const card = (c: Partial<Card>): Card => ({
    kind: 'course',
    kicker: '',
    name: 'X',
    sub: '',
    because: '',
    badges: [],
    ...c,
  })

  it('says it starts a new roadmap where one can be started', () => {
    expect(withStart(card({ primary: 'Swap onto your roadmap' }), true).primary).toBe(
      'Start a new roadmap from it',
    )
  })

  it('keeps the card where she is, or a card with no primary, as it is', () => {
    expect(withStart(card({ kind: 'here', primary: 'Look ahead' }), true).primary).toBe(
      'Look ahead',
    )
    expect(withStart(card({}), true).primary).toBeUndefined()
  })

  it('drops a primary that could only start one when none can be', () => {
    expect(
      withStart(card({ primary: 'Start a new roadmap from it', starts: true }), false).primary,
    ).toBeUndefined()
    expect(withStart(card({ primary: 'Swap onto your roadmap' }), false).primary).toBe(
      'Swap onto your roadmap',
    )
  })

  it('drops a primary the board can do nothing for, but keeps a route step’s link', () => {
    expect(
      withStart(card({ primary: 'Swap onto your roadmap' }), false, false).primary,
    ).toBeUndefined()
    expect(withStart(card({ primary: 'Swap onto your roadmap' }), true, false).primary).toBe(
      'Start a new roadmap from it',
    )
    const look = card({ kind: 'look', primary: 'Open route detail at this step', routeId: 'r' })
    expect(withStart(look, false, false).primary).toBe('Open route detail at this step')
    const here = card({ kind: 'here', primary: 'Pick a destination' })
    expect(withStart(here, false, false).primary).toBe('Pick a destination')
  })
})

describe('her own course never offers a swap (Cyber Security at UniSA, the duck at Adelaide)', () => {
  const adelaide = buildRoad(
    composeRoad({ cityId: 'adelaide', courseId: 'unisa-cyber', stays: true }),
    {
      answers: {},
    },
  )
  const COURSE = 'cyber-security-unisa-adelaide'

  it('walked back to her city, her course next: its card walks her on to it', () => {
    const atCity = buildScene(adelaide, { ...NEW_SESSION, city: true })
    expect(atCity.here).toBe('adelaide')
    expect(primaryAction(adelaide, atCity, COURSE)).toEqual({ kind: 'walk', to: 'course' })
    expect(cardFor(adelaide, atCity, COURSE).primary).toBe('Walk to Cyber Security')
  })

  it('at her country on the first arrival: its card has no primary', () => {
    const atCountry = buildScene(adelaide, { ...NEW_SESSION, first: true })
    expect(cardFor(adelaide, atCountry, COURSE).primary).toBeUndefined()
  })

  it('swapped off her road, it swaps back', () => {
    const off = buildScene(adelaide, { ...NEW_SESSION, swapped: true })
    expect(cardFor(adelaide, off, COURSE).primary).toBe('Swap onto your roadmap')
  })
})

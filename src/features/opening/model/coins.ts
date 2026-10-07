// The coins screen's rules: ten coins over eight piles, five on a pile at most, and the one line
// that says what a pile means to her. Pure, so the screen and the server action count the same
// way. A coin never moves a route or a city (DS-R7): no line here says it does.

import { LIFE_VALUES } from '@/shared/types/student'

export const COINS_TOTAL = 10
export const MAX_PER_PILE = 5
/** The design's even spread (r5-model.js LIFE_UNSURE): what "Not sure" places. */
export const NOT_SURE_SPREAD = [2, 1, 1, 2, 1, 1, 1, 1] as const

export const COINS_INTRO =
  'These ten coins are your attention, time and energy for the next few years. Where do they go?'
export const COINS_HINT =
  'Tap + to place a coin. Coins shape what we show you later; they never change your routes.'
export const COINS_ASSUMED = 'Assumed: an even spread. You can change it any time.'

export function placed(piles: readonly number[]): number {
  return piles.reduce((total, n) => total + n, 0)
}

const isPile = (piles: readonly number[], index: number) =>
  Number.isInteger(index) && index >= 0 && index < piles.length

/** A new array: the pile gains a coin, unless it holds five or all ten are placed. */
export function addCoin(piles: readonly number[], index: number): number[] {
  const next = [...piles]
  if (isPile(piles, index) && piles[index] < MAX_PER_PILE && placed(piles) < COINS_TOTAL) {
    next[index] += 1
  }
  return next
}

/** A new array: the pile loses a coin, unless it is empty. */
export function removeCoin(piles: readonly number[], index: number): number[] {
  const next = [...piles]
  if (isPile(piles, index) && piles[index] > 0) next[index] -= 1
  return next
}

export function canFinish(piles: readonly number[]): boolean {
  return placed(piles) === COINS_TOTAL
}

/** What a value means to her at 1 coin, at 2 or 3, and at 4 or 5; in the order of LIFE_VALUES. */
const EFFECTS: readonly (readonly [string, string, string])[] = [
  [
    'sleep and exercise get a mention on busy weeks',
    "we'll point out long commutes and heavy workloads when they come up",
    'your health comes first in what we remind you of',
  ],
  [
    'clubs and events show in your feed now and then',
    "we'll mention student communities on each route",
    "we'll keep people and events in front of you",
  ],
  [
    'money basics appear on every route',
    'money tips and part-time ideas show in your feed',
    "we'll check in about money every month",
  ],
  [
    'short reads for your next step show in your feed',
    "we'll point out placements and tasters when they come up",
    'stretch reading and research pathways show in your feed',
  ],
  [
    'call-time tips appear in your feed',
    "we'll show trip times home on each route",
    "we'll remind you of family dates",
  ],
  [
    'community events show now and then',
    "we'll show community size on each city",
    'community events and groups show in your feed',
  ],
  [
    'tips on living alone show in your feed',
    'own-room costs show on every route',
    "we'll help you plan living on your own",
  ],
  [
    'weekend ideas show now and then',
    "we'll mention what's nearby to explore",
    'new places and trips show in your feed',
  ],
]

/** "Closeness to family at 3: we'll show trip times home on each route." */
export function coinLine(index: number, count: number): string {
  const tier = count >= 4 ? 2 : count >= 2 ? 1 : 0
  const text = count <= 0 ? 'nothing changes' : EFFECTS[index][tier]
  return `${LIFE_VALUES[index]} at ${count}: ${text}.`
}

// The coins screen's rules: ten coins over eight piles, five on a pile at most, and the one line
// that says what a pile means to her. Pure, so the screen and the server action count the same
// way. A coin never moves a route or a city (DS-R7): no line here says it does.

import { COINS_TOTAL, LIFE_VALUES, MAX_PER_PILE } from '@/shared/types/student'

/** What "Not sure" places: the canvas's even spread (Coins.dc.html EVEN), as LIFE_VALUES. */
export const NOT_SURE_SPREAD = [2, 1, 2, 1, 1, 1, 1, 1] as const

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

/** A pile's meaning at 1 or 2 coins, and at 3 to 5 (Coins.dc.html PILES), as LIFE_VALUES. */
const EFFECTS: readonly (readonly [string, string])[] = [
  [
    'health cover basics appear on every route',
    "we'll show clinics, sport and health cover on each route",
  ],
  [
    'student clubs show on each route',
    "we'll show clubs, events and where students live on each route",
  ],
  [
    'money basics appear on every route',
    "we'll show a weekly budget and part-time pay on each route",
  ],
  [
    'short courses and libraries show on each route',
    "we'll show further study and certifications on each route",
  ],
  ['trip costs home show on each route', "we'll show trip times home on each route"],
  [
    'community groups show on each route',
    "we'll show community groups and relatives nearby on each route",
  ],
  [
    'living-alone costs show on each route',
    "we'll show solo living, transport and licences on each route",
  ],
  ['weekend trips show on each route', "we'll show travel and the outdoors near each route"],
]

/** "Closeness to family at 3: we'll show trip times home on each route." */
export function coinLine(index: number, count: number): string {
  const text = count <= 0 ? 'nothing extra shown for it' : EFFECTS[index][count <= 2 ? 0 : 1]
  return `${LIFE_VALUES[index]} at ${count}: ${text}.`
}

/** Why + places no coin on this pile, else null: five on it first, then all ten placed. */
export function refusal(piles: readonly number[], index: number): string | null {
  if (piles[index] >= MAX_PER_PILE)
    return 'Five is the most on one pile. Take one from here, or place it on another pile.'
  if (placed(piles) >= COINS_TOTAL) return 'All ten are placed. Take one from another pile first.'
  return null
}

/** At the tray once all ten are placed: the one place the screen says the coins are used up. */
export const COINS_ALL_PLACED =
  'All ten placed. To move one, take it from a pile first, or press Done to finish.'

/** The line under Done: what is left to place, or that Done now finishes onboarding. */
export function doneLine(piles: readonly number[]): string {
  const left = COINS_TOTAL - placed(piles)
  return left === 0
    ? 'All ten placed. Done finishes onboarding.'
    : `Place all ten to finish · ${left} left.`
}

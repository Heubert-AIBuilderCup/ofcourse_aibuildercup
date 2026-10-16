import { describe, expect, it } from 'bun:test'
import { COINS_TOTAL, coinsSchema, LIFE_VALUES, MAX_PER_PILE } from '@/shared/types/student'
import {
  addCoin,
  canFinish,
  coinLine,
  doneLine,
  NOT_SURE_SPREAD,
  placed,
  refusal,
  removeCoin,
} from './coins'

const empty = () => LIFE_VALUES.map(() => 0)
const sum = (piles: readonly number[]) => piles.reduce((total, n) => total + n, 0)

describe('placed', () => {
  it('counts the coins on every pile', () => {
    expect(placed(empty())).toBe(0)
    expect(placed([2, 1, 1, 2, 1, 1, 1, 1])).toBe(10)
    expect(placed([5, 0, 0, 0, 0, 0, 0, 3])).toBe(8)
  })
})

describe('addCoin', () => {
  it('puts a coin on the pile', () => {
    expect(addCoin(empty(), 3)).toEqual([0, 0, 0, 1, 0, 0, 0, 0])
  })

  it('does not change the piles it is given', () => {
    const piles = empty()
    addCoin(piles, 0)
    expect(piles).toEqual(empty())
  })

  it('refuses a sixth coin on a pile (criterion 54)', () => {
    expect(addCoin([5, 0, 0, 0, 0, 0, 0, 0], 0)).toEqual([5, 0, 0, 0, 0, 0, 0, 0])
  })

  it('refuses an eleventh coin anywhere', () => {
    const full = [2, 1, 1, 2, 1, 1, 1, 1]
    expect(placed(full)).toBe(COINS_TOTAL)
    for (let i = 0; i < full.length; i++) expect(addCoin(full, i)).toEqual(full)
  })

  it('refuses a pile that is not there', () => {
    expect(addCoin(empty(), -1)).toEqual(empty())
    expect(addCoin(empty(), LIFE_VALUES.length)).toEqual(empty())
    expect(addCoin(empty(), 1.5)).toEqual(empty())
  })

  it('places all ten coins, five on a pile at most', () => {
    let piles = empty()
    for (let i = 0; i < 40; i++) piles = addCoin(piles, i % 2)
    expect(piles).toEqual([5, 5, 0, 0, 0, 0, 0, 0])
  })
})

describe('removeCoin', () => {
  it('takes a coin off the pile', () => {
    expect(removeCoin([0, 2, 0, 0, 0, 0, 0, 0], 1)).toEqual([0, 1, 0, 0, 0, 0, 0, 0])
  })

  it('does not change the piles it is given', () => {
    const piles = [0, 2, 0, 0, 0, 0, 0, 0]
    removeCoin(piles, 1)
    expect(piles).toEqual([0, 2, 0, 0, 0, 0, 0, 0])
  })

  it('leaves an empty pile at 0', () => {
    expect(removeCoin(empty(), 2)).toEqual(empty())
  })

  it('refuses a pile that is not there', () => {
    expect(removeCoin([1, 0, 0, 0, 0, 0, 0, 0], -1)).toEqual([1, 0, 0, 0, 0, 0, 0, 0])
    expect(removeCoin([1, 0, 0, 0, 0, 0, 0, 0], LIFE_VALUES.length)).toEqual([
      1, 0, 0, 0, 0, 0, 0, 0,
    ])
  })
})

describe('canFinish', () => {
  it('is true only with exactly ten coins placed (criterion 55)', () => {
    expect(canFinish(empty())).toBe(false)
    expect(canFinish([2, 1, 1, 2, 1, 1, 1, 0])).toBe(false) // nine
    expect(canFinish([2, 1, 1, 2, 1, 1, 1, 1])).toBe(true)
    expect(canFinish([2, 1, 1, 2, 1, 1, 1, 2])).toBe(false) // eleven
  })

  it('is reached by adding coins, and lost by taking one back', () => {
    let piles = empty()
    for (let i = 0; i < 10; i++) piles = addCoin(piles, i % LIFE_VALUES.length)
    expect(canFinish(piles)).toBe(true)
    expect(canFinish(removeCoin(piles, 0))).toBe(false)
  })
})

describe('NOT_SURE_SPREAD', () => {
  it("is the canvas's even spread: two on Health and Financial life, one on the rest", () => {
    expect(NOT_SURE_SPREAD).toEqual([2, 1, 2, 1, 1, 1, 1, 1])
  })

  it('is the even spread: ten coins, none of the eight piles above five', () => {
    expect(NOT_SURE_SPREAD).toHaveLength(LIFE_VALUES.length)
    expect(sum(NOT_SURE_SPREAD)).toBe(COINS_TOTAL)
    expect(Math.max(...NOT_SURE_SPREAD)).toBeLessThanOrEqual(MAX_PER_PILE)
    expect(canFinish(NOT_SURE_SPREAD)).toBe(true)
  })

  it('is what the stored coins accept, and a sixth coin on a pile is not', () => {
    const spent = (piles: readonly number[]) =>
      coinsSchema.safeParse({ state: 'spent', piles: [...piles], assumed: true }).success
    expect(spent(NOT_SURE_SPREAD)).toBe(true)
    expect(spent([6, 1, 1, 1, 1, 0, 0, 0])).toBe(false)
  })
})

/** The canvas's two texts per pile (Coins.dc.html PILES), in the order of LIFE_VALUES. */
const PILE_TEXTS: readonly (readonly [string, string])[] = [
  [
    'health cover basics appear on every route.',
    "we'll show clinics, sport and health cover on each route.",
  ],
  [
    'student clubs show on each route.',
    "we'll show clubs, events and where students live on each route.",
  ],
  [
    'money basics appear on every route.',
    "we'll show a weekly budget and part-time pay on each route.",
  ],
  [
    'short courses and libraries show on each route.',
    "we'll show further study and certifications on each route.",
  ],
  ['trip costs home show on each route.', "we'll show trip times home on each route."],
  [
    'community groups show on each route.',
    "we'll show community groups and relatives nearby on each route.",
  ],
  [
    'living-alone costs show on each route.',
    "we'll show solo living, transport and licences on each route.",
  ],
  ['weekend trips show on each route.', "we'll show travel and the outdoors near each route."],
]

describe('coinLine', () => {
  it('says nothing extra is shown for an empty pile', () => {
    expect(coinLine(0, 0)).toBe('Health at 0: nothing extra shown for it.')
    expect(coinLine(5, 0)).toBe('Community and relatives nearby at 0: nothing extra shown for it.')
  })

  it("gives every pile the canvas's two texts, the first at 1–2, the second at 3–5", () => {
    LIFE_VALUES.forEach((name, i) => {
      const [few, many] = PILE_TEXTS[i]
      for (const n of [1, 2]) expect(coinLine(i, n)).toBe(`${name} at ${n}: ${few}`)
      for (const n of [3, 4, 5]) expect(coinLine(i, n)).toBe(`${name} at ${n}: ${many}`)
    })
  })

  it('never claims a route or city moves (DS-R7, criterion 59)', () => {
    for (let i = 0; i < LIFE_VALUES.length; i++) {
      for (let n = 0; n <= MAX_PER_PILE; n++) {
        expect(coinLine(i, n), `${i} at ${n}`).not.toMatch(
          /\b(rise|rises|lead|leads|seal|rank|sort)\b/,
        )
      }
    }
  })
})

describe('refusal', () => {
  it('refuses a sixth coin on a pile', () => {
    expect(refusal([5, 1, 0, 0, 0, 0, 0, 0], 0)).toBe(
      'Five is the most on one pile. Take one from here, or place it on another pile.',
    )
  })

  it('refuses an eleventh coin on any pile', () => {
    expect(refusal([2, 1, 2, 1, 1, 1, 1, 1], 3)).toBe(
      'All ten are placed. Take one from another pile first.',
    )
  })

  it('says the pile is full when it holds five and all ten are placed', () => {
    expect(refusal([5, 5, 0, 0, 0, 0, 0, 0], 1)).toBe(
      'Five is the most on one pile. Take one from here, or place it on another pile.',
    )
    expect(refusal([5, 5, 0, 0, 0, 0, 0, 0], 2)).toBe(
      'All ten are placed. Take one from another pile first.',
    )
  })

  it('is null while the coin can be placed', () => {
    expect(refusal(empty(), 0)).toBeNull()
    expect(refusal([4, 1, 0, 0, 0, 0, 0, 0], 0)).toBeNull()
  })
})

describe('doneLine', () => {
  it('counts the coins left to place', () => {
    expect(doneLine(empty())).toBe('Place all ten to finish · 10 left.')
    expect(doneLine([2, 1, 2, 1, 1, 1, 1, 0])).toBe('Place all ten to finish · 1 left.')
  })

  it('says Done finishes onboarding at ten', () => {
    expect(doneLine([2, 1, 2, 1, 1, 1, 1, 1])).toBe('All ten placed. Done finishes onboarding.')
  })
})

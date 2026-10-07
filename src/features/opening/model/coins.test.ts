import { describe, expect, it } from 'bun:test'
import { coinsSchema, LIFE_VALUES } from '@/shared/types/student'
import {
  addCoin,
  COINS_TOTAL,
  canFinish,
  coinLine,
  MAX_PER_PILE,
  NOT_SURE_SPREAD,
  placed,
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

describe('coinLine', () => {
  it('says what the coins on a value mean to her (criterion 56)', () => {
    expect(coinLine(4, 3)).toBe(
      "Closeness to family at 3: we'll show trip times home on each route.",
    )
    expect(coinLine(0, 1)).toBe('Health at 1: sleep and exercise get a mention on busy weeks.')
    expect(coinLine(7, 5)).toBe('Adventure at 5: new places and trips show in your feed.')
  })

  it('says nothing changes for an empty pile', () => {
    expect(coinLine(0, 0)).toBe('Health at 0: nothing changes.')
    expect(coinLine(5, 0)).toBe('Community and relatives nearby at 0: nothing changes.')
  })

  it('gives one line for 1 coin, one for 2 or 3, one for 4 or 5', () => {
    for (let i = 0; i < LIFE_VALUES.length; i++) {
      const text = (n: number) => coinLine(i, n).replace(`${LIFE_VALUES[i]} at ${n}: `, '')
      expect(text(2)).toBe(text(3))
      expect(text(4)).toBe(text(5))
      expect(new Set([text(0), text(1), text(2), text(4)]).size).toBe(4)
    }
  })

  it('names its value and its count, and ends in a full stop', () => {
    for (let i = 0; i < LIFE_VALUES.length; i++) {
      for (let n = 0; n <= MAX_PER_PILE; n++) {
        const line = coinLine(i, n)
        expect(line).toStartWith(`${LIFE_VALUES[i]} at ${n}: `)
        expect(line).toEndWith('.')
      }
    }
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

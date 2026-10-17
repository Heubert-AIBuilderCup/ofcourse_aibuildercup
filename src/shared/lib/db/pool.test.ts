import { describe, expect, test } from 'bun:test'
import { poolOptions } from './pool'

// Production bug (18 Oct): two Cloud Run instances at postgres.js's default of ten connections each,
// never closed when idle, used up a db-f1-micro's slots, and the slide previews failed with 53300.

describe('poolOptions', () => {
  test('five connections by default, closed after 20 s idle, 10 s to connect, no prepared statements', () => {
    expect(poolOptions({})).toEqual({
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  })

  test('DB_POOL_MAX sets the pool, from 1 to 20', () => {
    expect(poolOptions({ DB_POOL_MAX: '1' }).max).toBe(1)
    expect(poolOptions({ DB_POOL_MAX: '3' }).max).toBe(3)
    expect(poolOptions({ DB_POOL_MAX: ' 20 ' }).max).toBe(20)
  })

  test('a DB_POOL_MAX that is not a whole number from 1 to 20 keeps five', () => {
    for (const value of ['', '0', '-2', '21', '2.5', 'ten', '5x', '1e1']) {
      expect(poolOptions({ DB_POOL_MAX: value }).max).toBe(5)
    }
  })
})

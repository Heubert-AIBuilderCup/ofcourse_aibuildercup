import { describe, expect, test } from 'bun:test'
import { drawBudget } from './draw-budget'

// A background draw run's time (server/commands/images.ts drawEach), on a clock the test moves.

describe('drawBudget', () => {
  test('lets a run start calls until its budget is spent, then none', () => {
    const BUDGET = 210_000
    let now = 1_000
    const budget = drawBudget(BUDGET, () => now)
    expect(budget.allows()).toBe(true)
    now += BUDGET - 1
    expect(budget.allows()).toBe(true)
    now += 1
    expect(budget.allows()).toBe(false)
    now += 60_000
    expect(budget.allows()).toBe(false)
  })
})
